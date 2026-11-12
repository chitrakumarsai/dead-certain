// Property 4: No wasted questions (Requirement 17).
//
// Criteria 1 and 4 run on general generated knowledge bases. Criteria 2, 3 and
// 5 run only on `readOnceKbArb` knowledge bases, which are:
//   - read-once: every fact is referenced from at most one expression
//     position, so no fact can cancel itself out;
//   - boolean and enum facts only, at most 8 askable facts, at most 3 options
//     per enum, derived enums with 2 options (Requirement 17.6);
//   - every sub-expression can vary: each derived fact has one rule per
//     output, the last unguarded, so no rule is dead and no fact is constant,
//     inapplicable or permanently Unknown;
//   - free of self-cancelling expressions (no `if`, no repeated fact).
// Why: relevance is syntactic (Requirement 5.3), so it is exact only on such
// knowledge bases. On them "can change a goal" is decidable by enumerating
// every assignment with the reference interpreter (Requirements 17.6, 17.8).

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { answer, audit, next, start } from "./api";
import { EngineError } from "./errors";
import {
	answerValueArb,
	askableFacts,
	assignments,
	kbArb,
	readOnceKbArb,
	referenceVerdict,
	sessionArb,
} from "./testkit";
import type { FactValue, KnowledgeBase, Session } from "./types";

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

const generalSessionArb = kbArb.chain((kb) => sessionArb(kb));
const readOnceSessionArb = readOnceKbArb.chain((kb) => sessionArb(kb));

/** Runs `fn`, treating an EngineError as "this input is not testable here". */
function tolerant<T>(fn: () => T): T | undefined {
	try {
		return fn();
	} catch (error) {
		if (error instanceof EngineError) return undefined;
		throw error;
	}
}

/** One goal value as a comparable string; `undefined` counts as a value. */
function valueKey(value: FactValue | undefined): string {
	return value === undefined ? "<undefined>" : JSON.stringify(value);
}

function goalKey(
	kb: KnowledgeBase,
	goals: Readonly<Record<string, FactValue | undefined>>,
	only: readonly string[] = kb.goals,
): string {
	return only.map((g) => valueKey(goals[g])).join("|");
}

describe("Property 4: No wasted questions", () => {
	/**
	 * Criterion 1, on general knowledge bases.
	 * **Validates: Requirements 5.4, 17.1, 17.6, 17.7**
	 */
	it(
		"a Question is never for a fact that already has an answer",
		() => {
			fc.assert(
				fc.property(generalSessionArb, (session) => {
					const out = tolerant(() => next(session));
					if (out === undefined || out.kind !== "question") return;
					expect(Object.hasOwn(session.answers, out.fact)).toBe(false);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 2, on read-once knowledge bases.
	 * **Validates: Requirements 5.4, 5.5, 17.2, 17.6, 17.7, 17.8**
	 */
	it(
		"a Question's fact can still change a goal (read-once)",
		() => {
			fc.assert(
				fc.property(readOnceSessionArb, (session) => {
					const { kb, answers } = session;
					const out = next(session);
					if (out.kind !== "question") return;
					expect(Object.hasOwn(answers, out.fact)).toBe(false);

					// Group complete assignments by everything except the asked fact.
					const groups = new Map<string, Set<string>>();
					for (const full of assignments(kb, answers)) {
						const { [out.fact]: _asked, ...rest } = full;
						const restKey = JSON.stringify(Object.entries(rest));
						const ref = referenceVerdict(kb, full);
						const set = groups.get(restKey) ?? new Set<string>();
						set.add(goalKey(kb, ref.goals));
						groups.set(restKey, set);
					}
					const differs = [...groups.values()].some((set) => set.size > 1);
					expect(differs).toBe(true);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criteria 3 and 5, on read-once knowledge bases.
	 * **Validates: Requirements 5.4, 5.5, 5.6, 17.3, 17.5, 17.6, 17.7, 17.8**
	 */
	it(
		"a Verdict with nothing needed is stable under every assignment (read-once)",
		() => {
			fc.assert(
				fc.property(readOnceSessionArb, (session) => {
					const { kb, answers } = session;
					const out = next(session);
					if (out.kind !== "verdict") return;
					expect(out.needed).toEqual([]);

					const base = referenceVerdict(kb, answers);
					const undecided = kb.goals.filter(
						(g) => base.goalEntries[g]?.status === "unknown",
					);
					// Criterion 3: all decided -> whole vector is invariant.
					// Criterion 5: some undecided -> no relevant fact, and the
					// undecided goals' values are invariant.
					const watched = undecided.length === 0 ? kb.goals : undecided;
					if (undecided.length > 0) {
						expect(audit(kb, answers).needed).toEqual([]);
					}

					const keys = new Set<string>();
					for (const full of assignments(kb, answers)) {
						const ref = referenceVerdict(kb, full);
						keys.add(goalKey(kb, ref.goals, watched));
					}
					expect(keys.size).toBe(1);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 4, on general knowledge bases: a consultation driven to the end
	 * never asks the same fact twice.
	 * **Validates: Requirements 5.4, 17.4, 17.6, 17.7**
	 */
	it(
		"a consultation driven to the end asks no fact twice",
		() => {
			const consultationArb = kbArb.chain((kb) =>
				fc.tuple(
					fc.constant(kb),
					fc.tuple(
						...askableFacts(kb).map((name) =>
							fc.tuple(fc.constant(name), answerValueArb(kb, name)),
						),
					),
				),
			);
			fc.assert(
				fc.property(consultationArb, ([kb, values]) => {
					const pool = new Map<string, FactValue>(values);
					const limit = pool.size + 1;
					const asked = new Set<string>();
					let session: Session = start(kb);
					for (let step = 0; step <= limit; step++) {
						const out = tolerant(() => next(session));
						if (out === undefined) return;
						if (out.kind === "verdict") return;
						expect(asked.has(out.fact)).toBe(false);
						asked.add(out.fact);
						const value = pool.get(out.fact);
						expect(value).not.toBeUndefined();
						session = answer(session, out.fact, value as FactValue);
					}
					throw new Error("consultation did not finish within the fact count");
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);
});
