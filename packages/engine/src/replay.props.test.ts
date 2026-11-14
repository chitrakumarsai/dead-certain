// Property 7: Replay (Requirements 11 and 20).
//
// A verdict link must always reproduce the verdict: `decode` inverts `encode`,
// `encode` inverts `decode`, a damaged token never throws anything but an
// EngineError, and a token is tied to the exact rules it was made for.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { answer, audit, decode, encode, explain, next } from "./api";
import { EngineError } from "./errors";
import { askableFacts, kbArb, sessionArb } from "./testkit";
import type {
	Expr,
	FactType,
	FactValue,
	KnowledgeBase,
	Rule,
	Session,
} from "./types";

const NUM_RUNS = 100;
const TEST_TIMEOUT_MS = 30_000;

/**
 * Bounded so that a failing property reports cleanly: an interrupt cap on total time (shrinking included), and no
 * further runs once a failure is found.
 */
const PARAMS: fc.Parameters<unknown> = {
	numRuns: NUM_RUNS,
	endOnFailure: true,
	interruptAfterTimeLimit: 20_000,
};

const ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

/** The result of a call: its value, or the code of the EngineError it threw. */
type Outcome = { readonly value: unknown } | { readonly code: string };

/** Runs `fn`; an EngineError becomes a code, anything else propagates. */
function outcomeOf(fn: () => unknown): Outcome {
	try {
		return { value: fn() };
	} catch (error) {
		if (error instanceof EngineError) return { code: error.code };
		throw error;
	}
}

/** Decodes; returns the Session, or the EngineError code. Anything else throws. */
function tryDecode(kb: KnowledgeBase, token: string): Session | string {
	try {
		return decode(kb, token);
	} catch (error) {
		if (error instanceof EngineError) return error.code;
		throw error;
	}
}

// ─── Generators ───────────────────────────────────────────────────────────

/** A knowledge base with a session over it; the session holds 0 to all answers. */
const scenarioArb: fc.Arbitrary<Session> = kbArb.chain((kb) => sessionArb(kb));

const ALL_TYPES: readonly FactType[] = [
	"boolean",
	"number",
	"money",
	"date",
	"enum",
];

const X64 = (c: string): string => c.repeat(64);

/**
 * A knowledge base with 64 askable facts whose names are 64 characters long,
 * with enum options of 64 characters, and a session that answers all of them.
 */
const bigScenarioArb: fc.Arbitrary<Session> = fc
	.array(fc.constantFrom(...ALL_TYPES), { minLength: 64, maxLength: 64 })
	.chain((types) => {
		const facts: Record<string, KnowledgeBase["facts"][string]> = {};
		const names: string[] = [];
		types.forEach((type, i) => {
			// 64 characters: 2 digits plus 62 letters, unique per index.
			const name = `${String(i).padStart(2, "0")}${"n".repeat(62)}`;
			names.push(name);
			facts[name] =
				type === "enum"
					? {
							type,
							ask: "?",
							options: [X64("a"), X64("b"), X64("c")],
						}
					: { type, ask: "?" };
		});
		facts.total = { type: "boolean", derived: true };
		const kb: KnowledgeBase = {
			id: "big",
			currency: "USD",
			goals: ["total"],
			facts,
			rules: [
				{
					id: "r-total",
					cite: "c1",
					set: "total",
					to: { kind: "literal", type: "boolean", value: true },
					because: "Always.",
				},
			],
			clauses: { c1: { id: "c1", title: "Clause", text: "Text." } },
		};
		const valueFor = (type: FactType): fc.Arbitrary<FactValue> => {
			switch (type) {
				case "boolean":
					return fc.boolean();
				case "number":
					return fc
						.double({ noNaN: true, noDefaultInfinity: true })
						.map((v) => (Object.is(v, -0) ? 0 : v));
				case "money":
					return fc.integer({
						min: -Number.MAX_SAFE_INTEGER,
						max: Number.MAX_SAFE_INTEGER,
					});
				case "date":
					return fc.constantFrom("0001-01-01", "2024-02-29", "9999-12-31");
				case "enum":
					return fc.constantFrom(X64("a"), X64("b"), X64("c"));
			}
		};
		return fc
			.tuple(...types.map((type) => valueFor(type)))
			.map((values): Session => {
				const answers: Record<string, FactValue> = {};
				names.forEach((name, i) => {
					answers[name] = values[i] as FactValue;
				});
				return { kb, answers };
			});
	});

