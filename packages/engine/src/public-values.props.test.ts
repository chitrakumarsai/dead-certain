// Property 8: Public values contain no internal symbol and are plain JSON
// (Requirements 12 and 21).
//
// Every value that leaves the engine must be plain JSON, with `undefined`
// meaning unknown. A recursive walk checks each value returned by `start`,
// `answer`, `next`, `audit`, `explain`, `whatIf`, `encode` and `decode`.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	answer,
	audit,
	decode,
	encode,
	explain,
	next,
	start,
	whatIf,
} from "./api";
import { EngineError } from "./errors";
import {
	answerValueArb,
	askableFacts,
	kbArb,
	sessionArb,
	walkPublic,
} from "./testkit";
import type {
	FactDef,
	FactValue,
	KnowledgeBase,
	ProofNode,
	Session,
	Verdict,
} from "./types";
import { deepEqual } from "./util";

const NUM_RUNS = 100;
const TEST_TIMEOUT_MS = 60_000;

/**
 * Bounded so that a failing property reports cleanly: an interrupt cap on total time (shrinking included), and no
 * further runs once a failure is found.
 */
const PARAMS: fc.Parameters<unknown> = {
	numRuns: NUM_RUNS,
	endOnFailure: true,
	interruptAfterTimeLimit: 40_000,
};

/**
 * `kbArb` is built with `fc.gen`, and fast-check tags every value it generates
 * with a `Symbol(fast-check/cloneMethod)` key, even after `map`. The symbol comes
 * from the generator, not the engine, but `start` and `answer` hand back the
 * same `kb` object, so the walk would flag it. Each property therefore runs on
 * `plain(...)`, a JSON copy (all Knowledge_Base fields are JSON).
 */
function plain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/** A Knowledge_Base with a Session over it (no `filter`: it hangs on `kbArb`). */
const scenarioArb: fc.Arbitrary<Session> = kbArb.chain((kb) => sessionArb(kb));

/** Names that are awkward as own-property keys, or not declared at all. */
const oddNameArb: fc.Arbitrary<string> = fc.constantFrom(
	"__proto__",
	"constructor",
	"toString",
	"hasOwnProperty",
	"",
	"no_such_fact",
);

/** Observations gathered while a property runs, for the reachability checks. */
interface Seen {
	undefinedGoal: boolean;
	undefinedLineItem: boolean;
	undefinedProof: boolean;
	inapplicableDerived: boolean;
	alternativeFor: Set<string>;
	engineErrors: number;
}

function newSeen(): Seen {
	return {
		undefinedGoal: false,
		undefinedLineItem: false,
		undefinedProof: false,
		inapplicableDerived: false,
		alternativeFor: new Set(),
		engineErrors: 0,
	};
}

/**
 * Calls `fn`. An EngineError is accepted (Requirement 21, criterion 9) and gives
 * `undefined`; any other exception propagates and fails the test. A returned
 * value is walked and JSON round-tripped; a violation fails with the path from
 * the root (the name of the Engine function) and the reason (criterion 8).
 */
function checked<T>(seen: Seen, name: string, fn: () => T): T | undefined {
	let value: T;
	try {
		value = fn();
	} catch (error) {
		if (error instanceof EngineError) {
			seen.engineErrors++;
			return undefined;
		}
		throw error;
	}
	const violation = walkPublic(value, name);
	if (violation !== undefined) {
		throw new Error(
			`${name} returned a non-public value at ${violation.path}: ${violation.reason}`,
		);
	}
	const roundTrip: unknown = JSON.parse(JSON.stringify(value));
	if (!deepEqual(roundTrip, value)) {
		throw new Error(`${name}: JSON round trip is not Deep_Equal to the value`);
	}
	return value;
}

function hasKeyWithUndefined(
	record: Readonly<Record<string, unknown>>,
	key: string,
): boolean {
	return Object.hasOwn(record, key) && record[key] === undefined;
}

function observeVerdict(seen: Seen, verdict: Verdict): void {
	for (const goal of Object.keys(verdict.goals)) {
		if (hasKeyWithUndefined(verdict.goals, goal)) seen.undefinedGoal = true;
	}
	for (const item of verdict.lineItems) {
		if (Object.hasOwn(item, "value") && item.value === undefined) {
			seen.undefinedLineItem = true;
		}
	}
}

function observeProof(seen: Seen, node: ProofNode): void {
	if (Object.hasOwn(node, "value") && node.value === undefined) {
		seen.undefinedProof = true;
	}
	for (const child of node.children) observeProof(seen, child);
}

