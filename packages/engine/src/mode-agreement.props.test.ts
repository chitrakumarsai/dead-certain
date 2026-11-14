// Property 6: Mode agreement (Requirement 19).
//
// `next` (consultation) and `audit` must never disagree for the same
// knowledge base and answers. Answer sets are generated with size 0, size 1
// and size equal to the number of askable facts (Requirement 19, criterion 7).

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { answer, audit, next, start } from "./api";
import { EngineError } from "./errors";
import { Resolver } from "./resolve";
import { answerValueArb, askableFacts, kbArb } from "./testkit";
import type {
	FactDef,
	FactValue,
	KnowledgeBase,
	Session,
	Verdict,
} from "./types";

const NUM_RUNS = 100;
const TEST_TIMEOUT_MS = 30_000;

/**
 * Bounded so that a failing property reports cleanly: an interrupt cap on total time (shrinking included), a
 * wall-clock cap, and no further runs once a failure is found.
 */
const PARAMS: fc.Parameters<unknown> = {
	numRuns: NUM_RUNS,
	endOnFailure: true,
	interruptAfterTimeLimit: 20_000,
};

interface Scenario {
	readonly kb: KnowledgeBase;
	/** A valid value for every askable fact, used to drive a consultation. */
	readonly pool: ReadonlyMap<string, FactValue>;
	/** The original answers: 0, 1 or all askable facts. */
	readonly session: Session;
}

/** Knowledge bases with answer sets of size 0, size 1 and all askable facts. */
const scenarioArb: fc.Arbitrary<Scenario> = kbArb.chain((kb) => {
	const names = askableFacts(kb);
	return fc
		.tuple(
			fc.tuple(
				...names.map((name) =>
					fc.tuple(fc.constant(name), answerValueArb(kb, name)),
				),
			),
			fc.constantFrom("none", "one", "all"),
			fc.nat(Math.max(0, names.length - 1)),
		)
		.map(([entries, size, index]): Scenario => {
			const pool = new Map<string, FactValue>(entries);
			const chosen =
				size === "all"
					? entries
					: size === "one" && entries[index] !== undefined
						? [entries[index]]
						: [];
			return {
				kb,
				pool,
				session: { kb, answers: Object.fromEntries(chosen) },
			};
		});
});

/** Answers every returned Question from `pool` until `next` returns a Verdict. */
function driveToEnd(
	session: Session,
	pool: ReadonlyMap<string, FactValue>,
): Verdict {
	let current = session;
	const limit = pool.size + 1;
	for (let step = 0; step <= limit; step++) {
		const out = next(current);
		if (out.kind === "verdict") return out;
		const value = pool.get(out.fact);
		expect(value).not.toBeUndefined();
		current = answer(current, out.fact, value as FactValue);
	}
	throw new Error("consultation did not finish within the fact count");
}

/** An invalid answer, as `[name, value]`, to add to a valid answer set. */
function invalidEntryArb(kb: KnowledgeBase): fc.Arbitrary<[string, unknown]> {
	const names = askableFacts(kb);
	const derived = Object.keys(kb.facts).filter(
		(n) => (kb.facts[n] as FactDef).derived === true,
	);
	const unknownFact = fc.constantFrom("no_such_fact", "__proto__", "");
	const arbs: fc.Arbitrary<[string, unknown]>[] = [
		unknownFact.map((n): [string, unknown] => [n, true]),
	];
	if (derived.length > 0) {
		arbs.push(
			fc
				.tuple(fc.constantFrom(...derived), fc.constantFrom(true, 1, "x"))
				.map(([n, v]): [string, unknown] => [n, v]),
		);
	}
	if (names.length > 0) {
		arbs.push(
			fc.constantFrom(...names).chain((name) => {
				const type = (kb.facts[name] as FactDef).type;
				const bad: unknown[] = [
					undefined,
					null,
					Number.NaN,
					Number.POSITIVE_INFINITY,
					{},
					"not_a_valid_option",
				];
				if (type !== "boolean") bad.push(true);
				if (type === "boolean") bad.push(1, "true");
				if (type === "money") bad.push(1.5);
				if (type === "date") bad.push("2023-02-30", "2023-13-01");
				return fc.constantFrom(...bad).map((v): [string, unknown] => [name, v]);
			}),
		);
	}
	return fc.oneof(...arbs);
}