/** One edit of a token: change, insert or delete a single character. */
interface Edit {
	readonly kind: "change" | "insert" | "delete";
	readonly position: number;
	readonly char: string;
}

const editArb: fc.Arbitrary<Edit> = fc.record({
	kind: fc.constantFrom("change", "insert", "delete"),
	position: fc.nat(10_000),
	char: fc.constantFrom(...ALPHABET),
});

function applyEdit(token: string, edit: Edit): string {
	if (edit.kind === "insert") {
		const at = edit.position % (token.length + 1);
		return token.slice(0, at) + edit.char + token.slice(at);
	}
	const at = edit.position % token.length;
	if (edit.kind === "delete") return token.slice(0, at) + token.slice(at + 1);
	// A real change: pick a different character from the alphabet.
	const current = token[at] as string;
	const replacement =
		edit.char === current
			? (ALPHABET[(ALPHABET.indexOf(current) + 1) % ALPHABET.length] as string)
			: edit.char;
	return token.slice(0, at) + replacement + token.slice(at + 1);
}

const TRUE_LITERAL: Expr = { kind: "literal", type: "boolean", value: true };

type RuleField = "id" | "set" | "when" | "to" | "because" | "cite";

/** One rule with exactly one field different. */
function editRule(kb: KnowledgeBase, rule: Rule, field: RuleField): Rule {
	if (field === "id") return { ...rule, id: `${rule.id}_x` };
	if (field === "because") {
		return { ...rule, because: `${rule.because} (changed)` };
	}
	if (field === "cite") return { ...rule, cite: `${rule.cite}_x` };
	if (field === "set") {
		const other = Object.keys(kb.facts).find((n) => n !== rule.set);
		return { ...rule, set: other ?? `${rule.set}_x` };
	}
	if (field === "to") {
		return {
			...rule,
			to: { kind: "call", fn: "if", args: [TRUE_LITERAL, rule.to, rule.to] },
		};
	}
	if (rule.when === undefined) return { ...rule, when: TRUE_LITERAL };
	const { when: _dropped, ...rest } = rule;
	return rest;
}

/** The same knowledge base with exactly one field of one rule different. */
function mutateRule(
	kb: KnowledgeBase,
	index: number,
	field: RuleField,
): KnowledgeBase {
	return {
		...kb,
		rules: kb.rules.map((rule, i) =>
			i === index ? editRule(kb, rule, field) : rule,
		),
	};
}

/**
 * Guarantees at least one rule without `filter`: fast-check's `filter` on the
 * `fc.gen`-based `kbArb` never returns for some seeds (it exhausts the heap),
 * so a knowledge base with no rules gets one derived fact and one rule here.
 */
function withRule(kb: KnowledgeBase): KnowledgeBase {
	if (kb.rules.length > 0) return kb;
	const clauseId = Object.keys(kb.clauses)[0] ?? "c_extra";
	return {
		...kb,
		facts: { ...kb.facts, f_extra: { type: "boolean", derived: true } },
		clauses: {
			...kb.clauses,
			[clauseId]: kb.clauses[clauseId] ?? {
				id: clauseId,
				title: "Extra clause",
				text: "Extra text.",
			},
		},
		rules: [
			{
				id: "r_extra",
				cite: clauseId,
				set: "f_extra",
				to: TRUE_LITERAL,
				because: "Extra rule.",
			},
		],
	};
}

