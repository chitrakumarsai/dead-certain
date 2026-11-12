// Property 1: Determinism (Requirement 14, criteria 1 to 7; also 1.6, 5.7, 5.9).

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { audit, explain, next, whatIf } from "./api";
import { encode } from "./codec/encode";
import { EngineError } from "./errors";
import { cyclicKbArb, kbArb, sessionArb } from "./testkit";
import type { FactValue, Session } from "./types";

const NUM_RUNS = 100;
const TEST_TIMEOUT_MS = 60_000;

/** Bounded so that a failing property reports cleanly (shrinking included). */
const PARAMS: fc.Parameters<unknown> = {
	numRuns: NUM_RUNS,
	endOnFailure: true,
	interruptAfterTimeLimit: 40_000,
};

const sessionWithKbArb: fc.Arbitrary<Session> = kbArb.chain((kb) =>
	sessionArb(kb),
);

/** Two Sessions over independent Knowledge_Bases. */
const twoSessionsArb = fc.tuple(sessionWithKbArb, sessionWithKbArb);

/** The outcome of one call: a value, or the code and message of the error. */
type Outcome =
	| { readonly ok: true; readonly value: unknown }
	| { readonly ok: false; readonly code: string; readonly message: string };

function attempt(fn: () => unknown): Outcome {
	try {
		return { ok: true, value: fn() };
	} catch (e) {
		if (e instanceof EngineError) {
			return { ok: false, code: e.code, message: e.message };
		}
		throw e;
	}
}

/** Facts to explain: every goal plus the first few facts. */
function explainTargets(s: Session): string[] {
	return [...new Set([...s.kb.goals, ...Object.keys(s.kb.facts).slice(0, 4)])];
}

/** Every function of Requirement 14 on one Session, as labelled outcomes. */
function runAll(s: Session): Record<string, Outcome> {
	const out: Record<string, Outcome> = {
		next: attempt(() => next(s)),
		audit: attempt(() => audit(s.kb, s.answers)),
		whatIf: attempt(() => whatIf(s)),
		encode: attempt(() => encode(s)),
	};
	for (const fact of explainTargets(s)) {
		out[`explain:${fact}`] = attempt(() => explain(s, fact));
	}
	return out;
}

/** A JSON copy, so that identity and clone symbols never matter. */
function jsonCopy<T>(v: T): T {
	return JSON.parse(JSON.stringify(v)) as T;
}

/** The same entries, inserted in the opposite order. */
function reversed(
	answers: Readonly<Record<string, FactValue>>,
): Record<string, FactValue> {
	return Object.fromEntries(Object.entries(answers).reverse());
}

function expectSame(a: Record<string, Outcome>, b: Record<string, Outcome>) {
	expect(Object.keys(b)).toEqual(Object.keys(a));
	for (const key of Object.keys(a)) {
		expect(b[key], key).toEqual(a[key]);
		expect(JSON.stringify(b[key]), key).toBe(JSON.stringify(a[key]));
	}
}

describe("Property 1: Determinism", () => {
	/** **Validates: Requirements 14.1, 14.2, 14.7, 1.6, 5.7, 5.9** */
	it(
		"repeated calls with Deep_Equal inputs give Deep_Equal results and identical JSON text",
		() => {
			fc.assert(
				fc.property(sessionWithKbArb, (s) => {
					const first = runAll(s);
					const copy: Session = {
						kb: jsonCopy(s.kb),
						answers: jsonCopy(s.answers),
					};
					expectSame(first, runAll(s));
					expectSame(first, runAll(copy));
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/** **Validates: Requirements 14.3** */
	it(
		"answers and facts inserted in a different order change nothing",
		() => {
			fc.assert(
				fc.property(sessionWithKbArb, (s) => {
					const other: Session = { kb: s.kb, answers: reversed(s.answers) };
					expectSame(runAll(s), runAll(other));
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/** **Validates: Requirements 14.5** */
	it(
		"an earlier call with other inputs does not change a result",
		() => {
			fc.assert(
				fc.property(twoSessionsArb, ([s, other]) => {
					const before = runAll(s);
					runAll(other);
					expectSame(before, runAll(s));
					// And in the opposite direction: a fresh call after both.
					const otherBefore = runAll(other);
					runAll(s);
					expectSame(otherBefore, runAll(other));
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/** **Validates: Requirements 14.4** */
	it(
		"invalid inputs throw the same code and message on every call",
		() => {
			fc.assert(
				fc.property(sessionWithKbArb, cyclicKbArb, (s, badKb) => {
					// Invalid Knowledge_Base (Requirement 2, criteria 2 to 4).
					const cyclic: Session = { kb: badKb, answers: {} };
					// Invalid answers (Requirement 3, criteria 4 to 7): unknown fact.
					const unknown: Session = {
						kb: s.kb,
						answers: { ...s.answers, no_such_fact_x: true },
					};
					for (const bad of [cyclic, unknown]) {
						const first = runAll(bad);
						for (const key of ["next", "audit", "whatIf", "encode"]) {
							expect(first[key]?.ok, key).toBe(false);
						}
						expectSame(first, runAll(bad));
						expectSame(
							first,
							runAll({ kb: bad.kb, answers: reversed(bad.answers) }),
						);
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);
});
