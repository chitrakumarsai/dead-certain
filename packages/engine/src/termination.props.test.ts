// Property 5: Termination (Requirement 18).
//
// The 5,000 ms bound is checked here, in the test file only: a synchronous call
// cannot be pre-empted, so `timed` measures each call and fails the property
// when it took longer than the bound. The engine source reads no clock.

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
	cyclicKbArb,
	kbArb,
	sessionArb,
} from "./testkit";
import type {
	Expr,
	FactDef,
	FactValue,
	KnowledgeBase,
	Rule,
	Session,
} from "./types";

const NUM_RUNS = 100;
const TEST_TIMEOUT_MS = 30_000;
const CALL_LIMIT_MS = 5_000;

/**
 * Bounded so that a failing property reports cleanly: an interrupt cap on total
 * time (shrinking included) and no further runs once a failure is found.
 */
const PARAMS: fc.Parameters<unknown> = {
	numRuns: NUM_RUNS,
	endOnFailure: true,
	interruptAfterTimeLimit: 20_000,
};

/** Runs `fn`; a call that takes 5,000 ms or more fails the property. */
function timed<T>(label: string, fn: () => T): T {
	const began = performance.now();
	let result: T;
	try {
		result = fn();
	} catch (error) {
		if (performance.now() - began >= CALL_LIMIT_MS) {
			throw new Error(`${label} took more than 5000 ms before throwing`);
		}
		throw error;
	}
	const elapsed = performance.now() - began;
	if (elapsed >= CALL_LIMIT_MS) {
		throw new Error(`${label} took ${Math.round(elapsed)} ms (limit 5000)`);
	}
	return result;
}

/** Runs `fn`, treating an EngineError as an acceptable outcome. */
function orEngineError<T>(fn: () => T): T | EngineError {
	try {
		return fn();
	} catch (error) {
		if (error instanceof EngineError) return error;
		throw error;
	}
}

/** Fact names read by an expression (independent of the engine's own walker). */
function refsOf(expr: Expr): string[] {
	switch (expr.kind) {
		case "literal":
			return [];
		case "fact":
			return [expr.name];
		case "unary":
			return refsOf(expr.operand);
		case "binary":
			return [...refsOf(expr.left), ...refsOf(expr.right)];
		case "call":
			return expr.args.flatMap(refsOf);
	}
}

/** True when `name` can reach itself through rule dependencies. */
function onCycle(kb: KnowledgeBase, name: string): boolean {
	const edges = new Map<string, Set<string>>();
	for (const rule of kb.rules) {
		const set = edges.get(rule.set) ?? new Set<string>();
		for (const r of refsOf(rule.to)) set.add(r);
		if (rule.when !== undefined) for (const r of refsOf(rule.when)) set.add(r);
		edges.set(rule.set, set);
	}
	const seen = new Set<string>();
	const stack = [...(edges.get(name) ?? [])];
	while (stack.length > 0) {
		const cur = stack.pop() as string;
		if (cur === name) return true;
		if (seen.has(cur)) continue;
		seen.add(cur);
		for (const n of edges.get(cur) ?? []) stack.push(n);
	}
	return false;
}

/** A knowledge base with one answer value per askable fact (the policy pool). */
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

