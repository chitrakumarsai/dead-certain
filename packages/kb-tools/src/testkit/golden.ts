import {
	answer,
	audit,
	EngineError,
	type FactValue,
	type KnowledgeBase,
	next,
	start,
} from "@dead-certain/engine";
import fc from "fast-check";
import type { GoldenSet, GoldenValue, Scenario } from "../golden/model";
import { firedRules } from "../golden/run";
import { answersArb } from "./kb";

const known = (value: FactValue | undefined): GoldenValue =>
	value === undefined ? null : value === 0 ? 0 : value;

/**
 * The scenario that records what the engine returns for `facts`, so that
 * running it must pass. `undefined` when the engine itself throws for these
 * facts, because there is nothing to record.
 */
export function recordScenario(
	kb: KnowledgeBase,
	facts: Readonly<Record<string, FactValue>>,
	mode: "consult" | "audit",
	id = "G-1",
): Scenario | undefined {
	try {
		let session = start(kb);
		for (const [fact, value] of Object.entries(facts)) {
			session = answer(session, fact, value);
		}
		const base = { id, title: `Recorded ${mode} run`, mode, facts } as const;
		const outcome = mode === "audit" ? audit(kb, facts) : next(session);
		if (outcome.kind === "question") {
			return { ...base, expect: { ask: outcome.fact } };
		}
		const goals = Object.fromEntries(
			kb.goals.map((goal) => [goal, known(outcome.goals[goal])]),
		);
		const lineItems = Object.fromEntries(
			outcome.lineItems.map((item) => [item.fact, known(item.value)]),
		);
		const names = [
			...kb.goals,
			...outcome.lineItems
				.map((item) => item.fact)
				.filter((fact) => !kb.goals.includes(fact)),
		];
		return {
			...base,
			expect: {
				goals,
				lineItems,
				...(mode === "audit"
					? { needed: outcome.needed.map((question) => question.fact) }
					: {}),
				fires: firedRules(kb, session, names),
			},
		};
	} catch (error) {
		if (error instanceof EngineError) return undefined;
		throw error;
	}
}

/** A golden set of one to five recorded scenarios for `kb`, with ids G-1, G-2 and so on. */
export function goldenSetArb(kb: KnowledgeBase): fc.Arbitrary<GoldenSet> {
	const one = fc.tuple(
		answersArb(kb, { partial: true }),
		fc.constantFrom("consult", "audit" as const),
	);
	return fc.array(one, { minLength: 1, maxLength: 5 }).map((cases) => {
		const scenarios: Scenario[] = [];
		for (const [facts, mode] of cases) {
			const recorded = recordScenario(
				kb,
				facts,
				mode,
				`G-${scenarios.length + 1}`,
			);
			if (recorded !== undefined) scenarios.push(recorded);
		}
		return { kb: kb.id, scenarios };
	});
}
