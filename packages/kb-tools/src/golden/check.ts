import type { FactDef, KnowledgeBase } from "@dead-certain/engine";
import {
	type GoldenDiagnostic,
	type GoldenSet,
	type GoldenValue,
	makeGolden,
	type Scenario,
} from "./model";
import { checkValue, describeValue } from "./values";

function ownFact(kb: KnowledgeBase, name: string): FactDef | undefined {
	return Object.hasOwn(kb.facts, name) ? kb.facts[name] : undefined;
}

/** Fit check of one scenario. Returns its diagnostics, none when it can run. */
function checkScenario(
	scenario: Scenario,
	kb: KnowledgeBase,
	file: string,
): GoldenDiagnostic[] {
	const out: GoldenDiagnostic[] = [];
	const add = (
		code: Parameters<typeof makeGolden>[0],
		message: string,
		field: string,
	): void => {
		out.push(makeGolden(code, file, message, { id: scenario.id, field }));
	};
	const unknownFact = (name: string, field: string): void =>
		add(
			"UNKNOWN_FACT",
			`Fact '${name}' is not in the knowledge base '${kb.id}'.`,
			field,
		);
	const notAskable = (name: string, field: string): void =>
		add(
			"NOT_ASKABLE",
			`Fact '${name}' is worked out by rules, so a scenario cannot give it. Give the facts it depends on.`,
			field,
		);
	const badValue = (
		name: string,
		value: GoldenValue,
		phrase: string,
		field: string,
	): void =>
		add(
			"BAD_VALUE",
			`Value ${describeValue(value)} for fact '${name}' is not ${phrase}.`,
			field,
		);

	/** An askable fact name used by `ask` or `needed`. */
	const askable = (name: string, field: string): void => {
		const def = ownFact(kb, name);
		if (def === undefined) unknownFact(name, field);
		else if (def.derived === true) notAskable(name, field);
	};

	for (const [name, value] of Object.entries(scenario.facts)) {
		const def = ownFact(kb, name);
		if (def === undefined) {
			unknownFact(name, "facts");
		} else if (def.derived === true) {
			notAskable(name, "facts");
		} else if (value === null) {
			add(
				"BAD_VALUE",
				`Value null for fact '${name}' is not allowed in facts; null means unknown only in expect.`,
				"facts",
			);
		} else {
			const phrase = checkValue(def, value);
			if (phrase !== undefined) badValue(name, value, phrase, "facts");
		}
	}

	const e = scenario.expect;
	if ("ask" in e) {
		askable(e.ask, "expect.ask");
		return out;
	}

	const goals = new Set(kb.goals);
	const extra: string[] = [];
	for (const [name, value] of Object.entries(e.goals)) {
		const def = ownFact(kb, name);
		if (def === undefined) {
			unknownFact(name, "expect.goals");
			continue;
		}
		if (!goals.has(name)) extra.push(name);
		if (value !== null) {
			const phrase = checkValue(def, value);
			if (phrase !== undefined) badValue(name, value, phrase, "expect.goals");
		}
	}
	const missing = kb.goals.filter((goal) => !Object.hasOwn(e.goals, goal));
	if (missing.length > 0 || extra.length > 0) {
		const parts = [
			"expect.goals must list exactly the goals of the knowledge base.",
			...(missing.length > 0 ? [`Missing: ${missing.join(", ")}.`] : []),
			...(extra.length > 0 ? [`Not a goal: ${extra.join(", ")}.`] : []),
		];
		add("SCHEMA_INVALID", parts.join(" "), "expect.goals");
	}

	for (const [name, value] of Object.entries(e.lineItems ?? {})) {
		const def = ownFact(kb, name);
		if (def === undefined) {
			unknownFact(name, "expect.line_items");
			continue;
		}
		if (def.role === undefined) {
			add(
				"UNKNOWN_FACT",
				`Fact '${name}' is not a line item of the knowledge base '${kb.id}': it has no role.`,
				"expect.line_items",
			);
			continue;
		}
		if (value !== null) {
			const phrase = checkValue(def, value);
			if (phrase !== undefined) {
				badValue(name, value, phrase, "expect.line_items");
			}
		}
	}

	for (const name of e.needed ?? []) askable(name, "expect.needed");

	const rules = new Set(kb.rules.map((rule) => rule.id));
	for (const id of e.fires ?? []) {
		if (!rules.has(id)) {
			add(
				"UNKNOWN_RULE",
				`Rule '${id}' is not in the knowledge base.`,
				"expect.fires",
			);
		}
	}
	return out;
}

/**
 * Stage 2: the set against its knowledge base. A scenario with any diagnostic
 * is left out of `runnable`; the others are unaffected. Never throws.
 */
export function checkGolden(
	set: GoldenSet,
	kb: KnowledgeBase,
	file: string,
): {
	readonly runnable: readonly Scenario[];
	readonly diagnostics: readonly GoldenDiagnostic[];
} {
	const runnable: Scenario[] = [];
	const diagnostics: GoldenDiagnostic[] = [];
	for (const scenario of set.scenarios) {
		const found = checkScenario(scenario, kb, file);
		if (found.length === 0) runnable.push(scenario);
		diagnostics.push(...found);
	}
	return { runnable, diagnostics };
}

/**
 * Scenario ids must be unique within an app, across its golden files. `files`
 * are the loaded sets of one app in file path order. Each later scenario with
 * an id already used is reported, and returned in `drop` so the caller can
 * leave it out of the run (compare by object identity).
 */
export function duplicateIds(
	files: readonly { readonly file: string; readonly set: GoldenSet }[],
): {
	readonly diagnostics: readonly GoldenDiagnostic[];
	readonly drop: ReadonlySet<Scenario>;
} {
	const first = new Map<string, { file: string; position: number }>();
	const diagnostics: GoldenDiagnostic[] = [];
	const drop = new Set<Scenario>();
	for (const { file, set } of files) {
		set.scenarios.forEach((scenario, i) => {
			const earlier = first.get(scenario.id);
			if (earlier === undefined) {
				first.set(scenario.id, { file, position: i + 1 });
				return;
			}
			drop.add(scenario);
			diagnostics.push(
				makeGolden(
					"DUPLICATE_SCENARIO",
					file,
					`Scenario id '${scenario.id}' is already used by scenario ${earlier.position} of ${earlier.file}.`,
					{ id: scenario.id, field: "id" },
				),
			);
		});
	}
	return { diagnostics, drop };
}