/** A knowledge base with at least one rule, the session, and one rule edit. */
const mismatchArb = kbArb
	.map(withRule)
	.chain((kb) =>
		fc.tuple(
			sessionArb(kb),
			fc.nat(kb.rules.length - 1),
			fc.constantFrom(
				...(["id", "set", "when", "to", "because", "cite"] as const),
			),
		),
	);

// ─── Properties ───────────────────────────────────────────────────────────

describe("Property 7: Replay", () => {
	/**
	 * Criteria 4 and 5 (round trip and inverse round trip), plus the token
	 * alphabet of Requirement 11, criterion 1.
	 * **Validates: Requirements 11.1, 11.4, 11.15, 11.16, 20.4, 20.5**
	 */
	it(
		"decode inverts encode, and encode inverts decode",
		() => {
			fc.assert(
				fc.property(scenarioArb, (session) => {
					const token = encode(session);
					expect(token).toMatch(TOKEN_PATTERN);
					const back = decode(session.kb, token);
					expect(back.kb).toBe(session.kb);
					expect(back).toStrictEqual(session);
					expect(encode(back)).toBe(token);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 5 and Requirement 11, criterion 12: 64 answers, names of 64
	 * characters and strings of 64 characters give a token of at most 2,048
	 * characters, and the round trip holds. Zero answers round-trip too.
	 * **Validates: Requirements 11.1, 11.12, 11.13, 11.15, 11.16, 20.5**
	 */
	it(
		"64 answers of 64 characters stay within 2,048 characters and round-trip",
		() => {
			fc.assert(
				fc.property(bigScenarioArb, (session) => {
					expect(Object.keys(session.answers)).toHaveLength(64);
					const token = encode(session);
					expect(token).toMatch(TOKEN_PATTERN);
					expect(token.length).toBeLessThanOrEqual(2048);
					const back = decode(session.kb, token);
					expect(back).toStrictEqual(session);
					expect(encode(back)).toBe(token);

					const empty: Session = { kb: session.kb, answers: {} };
					const emptyBack = decode(session.kb, encode(empty));
					expect(emptyBack).toStrictEqual(empty);
					expect(Object.keys(emptyBack.answers)).toHaveLength(0);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criteria 1, 2 and 3: `next`, `explain` (every declared fact) and `audit`
	 * give Deep_Equal results on the decoded Session. A call that throws an
	 * EngineError must throw the same code on both sides.
	 * **Validates: Requirements 11.4, 20.1, 20.2, 20.3**
	 */
	it(
		"next, explain and audit agree on the decoded session",
		() => {
			fc.assert(
				fc.property(scenarioArb, (session) => {
					const { kb } = session;
					const decoded = decode(kb, encode(session));
					expect(outcomeOf(() => next(decoded))).toStrictEqual(
						outcomeOf(() => next(session)),
					);
					expect(outcomeOf(() => audit(kb, decoded.answers))).toStrictEqual(
						outcomeOf(() => audit(kb, session.answers)),
					);
					for (const fact of Object.keys(kb.facts)) {
						expect(outcomeOf(() => explain(decoded, fact))).toStrictEqual(
							outcomeOf(() => explain(session, fact)),
						);
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 9: the order in which answers were added changes neither the
	 * token nor the `next` result. Orders are applied both through `answer`
	 * and through a hand-built `answers` object with shuffled keys.
	 * **Validates: Requirements 11.2, 11.11, 20.9**
	 */
	it(
		"answer order changes neither the token nor next",
		() => {
			const orderedArb = scenarioArb.chain((session) =>
				fc.tuple(
					fc.constant(session),
					fc.shuffledSubarray(Object.entries(session.answers), {
						minLength: Object.keys(session.answers).length,
						maxLength: Object.keys(session.answers).length,
					}),
				),
			);
			fc.assert(
				fc.property(orderedArb, ([session, shuffled]) => {
					const { kb } = session;
					const viaObject: Session = {
						kb,
						answers: Object.fromEntries(shuffled),
					};
					let viaAnswer: Session = { kb, answers: {} };
					for (const [fact, value] of shuffled) {
						viaAnswer = answer(viaAnswer, fact, value);
					}
					const token = encode(session);
					expect(encode(viaObject)).toBe(token);
					expect(encode(viaAnswer)).toBe(token);
					const expected = outcomeOf(() => next(session));
					expect(outcomeOf(() => next(viaObject))).toStrictEqual(expected);
					expect(outcomeOf(() => next(viaAnswer))).toStrictEqual(expected);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criteria 6 and 7: after one change, insertion or deletion, `decode` either
	 * returns a Session or throws an EngineError, and nothing else. A Session
	 * that comes back re-encodes to the edited token, and that token decodes to
	 * a Deep_Equal Session (Requirement 11, criteria 4 and 16).
	 * **Validates: Requirements 11.1, 11.4, 11.5, 11.15, 11.16, 20.6, 20.7**
	 */
	it(
		"a one-character edit decodes or throws an EngineError, and re-encodes to itself",
		() => {
			fc.assert(
				fc.property(
					fc.oneof(scenarioArb, bigScenarioArb),
					editArb,
					(session, edit) => {
						const edited = applyEdit(encode(session), edit);
						const result = tryDecode(session.kb, edited);
						if (typeof result === "string") return;
						const again = encode(result);
						expect(again).toBe(edited);
						expect(decode(session.kb, again)).toStrictEqual(result);
					},
				),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * The edit property would pass vacuously if every edit were rejected. Over
	 * many edits some must be accepted and some must be rejected.
	 * **Validates: Requirements 11.5, 20.6, 20.7**
	 */
	it(
		"edits reach both accepted and rejected tokens",
		() => {
			let accepted = 0;
			let rejected = 0;
			fc.assert(
				fc.property(
					fc.oneof(scenarioArb, bigScenarioArb),
					editArb,
					(session, edit) => {
						const result = tryDecode(
							session.kb,
							applyEdit(encode(session), edit),
						);
						if (typeof result === "string") rejected++;
						else accepted++;
					},
				),
				{ ...PARAMS, numRuns: 300 },
			);
			expect(accepted).toBeGreaterThan(0);
			expect(rejected).toBeGreaterThan(0);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criterion 8: a token made for one knowledge base never decodes against a
	 * knowledge base that differs in exactly one rule field.
	 * **Validates: Requirements 11.3, 11.7, 20.8**
	 */
	it(
		"a token for one knowledge base gives KB_MISMATCH against a one-rule-different one",
		() => {
			fc.assert(
				fc.property(mismatchArb, ([session, index, field]) => {
					const other = mutateRule(session.kb, index, field);
					if (JSON.stringify(other) === JSON.stringify(session.kb)) {
						throw new Error("generator produced an identical knowledge base");
					}
					const token = encode(session);
					let thrown: unknown;
					try {
						decode(other, token);
					} catch (error) {
						thrown = error;
					}
					expect(thrown).toBeInstanceOf(EngineError);
					expect((thrown as EngineError).code).toBe("KB_MISMATCH");
					expect((thrown as EngineError).message).toMatch(/rules have changed/);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"generates every fact type among the askable facts",
		() => {
			const seen = new Set<FactType>();
			fc.assert(
				fc.property(scenarioArb, (session) => {
					for (const name of askableFacts(session.kb)) {
						if (Object.hasOwn(session.answers, name)) {
							seen.add(session.kb.facts[name]?.type as FactType);
						}
					}
				}),
				{ ...PARAMS, numRuns: 200 },
			);
			expect([...seen].sort()).toEqual([...ALL_TYPES].sort());
		},
		TEST_TIMEOUT_MS,
	);
});
