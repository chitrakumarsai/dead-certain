// Property 14: What-if alternatives are exactly the answer changes that alter
// the verdict (Requirement 10, criteria 1 to 17, and Requirement 15, criterion 6).

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { audit, next, whatIf } from "./api";
import { EngineError } from "./errors";
import { parse } from "./lang/parse";
import { Resolver } from "./resolve";
import {
	askableFacts,
	cyclicKbArb,
	deepFreeze,
	kbArb,
	sessionArb,
} from "./testkit";
import { thresholdCandidates } from "./thresholds";
import type {
	Alternative,
	Expr,
	FactDef,
	FactValue,
	KnowledgeBase,
	Rule,
	Session,
} from "./types";
import { deepEqual } from "./util";

const NUM_RUNS = 100;
const TEST_TIMEOUT_MS = 60_000;

/** Bounded so that a failing property reports cleanly (shrinking included). */
const PARAMS: fc.Parameters<unknown> = {
	numRuns: NUM_RUNS,
	endOnFailure: true,
	interruptAfterTimeLimit: 40_000,
};

/** A cycle-free Knowledge_Base with a Session over it. */
const sessionWithKbArb: fc.Arbitrary<Session> = kbArb.chain((kb) =>
	sessionArb(kb),
);

/** The Session with one answer changed, built with own properties. */
function changed(s: Session, name: string, value: FactValue) {
	return Object.fromEntries([
		...Object.entries(s.answers).filter(([k]) => k !== name),
		[name, value],
	]) as Record<string, FactValue>;
}

/** Verdict from `audit`, or `undefined` when it throws an EngineError. */
function auditOrUndefined(
	kb: KnowledgeBase,
	answers: Record<string, FactValue>,
) {
	try {
		return audit(kb, answers);
	} catch (e) {
		if (e instanceof EngineError) return undefined;
		throw e;
	}
}

/** The candidate list for an answered askable fact, current answer removed. */
function candidateList(s: Session, name: string): FactValue[] {
	const def = s.kb.facts[name] as FactDef;
	const current = s.answers[name];
	let list: FactValue[];
	if (def.type === "boolean") list = [false, true];
	else if (def.type === "enum") list = [...(def.options ?? [])];
	else {
		list = thresholdCandidates(
			s.kb,
			new Resolver(s.kb, s.answers),
			s.answers,
			name,
		);
	}
	return list.filter((v) => v !== current);
}

/** Answered askable facts in `facts` order. */
function answeredAskable(s: Session): string[] {
	return askableFacts(s.kb).filter((n) => Object.hasOwn(s.answers, n));
}

function isValidForType(def: FactDef, v: FactValue): boolean {
	if (def.type === "number") return typeof v === "number" && Number.isFinite(v);
	if (def.type === "money") {
		return typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
	}
	if (def.type === "date") {
		return (
			typeof v === "string" &&
			/^\d{4}-\d{2}-\d{2}$/.test(v) &&
			!Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
			new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
		);
	}
	return false;
}

function ascending(a: FactValue, b: FactValue): boolean {
	return typeof a === "number" && typeof b === "number"
		? a < b
		: String(a) < String(b);
}

