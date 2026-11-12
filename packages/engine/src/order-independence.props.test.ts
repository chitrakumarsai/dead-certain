// Property 2: Order independence (Requirement 15, criteria 1 to 8; also 4.13, 11.11, 20.9).
// Feature: inference-engine, Property 2: Order independence

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { answer, audit, explain, next, start, whatIf } from "./api";
import { encode } from "./codec/encode";
import { EngineError } from "./errors";
import { kbArb, sessionArb } from "./testkit";
import type { FactValue, Session } from "./types";

const NUM_RUNS = 100;
const TEST_TIMEOUT_MS = 60_000;
const MAX_ANSWERS = 12;

/** Bounded so that a failing property reports cleanly (shrinking included). */
const PARAMS: fc.Parameters<unknown> = {
	numRuns: NUM_RUNS,
	endOnFailure: true,
	interruptAfterTimeLimit: 40_000,
};

type Entry = readonly [string, FactValue];

/** The outcome of one call: a value, or the code of the EngineError it threw. */
type Outcome =
	| { readonly ok: true; readonly value: unknown }
	| { readonly ok: false; readonly code: string };

function attempt(fn: () => unknown): Outcome {
	try {
		return { ok: true, value: fn() };
	} catch (e) {
		if (e instanceof EngineError) return { ok: false, code: e.code };
		throw e;
	}
}

interface Scenario {
	readonly kb: Session["kb"];
	/** The answer set, in one fixed order. */
	readonly entries: readonly Entry[];
	/** Orders of the same set to compare against the first (the identity). */
	readonly orders: readonly (readonly Entry[])[];
}

/** 0, 1, or 2 to 12 answers, drawn on purpose in roughly equal shares. */
const sizeArb: fc.Arbitrary<number> = fc.oneof(
	fc.constant(0),
	fc.constant(1),
	fc.integer({ min: 2, max: MAX_ANSWERS }),
);

/**
 * A knowledge base, a set of valid answers for distinct askable facts (at most
 * 12; fewer when the knowledge base has fewer askable facts), and several
 * permutations of it: the reverse and three random shuffles.
 */
const scenarioArb: fc.Arbitrary<Scenario> = kbArb.chain((kb) =>
	fc
		.tuple(
			sessionArb(kb).map((s) => Object.entries(s.answers) as Entry[]),
			sizeArb,
		)
		.chain(([all, size]) => {
			const n = Math.min(size, all.length);
			return fc
				.shuffledSubarray(all, { minLength: n, maxLength: n })
				.chain((entries) =>
					fc
						.array(
							fc.shuffledSubarray(entries, { minLength: n, maxLength: n }),
							{ minLength: 3, maxLength: 3 },
						)
						.map(
							(shuffles): Scenario => ({
								kb,
								entries,
								orders: [[...entries].reverse(), ...shuffles],
							}),
						),
				);
		}),
);

/** Every function of Requirement 15 for one order, as labelled outcomes. */
function runOrder(
	kb: Session["kb"],
	order: readonly Entry[],
): Record<string, Outcome> {
	const built = attempt(() => {
		let s = start(kb);
		for (const [fact, value] of order) s = answer(s, fact, value);
		return s;
	});
	const out: Record<string, Outcome> = { build: built };
	if (!built.ok) return out;
	const s = built.value as Session;
	out.answers = { ok: true, value: s.answers };
	out.next = attempt(() => next(s));
	out.encode = attempt(() => encode(s));
	// `audit` takes the facts record built by inserting the entries in this order.
	const facts: Record<string, FactValue> = Object.fromEntries(order);
	out.audit = attempt(() => audit(kb, facts));
	for (const goal of kb.goals) {
		out[`explain:${goal}`] = attempt(() => explain(s, goal));
	}
	out.whatIf = attempt(() => whatIf(s));
	return out;
}

/** Same keys, Deep_Equal values, identical JSON text; errors by code only. */
function expectSame(
	expected: Record<string, Outcome>,
	actual: Record<string, Outcome>,
): void {
	expect(Object.keys(actual)).toEqual(Object.keys(expected));
	for (const key of Object.keys(expected)) {
		const e = expected[key] as Outcome;
		const a = actual[key] as Outcome;
		expect(a.ok, key).toBe(e.ok);
		if (!e.ok) {
			expect((a as { code: string }).code, key).toBe(e.code);
		} else {
			const av = (a as { value: unknown }).value;
			expect(av, key).toStrictEqual(e.value);
			expect(JSON.stringify(av), key).toBe(JSON.stringify(e.value));
		}
	}
}

describe("Property 2: Order independence", () => {
	/**
	 * Criteria 1 to 7: every permutation of the same answers gives the same
	 * `answers`, `next`, `encode`, `audit`, `explain` per goal and `whatIf`;
	 * an EngineError in one permutation is the same code in all of them.
	 * **Validates: Requirements 4.13, 11.11, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 20.9**
	 */
	it(
		"every permutation of an answer set gives the same results",
		() => {
			fc.assert(
				fc.property(scenarioArb, ({ kb, entries, orders }) => {
					const baseline = runOrder(kb, entries);
					for (const order of orders) {
						expectSame(baseline, runOrder(kb, order));
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 8: the generator reaches the empty set, a single answer and
	 * sets of 2 to 12 answers, so the property above is not vacuous.
	 * **Validates: Requirements 15.8**
	 */
	it(
		"generates the empty set, a single answer and larger sets",
		() => {
			const sizes = new Set<number>();
			fc.assert(
				fc.property(scenarioArb, ({ entries }) => {
					expect(entries.length).toBeLessThanOrEqual(MAX_ANSWERS);
					sizes.add(entries.length);
				}),
				{ ...PARAMS, numRuns: 200 },
			);
			expect(sizes.has(0)).toBe(true);
			expect(sizes.has(1)).toBe(true);
			expect([...sizes].some((n) => n >= 2)).toBe(true);
		},
		TEST_TIMEOUT_MS,
	);
});
