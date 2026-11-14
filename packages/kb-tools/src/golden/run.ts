import {
	answer,
	audit,
	EngineError,
	explain,
	type FactValue,
	type KnowledgeBase,
	next,
	type ProofNode,
	type Session,
	start,
	type Verdict,
} from "@dead-certain/engine";
import {
	type Difference,
	type GoldenDiagnostic,
	type GoldenRun,
	type GoldenValue,
	makeGolden,
	type Scenario,
	type ScenarioResult,
} from "./model";
import { describeValue } from "./values";

/** The public form of a value: `undefined` is unknown, and `-0` is `0`. */
function normal(value: FactValue | null | undefined): GoldenValue {
	if (value === undefined) return null;
	return value === 0 ? 0 : value;
}

function list(names: readonly string[]): string {
	return names.length === 0 ? "none" : names.join(", ");
}

/** Every rule id on a node of the proof of each of `facts`, in the knowledge base's rule order. */
export function firedRules(
	kb: KnowledgeBase,
	session: Session,
	facts: readonly string[],
): string[] {
	const seen = new Set<string>();
	const walk = (node: ProofNode): void => {
		if (node.rule !== undefined) seen.add(node.rule);
		for (const child of node.children) walk(child);
	};
	for (const fact of facts) walk(explain(session, fact));
	return kb.rules.map((rule) => rule.id).filter((id) => seen.has(id));
}

function compareVerdict(
	kb: KnowledgeBase,
	scenario: Scenario,
	verdict: Verdict,
	fired: readonly string[],
): Difference[] {
	const e = scenario.expect;
	if ("ask" in e) {
		return [
			{
				field: "outcome",
				expected: `a question for '${e.ask}'`,
				observed: "a verdict",
			},
		];
	}
	const out: Difference[] = [];

	for (const goal of kb.goals) {
		const expected = normal(
			Object.hasOwn(e.goals, goal) ? e.goals[goal] : null,
		);
		const observed = normal(verdict.goals[goal]);
		if (expected !== observed) {
			out.push({
				field: `goals.${goal}`,
				expected: describeValue(expected),
				observed: describeValue(observed),
			});
		}
	}

	if (e.lineItems !== undefined) {
		const expectedItems = e.lineItems;
		const seen = new Set<string>();
		for (const item of verdict.lineItems) {
			seen.add(item.fact);
			const observed = normal(item.value);
			if (!Object.hasOwn(expectedItems, item.fact)) {
				out.push({
					field: `line_items.${item.fact}`,
					expected: "no such line item",
					observed: describeValue(observed),
				});
				continue;
			}
			const expected = normal(expectedItems[item.fact]);
			if (expected !== observed) {
				out.push({
					field: `line_items.${item.fact}`,
					expected: describeValue(expected),
					observed: describeValue(observed),
				});
			}
		}
		for (const [name, value] of Object.entries(expectedItems)) {
			if (seen.has(name)) continue;
			out.push({
				field: `line_items.${name}`,
				expected: describeValue(normal(value)),
				observed: "no such line item",
			});
		}
	}

	const expectedNeeded = e.needed ?? [];
	const observedNeeded = verdict.needed.map((question) => question.fact);
	if (list(expectedNeeded) !== list(observedNeeded)) {
		out.push({
			field: "needed",
			expected: list(expectedNeeded),
			observed: list(observedNeeded),
		});
	}

	const wanted = e.fires ?? [];
	if (wanted.some((id) => !fired.includes(id))) {
		out.push({
			field: "fires",
			expected: list(wanted),
			observed: list(fired),
		});
	}
	return out;
}

/**
 * Run one scenario on its own session, the way an app does. Never throws on
 * an engine error: it is returned as status "error".
 */
export function runScenario(
	kb: KnowledgeBase,
	scenario: Scenario,
): ScenarioResult {
	try {
		let session = start(kb);
		for (const [fact, value] of Object.entries(scenario.facts)) {
			session = answer(session, fact, value as FactValue);
		}
		const outcome =
			scenario.mode === "audit"
				? audit(kb, scenario.facts as Readonly<Record<string, FactValue>>)
				: next(session);

		if (outcome.kind === "question") {
			const e = scenario.expect;
			const differences: Difference[] =
				"ask" in e
					? e.ask === outcome.fact
						? []
						: [{ field: "ask", expected: e.ask, observed: outcome.fact }]
					: [
							{
								field: "outcome",
								expected: "a verdict",
								observed: `a question for '${outcome.fact}'`,
							},
						];
			return {
				id: scenario.id,
				status: differences.length === 0 ? "passed" : "failed",
				fired: [],
				differences,
			};
		}

		const facts = [
			...kb.goals,
			...outcome.lineItems
				.map((item) => item.fact)
				.filter((fact) => !kb.goals.includes(fact)),
		];
		const fired = firedRules(kb, session, facts);
		const differences = compareVerdict(kb, scenario, outcome, fired);
		return {
			id: scenario.id,
			status: differences.length === 0 ? "passed" : "failed",
			fired,
			differences,
		};
	} catch (error) {
		if (error instanceof EngineError) {
			return {
				id: scenario.id,
				status: "error",
				fired: [],
				differences: [],
				engineError: { code: error.code, message: error.message },
			};
		}
		throw error;
	}
}

/** What a scenario is called in a message: its id and, in brackets, its title. */
function named(scenario: Scenario): string {
	return `Scenario '${scenario.id}' (${scenario.title})`;
}

function diagnose(
	scenario: Scenario,
	result: ScenarioResult,
	file: string,
): GoldenDiagnostic[] {
	if (result.status === "failed") {
		const parts = result.differences.map(
			(d) => `${d.field} expected ${d.expected}, observed ${d.observed}`,
		);
		return [
			makeGolden(
				"SCENARIO_FAILED",
				file,
				`${named(scenario)} failed: ${parts.join("; ")}`,
				{ id: scenario.id },
			),
		];
	}
	if (result.status === "error" && result.engineError !== undefined) {
		const { code, message } = result.engineError;
		return [
			makeGolden(
				"ENGINE_ERROR",
				file,
				`${named(scenario)} stopped: the engine threw ${code}: ${message}${message.endsWith(".") ? "" : "."}`,
				{ id: scenario.id },
			),
		];
	}
	return [];
}

/**
 * Run each scenario on its own fresh session, in order. A passing scenario adds
 * no diagnostic. Never throws on an engine error.
 */
export function runGolden(
	kb: KnowledgeBase,
	scenarios: readonly Scenario[],
	file: string,
): GoldenRun {
	const results: ScenarioResult[] = [];
	const diagnostics: GoldenDiagnostic[] = [];
	for (const scenario of scenarios) {
		const result = runScenario(kb, scenario);
		results.push(result);
		diagnostics.push(...diagnose(scenario, result, file));
	}
	return { results, diagnostics };
}