describe("Property 5: Termination", () => {
	/**
	 * Criteria 2, 3, 4 and 1 (for start, next, answer): a consultation ends in a
	 * Verdict with nothing needed after at most N answers, and every answer to
	 * a Question removes exactly one unanswered askable fact.
	 * **Validates: Requirements 2.4, 18.1, 18.2, 18.3, 18.4, 18.7**
	 */
	it(
		"a driven consultation ends after at most N answers, one fewer unanswered fact each time",
		() => {
			fc.assert(
				fc.property(consultationArb, ([kb, values]) => {
					expect(Object.keys(kb.facts).length).toBeLessThanOrEqual(30);
					expect(kb.rules.length).toBeLessThanOrEqual(60);
					const pool = new Map<string, FactValue>(values);
					const total = askableFacts(kb).length;
					const unanswered = (s: Session) =>
						askableFacts(kb).filter((f) => !Object.hasOwn(s.answers, f)).length;

					let session = timed("start", () => start(kb));
					let answers = 0;
					for (;;) {
						const out = timed("next", () => next(session));
						if (out.kind === "verdict") {
							expect(out.needed).toEqual([]);
							expect(answers).toBeLessThanOrEqual(total);
							return;
						}
						const before = unanswered(session);
						const value = pool.get(out.fact);
						expect(value).not.toBeUndefined();
						session = timed("answer", () =>
							answer(session, out.fact, value as FactValue),
						);
						answers++;
						expect(answers).toBeLessThanOrEqual(total);
						expect(unanswered(session)).toBe(before - 1);
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 6: with no askable facts, `next` on the started session is a
	 * Verdict at once. Also covers the empty knowledge base.
	 * **Validates: Requirements 18.6, 18.7**
	 */
	it(
		"a knowledge base with no askable facts gives a Verdict without any answer",
		() => {
			// Derived-only knowledge bases: 0 to 30 facts, 0 to 60 rules, each rule
			// a literal or a reference to an earlier fact (so no cycle).
			const zeroAskableArb = fc
				.array(
					fc.record({
						lits: fc.array(fc.boolean(), { minLength: 1, maxLength: 2 }),
						back: fc.option(fc.nat(), { nil: undefined }),
					}),
					{ maxLength: 30 },
				)
				.map((specs): KnowledgeBase => {
					const facts: Record<string, FactDef> = {};
					const rules: Rule[] = [];
					specs.forEach((spec, i) => {
						facts[`d${i}`] = { type: "boolean", derived: true };
						const to: Expr =
							spec.back !== undefined && i > 0
								? { kind: "fact", name: `d${spec.back % i}` }
								: {
										kind: "literal",
										type: "boolean",
										value: spec.lits[0] === true,
									};
						rules.push({
							id: `r${i}`,
							cite: "c1",
							set: `d${i}`,
							to,
							because: "Derived.",
						});
					});
					return {
						id: "derived-only",
						goals: specs.length > 0 ? [`d${specs.length - 1}`] : [],
						facts,
						rules,
						clauses: { c1: { id: "c1", title: "Clause", text: "Text." } },
					};
				});
			fc.assert(
				fc.property(zeroAskableArb, (kb) => {
					expect(askableFacts(kb)).toEqual([]);
					const session = timed("start", () => start(kb));
					const out = timed("next", () => next(session));
					expect(out.kind).toBe("verdict");
					if (out.kind === "verdict") expect(out.needed).toEqual([]);
				}),
				PARAMS,
			);
			// Generated knowledge bases from kbArb that happen to have none.
			fc.assert(
				fc.property(kbArb, (kb) => {
					fc.pre(askableFacts(kb).length === 0);
					const out = timed("next", () =>
						next(timed("start", () => start(kb))),
					);
					expect(out.kind).toBe("verdict");
				}),
				{ ...PARAMS, maxSkipsPerRun: 1000 },
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 5: a cyclic knowledge base makes `start` throw CYCLE naming facts
	 * that really lie on a cycle.
	 * **Validates: Requirements 2.4, 18.5, 18.7**
	 */
	it(
		"start throws CYCLE naming the facts on the cycle",
		() => {
			fc.assert(
				fc.property(cyclicKbArb, (kb) => {
					expect(Object.keys(kb.facts).length).toBeLessThanOrEqual(30);
					expect(kb.rules.length).toBeLessThanOrEqual(61);
					const result = orEngineError(() => timed("start", () => start(kb)));
					expect(result).toBeInstanceOf(EngineError);
					const error = result as EngineError;
					expect(error.code).toBe("CYCLE");
					const named = Object.keys(kb.facts).filter((f) =>
						new RegExp(`(^|[^A-Za-z0-9_])${f}([^A-Za-z0-9_]|$)`).test(
							error.message,
						),
					);
					expect(named.length).toBeGreaterThan(0);
					for (const fact of named) expect(onCycle(kb, fact)).toBe(true);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 1 for the remaining functions: each of audit, explain, whatIf,
	 * encode and decode returns or throws an EngineError within 5,000 ms.
	 * **Validates: Requirements 18.1, 18.7**
	 */
	it(
		"audit, explain, whatIf, encode and decode each return or throw an EngineError in time",
		() => {
			fc.assert(
				fc.property(
					kbArb.chain((kb) => sessionArb(kb)),
					(session) => {
						const { kb, answers } = session;
						orEngineError(() => timed("next", () => next(session)));
						orEngineError(() => timed("audit", () => audit(kb, answers)));
						for (const goal of kb.goals.slice(0, 3)) {
							orEngineError(() =>
								timed("explain", () => explain(session, goal)),
							);
						}
						orEngineError(() => timed("whatIf", () => whatIf(session)));
						const token = orEngineError(() =>
							timed("encode", () => encode(session)),
						);
						if (typeof token === "string") {
							orEngineError(() => timed("decode", () => decode(kb, token)));
						}
					},
				),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);
});