/** Runs `fn` and returns the `code` of the EngineError it throws, if any. */
function thrownCode(fn: () => unknown): string {
	try {
		fn();
	} catch (error) {
		if (error instanceof EngineError) return error.code;
		throw error;
	}
	return "<no error>";
}

describe("Property 6: Mode agreement", () => {
	/**
	 * Criteria 1, 2 and 3: the Verdict or the first needed Question agrees.
	 * **Validates: Requirements 7.12, 7.13, 8.1, 8.4, 19.1, 19.2, 19.3, 19.7**
	 */
	it(
		"next and audit agree on the same answers",
		() => {
			fc.assert(
				fc.property(scenarioArb, ({ session }) => {
					const { kb, answers } = session;
					const out = next(session);
					const verdict = audit(kb, answers);
					if (out.kind === "verdict") {
						expect(verdict).toStrictEqual(out);
						return;
					}
					expect(verdict.needed.length).toBeGreaterThanOrEqual(1);
					expect(verdict.needed[0]).toStrictEqual(out);
					const facts = verdict.needed.map((q) => q.fact);
					expect(new Set(facts).size).toBe(facts.length);
					for (const fact of facts) {
						expect(Object.hasOwn(answers, fact)).toBe(false);
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criteria 4 and 5: goals and line items decided under the original answers
	 * keep their value, rule and clause once the consultation is driven to the end.
	 * **Validates: Requirements 8.5, 8.6, 8.7, 8.8, 8.9, 19.4, 19.5, 19.7**
	 */
	it(
		"decided goals and line items match the verdict at the end of a consultation",
		() => {
			fc.assert(
				fc.property(scenarioArb, ({ session, pool }) => {
					const { kb, answers } = session;
					const early = audit(kb, answers);
					const final = driveToEnd(session, pool);
					const resolver = new Resolver(kb, answers);

					for (const goal of kb.goals) {
						if (resolver.fact(goal).status === "unknown") continue;
						expect(final.goals[goal]).toStrictEqual(early.goals[goal]);
					}
					expect(final.lineItems.length).toBe(early.lineItems.length);
					early.lineItems.forEach((item, i) => {
						if (resolver.fact(item.fact).status === "unknown") return;
						const last = final.lineItems[i];
						expect(last?.fact).toBe(item.fact);
						expect(last?.value).toStrictEqual(item.value);
						expect(last?.rule).toBe(item.rule);
						expect(last?.clause).toBe(item.clause);
					});
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 6: the same invalid answer gives the same error code in both modes.
	 * **Validates: Requirements 7.12, 7.13, 8.1, 19.6, 19.7**
	 */
	it(
		"audit and next throw the same code for the same invalid answer",
		() => {
			const invalidArb = scenarioArb.chain((scenario) =>
				fc.tuple(fc.constant(scenario), invalidEntryArb(scenario.kb)),
			);
			fc.assert(
				fc.property(invalidArb, ([{ kb, session }, [name, value]]) => {
					// fromEntries defines own properties, so "__proto__" stays a key.
					const answers = Object.fromEntries([
						...Object.entries(session.answers),
						[name, value],
					]) as Record<string, FactValue>;
					const viaNext = thrownCode(() => next({ kb, answers }));
					const viaAudit = thrownCode(() => audit(kb, answers));
					expect(viaNext).not.toBe("<no error>");
					expect(viaAudit).toBe(viaNext);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	it("generates answer sets of size 0, 1 and all askable facts", () => {
		const sizes = new Set<string>();
		fc.assert(
			fc.property(scenarioArb, ({ kb, session }) => {
				const total = askableFacts(kb).length;
				const size = Object.keys(session.answers).length;
				if (size === 0) sizes.add("none");
				if (size === 1) sizes.add("one");
				if (size === total) sizes.add("all");
				start(kb);
			}),
			{ ...PARAMS, numRuns: 200 },
		);
		expect([...sizes].sort()).toEqual(["all", "none", "one"]);
	});
});