describe("Property 14: What-if alternatives", () => {
	/**
	 * Criteria 1, 4, 5: each Alternative names an answered askable fact, a
	 * different candidate, and the Verdict of `audit` with only that answer
	 * changed, which differs from the current Verdict.
	 * **Validates: Requirements 10.1, 10.3, 10.4, 10.5, 15.6**
	 */
	it(
		"each alternative equals audit with one answer changed and differs from the base",
		() => {
			fc.assert(
				fc.property(sessionWithKbArb, (session) => {
					const alts = whatIf(session);
					const answered = new Set(answeredAskable(session));
					if (alts.length === 0) return;
					const base = audit(session.kb, session.answers);
					for (const alt of alts) {
						expect(answered.has(alt.fact)).toBe(true);
						expect(alt.value).not.toBe(session.answers[alt.fact]);
						const expected = audit(
							session.kb,
							changed(session, alt.fact, alt.value),
						);
						expect(alt.verdict).toStrictEqual(expected);
						expect(deepEqual(alt.verdict, base)).toBe(false);
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criteria 2, 5, 7, 8: no omitted candidate (boolean pair, enum options,
	 * threshold candidates) yields a different Verdict; an omitted candidate
	 * either gives an equal Verdict or throws an EngineError; nothing outside
	 * the candidate lists appears.
	 * **Validates: Requirements 10.2, 10.5, 10.7, 10.8**
	 */
	it(
		"alternatives are exactly the candidates whose verdict differs",
		() => {
			fc.assert(
				fc.property(sessionWithKbArb, (session) => {
					const alts = whatIf(session);
					const base = audit(session.kb, session.answers);
					const kept = new Set(
						alts.map((a) => `${a.fact}\u0000${typeof a.value}\u0000${a.value}`),
					);
					const key = (f: string, v: FactValue) =>
						`${f}\u0000${typeof v}\u0000${v}`;
					const offered = new Set<string>();
					for (const name of answeredAskable(session)) {
						for (const value of candidateList(session, name)) {
							offered.add(key(name, value));
							if (kept.has(key(name, value))) continue;
							const v = auditOrUndefined(
								session.kb,
								changed(session, name, value),
							);
							if (v !== undefined) expect(deepEqual(v, base)).toBe(true);
						}
					}
					for (const k of kept) expect(offered.has(k)).toBe(true);
					if (alts.length === 0) {
						expect(alts).toStrictEqual([]);
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 6: ordered by fact position in `facts`, then candidate
	 * position (false before true, `options` order, ascending thresholds).
	 * **Validates: Requirements 10.6**
	 */
	it(
		"alternatives are ordered by fact position then candidate position",
		() => {
			fc.assert(
				fc.property(sessionWithKbArb, (session) => {
					const alts = whatIf(session);
					const order = Object.keys(session.kb.facts);
					for (let i = 1; i < alts.length; i++) {
						const prev = alts[i - 1] as Alternative;
						const cur = alts[i] as Alternative;
						const pp = order.indexOf(prev.fact);
						const cp = order.indexOf(cur.fact);
						expect(pp).toBeLessThanOrEqual(cp);
						if (pp !== cp) continue;
						const def = session.kb.facts[cur.fact] as FactDef;
						if (def.type === "boolean") {
							expect(prev.value).toBe(false);
							expect(cur.value).toBe(true);
						} else if (def.type === "enum") {
							const opts = def.options ?? [];
							expect(opts.indexOf(prev.value as string)).toBeLessThan(
								opts.indexOf(cur.value as string),
							);
						} else {
							expect(ascending(prev.value, cur.value)).toBe(true);
						}
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criteria 3, 15, 16: per-fact bounds and threshold candidate shape:
	 * boolean at most 1, enum at most N - 1, number/money/date at most 6;
	 * thresholds ascending, unique, valid for the type, current answer excluded.
	 * **Validates: Requirements 10.3, 10.15, 10.16**
	 */
	it(
		"candidate counts are bounded and threshold candidates are sorted, unique and valid",
		() => {
			fc.assert(
				fc.property(sessionWithKbArb, (session) => {
					const alts = whatIf(session);
					for (const name of answeredAskable(session)) {
						const def = session.kb.facts[name] as FactDef;
						const mine = alts.filter((a) => a.fact === name);
						if (def.type === "boolean")
							expect(mine.length).toBeLessThanOrEqual(1);
						else if (def.type === "enum") {
							expect(mine.length).toBeLessThanOrEqual(
								Math.max(0, (def.options ?? []).length - 1),
							);
						} else {
							expect(mine.length).toBeLessThanOrEqual(6);
							const raw = thresholdCandidates(
								session.kb,
								new Resolver(session.kb, session.answers),
								session.answers,
								name,
							);
							expect(raw.length).toBeLessThanOrEqual(6);
							expect(new Set(raw).size).toBe(raw.length);
							expect(raw).not.toContain(session.answers[name]);
							for (const v of raw) expect(isValidForType(def, v)).toBe(true);
							for (let i = 1; i < raw.length; i++) {
								expect(
									ascending(raw[i - 1] as FactValue, raw[i] as FactValue),
								).toBe(true);
							}
						}
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criteria 17, 4: the result does not depend on the order of keys in
	 * `answers`, and the Session passed in is left unchanged.
	 * **Validates: Requirements 10.4, 10.17**
	 */
	it(
		"is independent of answer order and leaves the session unchanged",
		() => {
			fc.assert(
				fc.property(
					sessionWithKbArb,
					fc.integer({ min: 0, max: 1000 }),
					(session, seed) => {
						const entries = Object.entries(session.answers);
						// Deterministic rotation plus reversal gives a different key order.
						const k = entries.length === 0 ? 0 : seed % entries.length;
						const reordered = [
							...entries.slice(k).reverse(),
							...entries.slice(0, k),
						];
						const other: Session = {
							kb: session.kb,
							answers: Object.fromEntries(reordered) as Record<
								string,
								FactValue
							>,
						};
						const before = structuredClone(session.answers);
						const frozen: Session = {
							kb: session.kb,
							answers: deepFreeze({ ...session.answers }),
						};
						const a = whatIf(frozen);
						expect(frozen.answers).toStrictEqual(before);
						expect(whatIf(other)).toStrictEqual(a);
					},
				),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 9: no answers gives an empty array.
	 * **Validates: Requirements 10.9**
	 */
	it(
		"returns an empty array when the session has no answers",
		() => {
			fc.assert(
				fc.property(kbArb, (kb) => {
					expect(whatIf({ kb, answers: {} })).toStrictEqual([]);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criteria 18, 19: a knowledge base that `next` rejects is rejected by
	 * `whatIf` with the same code, and no array is returned.
	 * **Validates: Requirements 10.18, 10.19**
	 */
	it(
		"throws the same error code as next for a cyclic knowledge base",
		() => {
			const code = (fn: () => unknown): string => {
				try {
					fn();
				} catch (e) {
					if (e instanceof EngineError) return e.code;
					throw e;
				}
				return "<no error>";
			};
			fc.assert(
				fc.property(cyclicKbArb, (kb) => {
					const s: Session = { kb, answers: {} };
					const viaNext = code(() => next(s));
					expect(viaNext).not.toBe("<no error>");
					expect(code(() => whatIf(s))).toBe(viaNext);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criteria 13, 14: a probe whose other side is Unknown, or depends on the
	 * answered fact, adds no Threshold_Candidate; a known side adds v-1, v, v+1.
	 * **Validates: Requirements 10.11, 10.12, 10.13, 10.14**
	 */
	it(
		"threshold probes ignore Unknown and self-dependent other sides",
		() => {
			const e = (src: string): Expr => {
				const r = parse(src);
				if (!r.ok) throw new Error(r.error.message);
				return r.expr;
			};
			const rule = (id: string, set: string, to: string): Rule => ({
				id,
				cite: `c-${id}`,
				set,
				to: e(to),
				because: id,
			});
			const kb: KnowledgeBase = {
				id: "probe-kb",
				goals: ["g_unknown", "g_self", "g_known"],
				facts: {
					a: { type: "money", ask: "a?" },
					b: { type: "money", ask: "b?" },
					c: { type: "money", ask: "c?" },
					g_unknown: { type: "boolean", derived: true },
					g_self: { type: "boolean", derived: true },
					g_known: { type: "boolean", derived: true },
				},
				rules: [
					rule("r1", "g_unknown", "a >= b"),
					rule("r2", "g_self", "a < a + 5"),
					rule("r3", "g_known", "a == c"),
				],
				clauses: {
					"c-r1": { id: "c-r1", title: "r1", text: "r1" },
					"c-r2": { id: "c-r2", title: "r2", text: "r2" },
					"c-r3": { id: "c-r3", title: "r3", text: "r3" },
				},
			};
			fc.assert(
				fc.property(
					fc.integer({ min: 0, max: 2_000_000 }),
					fc.integer({ min: 1, max: 2_000_000 }),
					(a, c) => {
						// b is unanswered (Unknown side); the a + 5 side depends on a.
						const answers = { a, c };
						const got = thresholdCandidates(
							kb,
							new Resolver(kb, answers),
							answers,
							"a",
						);
						const expected = [...new Set([c - 1, c, c + 1])]
							.filter((v) => v !== a && v >= 0)
							.sort((x, y) => x - y);
						expect(got).toStrictEqual(expected);
					},
				),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);
});