/** Runs every public function over the Session and walks each result. */
function exercise(seen: Seen, session: Session, odd: string): void {
	const { kb } = session;
	const defs = kb.facts as Readonly<Record<string, FactDef>>;
	const complete = askableFacts(kb).every((n) =>
		Object.hasOwn(session.answers, n),
	);

	checked(seen, "start", () => start(kb));

	const step = checked(seen, "next", () => next(session));
	if (step?.kind === "verdict") observeVerdict(seen, step);

	const verdict = checked(seen, "audit", () => audit(kb, session.answers));
	if (verdict !== undefined) observeVerdict(seen, verdict);

	for (const name of Object.keys(kb.facts)) {
		const proof = checked(seen, "explain", () => explain(session, name));
		if (proof === undefined) continue;
		observeProof(seen, proof);
		if (complete && defs[name]?.derived === true && proof.value === undefined) {
			seen.inapplicableDerived = true;
		}
	}
	checked(seen, "explain", () => explain(session, odd));

	const alternatives = checked(seen, "whatIf", () => whatIf(session));
	for (const alt of alternatives ?? []) {
		const type = defs[alt.fact]?.type;
		if (type === "number" || type === "money" || type === "date") {
			seen.alternativeFor.add(type);
		}
	}

	const token = checked(seen, "encode", () => encode(session));
	if (token !== undefined) {
		checked(seen, "decode", () => decode(kb, token));
	}
}

describe("Property 8: Public values are plain JSON with no internal symbol", () => {
	/**
	 * Criteria 2 to 5 and 9 of Requirement 21, and Requirement 12, criteria 1, 2,
	 * 4 and 5: `start`, `next`, `audit`, `explain`, `whatIf`, `encode` and `decode`.
	 * Over all runs the generators must reach an unknown goal, an unknown line
	 * item value, an unknown proof value, an inapplicable derived fact, and a
	 * `whatIf` Alternative for a number, money and date fact (criteria 6, 7, 10).
	 * **Validates: Requirements 9.13, 12.1, 12.2, 12.4, 12.5, 21.1 to 21.10**
	 */
	it(
		"start, next, audit, explain, whatIf, encode and decode return plain JSON",
		() => {
			const seen = newSeen();
			fc.assert(
				fc.property(scenarioArb, oddNameArb, (generated, odd) => {
					exercise(seen, plain(generated), odd);
				}),
				PARAMS,
			);
			expect(seen.undefinedGoal).toBe(true);
			expect(seen.undefinedLineItem).toBe(true);
			expect(seen.undefinedProof).toBe(true);
			expect(seen.inapplicableDerived).toBe(true);
			expect([...seen.alternativeFor].sort()).toEqual([
				"date",
				"money",
				"number",
			]);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * `answer` returns a Session: it holds only the answered values, and its
	 * result is plain JSON. Each askable fact is answered with a valid value
	 * (and an odd or undeclared name is offered too, which must raise only an
	 * EngineError).
	 * **Validates: Requirements 12.1, 12.2, 12.4, 21.2 to 21.5, 21.9**
	 */
	it(
		"answer returns a plain-JSON Session",
		() => {
			const seen = newSeen();
			const answeredArb = kbArb.chain((kb: KnowledgeBase) => {
				const names = askableFacts(kb);
				return fc.tuple(
					sessionArb(kb),
					names.length === 0
						? fc.constant<readonly [string, FactValue]>(["", 0])
						: fc
								.constantFrom(...names)
								.chain((name) =>
									answerValueArb(kb, name).map(
										(value): readonly [string, FactValue] => [name, value],
									),
								),
					oddNameArb,
				);
			});
			fc.assert(
				fc.property(answeredArb, ([generated, [name, value], odd]) => {
					const session = plain(generated);
					const updated = checked(seen, "answer", () =>
						answer(session, name, value),
					);
					if (updated !== undefined) {
						checked(seen, "next", () => next(updated));
					}
					checked(seen, "answer", () => answer(session, odd, true));
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Guards against vacuous success: errors must be the exception, not the
	 * rule, so most generated sessions really produce values to walk.
	 */
	it(
		"most generated sessions produce values rather than errors",
		() => {
			let calls = 0;
			let errors = 0;
			fc.assert(
				fc.property(scenarioArb, (generated) => {
					const session = plain(generated);
					const seen = newSeen();
					checked(seen, "next", () => next(session));
					checked(seen, "audit", () => audit(session.kb, session.answers));
					calls += 2;
					errors += seen.engineErrors;
				}),
				PARAMS,
			);
			expect(errors).toBeLessThan(calls / 2);
		},
		TEST_TIMEOUT_MS,
	);
});
