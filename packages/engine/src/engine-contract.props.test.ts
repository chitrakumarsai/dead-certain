// Properties 9, 10 and 13 (Requirements 1.9, 1.10, 3.1 to 3.10, 4.14 to 4.16,
// 8.2, 8.3, 8.10, 10.18, 11.5 to 11.10, 12.3, 12.6 to 12.8, 13.1 to 13.8).

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { answer, audit, explain, next, start, whatIf } from "./api";
import { decode, encode } from "./codec/encode";
import { EngineError } from "./errors";
import { parse } from "./lang/parse";
import { cyclicKbArb, deepFreeze, kbArb, sessionArb } from "./testkit";
import type {
	Expr,
	FactDef,
	FactType,
	FactValue,
	KnowledgeBase,
	Rule,
	Session,
} from "./types";
import { UNKNOWN } from "./types";

const NUM_RUNS = 100;
const TEST_TIMEOUT_MS = 60_000;

/** Bounded so that a failing property reports cleanly (shrinking included). */
const PARAMS: fc.Parameters<unknown> = {
	numRuns: NUM_RUNS,
	endOnFailure: true,
	interruptAfterTimeLimit: 40_000,
};

const ERROR_CODES: readonly string[] = [
	"INVALID_KB",
	"CYCLE",
	"UNKNOWN_FACT",
	"NOT_ANSWERABLE",
	"INVALID_ANSWER",
	"EVALUATION_ERROR",
	"NON_INTEGER_MONEY",
	"MALFORMED_TOKEN",
	"UNSUPPORTED_VERSION",
	"KB_MISMATCH",
];

// ─── Shared helpers ────────────────────────────────────────────────────────

type Outcome =
	| { readonly ok: true; readonly value: unknown }
	| { readonly ok: false; readonly error: EngineError };

/** Runs `fn`; only an EngineError is accepted, anything else is rethrown. */
function attempt(fn: () => unknown): Outcome {
	try {
		return { ok: true, value: fn() };
	} catch (e) {
		if (e instanceof EngineError) return { ok: false, error: e };
		throw e;
	}
}

/** Requirement 13, criteria 1 to 3 and 6: the shape every error must have. */
function expectWellFormed(error: EngineError, label: string): void {
	expect(error, label).toBeInstanceOf(EngineError);
	expect(ERROR_CODES, label).toContain(error.code);
	expect(typeof error.message, label).toBe("string");
	expect(error.message.length, label).toBeGreaterThan(0);
	expect(error.message.length, label).toBeLessThanOrEqual(500);
	const round = JSON.parse(JSON.stringify(error)) as {
		code: unknown;
		message: unknown;
	};
	expect(round.code, label).toBe(error.code);
	expect(round.message, label).toBe(error.message);
}

function expectError(
	outcome: Outcome,
	code: string,
	name: string | undefined,
	label: string,
): void {
	if (outcome.ok) {
		throw new Error(`${label}: expected ${code}, but the call returned`);
	}
	expectWellFormed(outcome.error, label);
	expect(outcome.error.code, label).toBe(code);
	if (name !== undefined) {
		expect(outcome.error.message, label).toContain(name);
	}
}

/** A snapshot that survives freezing (no symbols in the inputs used here). */
function snapshot<T>(value: T): T {
	return structuredClone(value);
}

function entriesToRecord(
	entries: readonly (readonly [string, FactValue])[],
): Record<string, FactValue> {
	return Object.fromEntries(entries);
}

const sessionWithKbArb: fc.Arbitrary<Session> = kbArb.chain((kb) =>
	sessionArb(kb),
);

// ─── Property 9: Inputs are never changed ──────────────────────────────────

describe("Property 9: Inputs are never changed", () => {
	// Feature: inference-engine, Property 9: Inputs are never changed
	// **Validates: Requirements 1.9, 1.10, 3.1, 3.2, 3.3, 8.10, 13.5**
	it(
		"deep-frozen inputs never raise a TypeError and are never altered",
		() => {
			fc.assert(
				fc.property(sessionWithKbArb, (generated) => {
					const frozen = deepFreeze(snapshot(generated));
					expect(Object.isFrozen(frozen.kb)).toBe(true);
					expect(Object.isFrozen(frozen.answers)).toBe(true);
					const before = snapshot(generated);
					const unchanged = (label: string) => {
						expect(frozen, label).toStrictEqual(before);
					};

					const startOne = attempt(() => start(frozen.kb));
					unchanged("start");
					const startTwo = attempt(() => start(frozen.kb));
					if (startOne.ok && startTwo.ok) {
						const a = startOne.value as Session;
						const b = startTwo.value as Session;
						expect(a.kb).toBe(frozen.kb);
						expect(a.answers).not.toBe(b.answers);
					}

					attempt(() => next(frozen));
					unchanged("next");
					attempt(() => audit(frozen.kb, frozen.answers));
					unchanged("audit");
					attempt(() => whatIf(frozen));
					unchanged("whatIf");
					const token = attempt(() => encode(frozen));
					unchanged("encode");
					const facts = [
						...new Set([
							...frozen.kb.goals,
							...Object.keys(frozen.kb.facts).slice(0, 4),
						]),
					];
					for (const fact of facts) {
						attempt(() => explain(frozen, fact));
						unchanged(`explain ${fact}`);
					}
					if (token.ok) {
						attempt(() => decode(frozen.kb, token.value as string));
						unchanged("decode");
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"answer on a frozen Session returns a fresh, unshared Session and leaves its input alone",
		() => {
			const case_ = sessionWithKbArb.chain((s) => {
				const names = Object.keys(s.kb.facts).filter(
					(n) => (s.kb.facts[n] as FactDef).derived !== true,
				);
				return names.length === 0
					? fc.constant(undefined)
					: fc.constantFrom(...names).chain((name) =>
							valueArbForDef(s.kb.facts[name] as FactDef).map((value) => ({
								s,
								name,
								value,
							})),
						);
			});
			fc.assert(
				fc.property(case_, (c) => {
					if (c === undefined) return;
					const frozen = deepFreeze(snapshot(c.s));
					const before = snapshot(c.s);
					const out = answer(frozen, c.name, c.value);
					expect(frozen).toStrictEqual(before);
					expect(out.answers).not.toBe(frozen.answers);
					expect(Object.isFrozen(out.answers)).toBe(false);
					expect(out.answers[c.name]).toBe(c.value);
					for (const [k, v] of Object.entries(frozen.answers)) {
						if (k !== c.name) expect(out.answers[k]).toBe(v);
					}
					// Writing to the result must not reach the input.
					(out.answers as Record<string, FactValue>).probe_fact = true;
					expect(frozen).toStrictEqual(before);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);
});

function valueArbForDef(def: FactDef): fc.Arbitrary<FactValue> {
	switch (def.type) {
		case "boolean":
			return fc.boolean();
		case "number":
			return fc.integer({ min: -1000, max: 1000 });
		case "money":
			return fc.integer({ min: 0, max: 2_000_000 });
		case "date":
			return fc
				.tuple(
					fc.integer({ min: 1990, max: 2035 }),
					fc.integer({ min: 1, max: 12 }),
					fc.integer({ min: 1, max: 28 }),
				)
				.map(
					([y, m, d]) =>
						`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
				);
		case "enum":
			return fc.constantFrom(...(def.options ?? ["opt_a"]));
	}
}

// ─── Property 10: oracle for the validity of one answer ────────────────────

/** Independent oracle: written from Requirement 3, criterion 7, sharing no code. */
function oracleValid(
	type: FactType,
	options: readonly string[],
	v: unknown,
): boolean {
	switch (type) {
		case "boolean":
			return v === true || v === false;
		case "number":
			return typeof v === "number" && v - v === 0; // false for NaN and ±Infinity
		case "money":
			return (
				typeof v === "number" &&
				Math.floor(v) === v &&
				Math.abs(v) <= 9_007_199_254_740_991
			);
		case "date": {
			if (typeof v !== "string") return false;
			const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(v);
			if (m === null) return false;
			const y = Number(m[1]);
			const mo = Number(m[2]);
			const d = Number(m[3]);
			if (y < 1 || mo < 1 || mo > 12 || d < 1) return false;
			const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
			const longest = [
				31,
				leap ? 29 : 28,
				31,
				30,
				31,
				30,
				31,
				31,
				30,
				31,
				30,
				31,
			];
			return d <= (longest[mo - 1] as number);
		}
		case "enum":
			return typeof v === "string" && options.indexOf(v) >= 0;
	}
}

const ENUM_OPTIONS = ["Alpha", "beta", "GAMMA"] as const;

function singleFactKb(type: FactType): KnowledgeBase {
	const def: FactDef =
		type === "enum"
			? { type, ask: "Q?", options: ENUM_OPTIONS }
			: { type, ask: "Q?" };
	return {
		id: "single",
		goals: ["f"],
		facts: { f: def },
		rules: [],
		clauses: {},
	};
}

const nearDateArb = fc
	.tuple(
		fc.integer({ min: 0, max: 10_000 }),
		fc.integer({ min: 0, max: 14 }),
		fc.integer({ min: 0, max: 33 }),
	)
	.map(
		([y, m, d]) =>
			`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
	);

/** Values of every kind: valid, near-valid and never valid. */
const rawValueArb: fc.Arbitrary<unknown> = fc.oneof(
	{ weight: 3, arbitrary: fc.boolean() },
	{ weight: 3, arbitrary: fc.double() },
	{ weight: 3, arbitrary: fc.integer({ min: -5000, max: 5000 }) },
	{
		weight: 2,
		arbitrary: fc.constantFrom(
			Number.NaN,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
			-0,
			1.5,
			2 ** 53,
			-(2 ** 53),
			Number.MAX_SAFE_INTEGER,
			Number.MIN_SAFE_INTEGER,
			Number.MAX_VALUE,
		),
	},
	{ weight: 4, arbitrary: nearDateArb },
	{
		weight: 3,
		arbitrary: fc.constantFrom(
			"2025-02-30",
			"2024-02-29",
			"2023-02-29",
			"1900-02-29",
			"2000-02-29",
			"0000-01-01",
			"0001-01-01",
			"9999-12-31",
			"2025-1-01",
			" 2025-01-01",
			"2025-01-01\n",
			"2025/01/01",
		),
	},
	{ weight: 4, arbitrary: fc.constantFrom(...ENUM_OPTIONS) },
	{
		weight: 3,
		arbitrary: fc.constantFrom("alpha", "BETA", "gamma", "Alpha ", "", "Delta"),
	},
	{ weight: 2, arbitrary: fc.string() },
	{
		weight: 2,
		arbitrary: fc.constantFrom(
			undefined,
			null,
			UNKNOWN,
			Symbol("x"),
			Symbol.for("dead-certain.unknown"),
			10n,
			{},
			[],
			[1],
			{ value: 1 },
		),
	},
);

describe("Property 10: Invalid input gives a typed error, in a fixed order", () => {
	// Feature: inference-engine, Property 10: Invalid input gives a typed error, in a fixed order
	// **Validates: Requirements 3.6, 3.7, 3.8, 8.2, 8.3, 10.18, 12.6, 12.7, 12.8, 13.1, 13.2, 13.3, 13.6**
	it(
		"the validity of one answer matches an independent oracle for all five types, in every function",
		() => {
			const types: FactType[] = ["boolean", "number", "money", "date", "enum"];
			fc.assert(
				fc.property(fc.constantFrom(...types), rawValueArb, (type, raw) => {
					const kb = singleFactKb(type);
					const value = raw as FactValue;
					const valid = oracleValid(type, ENUM_OPTIONS, raw);
					const answers = { f: value };
					const session: Session = { kb, answers };
					const calls: Record<string, () => unknown> = {
						answer: () => answer(start(kb), "f", value),
						next: () => next(session),
						audit: () => audit(kb, answers),
						explain: () => explain(session, "f"),
						whatIf: () => whatIf(session),
						encode: () => encode(session),
					};
					for (const [label, run] of Object.entries(calls)) {
						const outcome = attempt(run);
						if (valid) {
							expect(
								outcome.ok,
								`${label} should accept ${String(value)}`,
							).toBe(true);
						} else {
							expectError(outcome, "INVALID_ANSWER", "f", label);
						}
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	// Feature: inference-engine, Property 10: decode returns a Session or throws an EngineError
	// **Validates: Requirements 11.5, 11.6, 11.8, 11.9, 11.10, 13.8**
	it(
		"decode of any string returns a Session or throws an EngineError",
		() => {
			const tokenAlphabet = fc.stringMatching(/^[A-Za-z0-9_-]{0,120}$/);
			const edited = sessionWithKbArb.chain((s) => {
				const t = attempt(() => encode(s));
				const token = t.ok ? (t.value as string) : "";
				return fc
					.tuple(
						fc.nat(Math.max(token.length, 1)),
						fc.constantFrom("A", "-", "_", "0", "~", " ", "\u00e9"),
						fc.constantFrom("edit", "insert", "delete", "truncate"),
					)
					.map(([i, ch, mode]) => {
						const at = Math.min(i, token.length);
						const text =
							mode === "edit"
								? token.slice(0, at) + ch + token.slice(at + 1)
								: mode === "insert"
									? token.slice(0, at) + ch + token.slice(at)
									: mode === "delete"
										? token.slice(0, at) + token.slice(at + 1)
										: token.slice(0, at);
						return { kb: s.kb, text };
					});
			});
			const plain = fc
				.tuple(
					kbArb,
					fc.oneof(fc.string(), fc.string({ unit: "binary" }), tokenAlphabet),
				)
				.map(([kb, text]) => ({ kb, text }));
			fc.assert(
				fc.property(fc.oneof(plain, edited), ({ kb, text }) => {
					const outcome = attempt(() => decode(kb, text));
					if (!outcome.ok) expectWellFormed(outcome.error, "decode");
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	// Feature: inference-engine, Property 10: CYCLE names the facts on the cycle
	// **Validates: Requirements 2.4, 2.6, 13.3**
	it(
		"a dependency cycle gives CYCLE from every function, naming facts that lie on a cycle",
		() => {
			fc.assert(
				fc.property(cyclicKbArb, (kb) => {
					const onCycle = factsOnCycles(kb);
					expect(onCycle.size).toBeGreaterThan(0);
					const names = Object.keys(kb.facts);
					const session: Session = { kb, answers: {} };
					const calls: Record<string, () => unknown> = {
						start: () => start(kb),
						next: () => next(session),
						audit: () => audit(kb, {}),
						whatIf: () => whatIf(session),
						encode: () => encode(session),
						answer: () => answer(session, names[0] ?? "f0", true),
					};
					if (names[0] !== undefined) {
						calls.explain = () => explain(session, names[0] as string);
					}
					let reference: string | undefined;
					for (const [label, run] of Object.entries(calls)) {
						const outcome = attempt(run);
						expectError(outcome, "CYCLE", undefined, label);
						if (outcome.ok) continue;
						const msg = outcome.error.message;
						const named = msg
							.slice(msg.indexOf(":") + 1)
							.replace(/\.\s*$/, "")
							.split(",")
							.map((s) => s.trim())
							.filter((s) => s !== "");
						expect(named.length, label).toBeGreaterThan(0);
						for (const n of named) {
							expect(onCycle.has(n), `${label}: ${n} is on no cycle`).toBe(
								true,
							);
						}
						reference ??= msg;
						expect(msg, label).toBe(reference);
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);
});

/** Independent reference: facts that can reach themselves through rules. */
function factsOnCycles(kb: KnowledgeBase): Set<string> {
	const deps = new Map<string, Set<string>>();
	const refs = (e: Expr, into: Set<string>): void => {
		switch (e.kind) {
			case "literal":
				return;
			case "fact":
				into.add(e.name);
				return;
			case "unary":
				refs(e.operand, into);
				return;
			case "binary":
				refs(e.left, into);
				refs(e.right, into);
				return;
			case "call":
				for (const a of e.args) refs(a, into);
		}
	};
	for (const rule of kb.rules) {
		const set = deps.get(rule.set) ?? new Set<string>();
		refs(rule.to, set);
		if (rule.when !== undefined) refs(rule.when, set);
		deps.set(rule.set, set);
	}
	const result = new Set<string>();
	for (const start_ of deps.keys()) {
		const seen = new Set<string>();
		const stack = [...(deps.get(start_) ?? [])];
		while (stack.length > 0) {
			const n = stack.pop() as string;
			if (n === start_) {
				result.add(start_);
				break;
			}
			if (seen.has(n)) continue;
			seen.add(n);
			for (const m of deps.get(n) ?? []) stack.push(m);
		}
	}
	return result;
}

// ─── Property 10: fixed error order ────────────────────────────────────────

interface Faults {
	readonly goal: boolean;
	readonly set: boolean;
	readonly cycle: boolean;
	readonly unknown: boolean;
	readonly derived: boolean;
	readonly invalid: boolean;
}

const faultsArb: fc.Arbitrary<Faults> = fc.record({
	goal: fc.boolean(),
	set: fc.boolean(),
	cycle: fc.boolean(),
	unknown: fc.boolean(),
	derived: fc.boolean(),
	invalid: fc.boolean(),
});

const ghostNameArb = fc.constantFrom(
	"ghost_fact",
	"__proto__",
	"constructor",
	"toString",
);

interface Expected {
	readonly code: string;
	readonly name: string;
}

function invalidFor(def: FactDef): FactValue {
	switch (def.type) {
		case "boolean":
			return "yes";
		case "number":
			return Number.NaN;
		case "money":
			return 1.5;
		case "date":
			return "2025-02-30";
		case "enum":
			return "NOT_AN_OPTION";
	}
}

/** Adds the requested Knowledge_Base faults; returns the first one in order. */
function injectKbFaults(
	kb: KnowledgeBase,
	f: Faults,
	ghost: string,
): { kb: KnowledgeBase; expected: Expected | undefined } {
	const cite = Object.keys(kb.clauses)[0] ?? "c0";
	const goals = f.goal ? [...kb.goals, `${ghost}_goal`] : kb.goals;
	let facts = kb.facts;
	let rules: readonly Rule[] = kb.rules;
	if (f.set) {
		rules = [
			...rules,
			{
				id: "r_ghost_set",
				cite,
				set: `${ghost}_target`,
				to: { kind: "literal", type: "boolean", value: true },
				because: "Ghost.",
			},
		];
	}
	if (f.cycle) {
		facts = { ...facts, cyc_fact: { type: "boolean", derived: true } };
		rules = [
			...rules,
			{
				id: "r_cyc",
				cite,
				set: "cyc_fact",
				to: { kind: "fact", name: "cyc_fact" },
				because: "Loop.",
			},
		];
	}
	const expected: Expected | undefined = f.goal
		? { code: "INVALID_KB", name: `${ghost}_goal` }
		: f.set
			? { code: "INVALID_KB", name: "r_ghost_set" }
			: f.cycle
				? { code: "CYCLE", name: "cyc_fact" }
				: undefined;
	return { kb: { ...kb, goals, facts, rules }, expected };
}

/** Adds the requested answer faults; returns the first one in order. */
function injectAnswerFaults(
	kb: KnowledgeBase,
	answers: Readonly<Record<string, FactValue>>,
	f: Faults,
	ghost: string,
): {
	answers: Record<string, FactValue>;
	expected: Expected | undefined;
	single: { name: string; value: FactValue } | undefined;
} {
	const names = Object.keys(kb.facts);
	const askable = names.filter(
		(n) => (kb.facts[n] as FactDef).derived !== true,
	);
	const derived = names.filter(
		(n) => (kb.facts[n] as FactDef).derived === true,
	);
	const entries: [string, FactValue][] = Object.entries(answers);
	const put = (name: string, value: FactValue) => {
		const i = entries.findIndex(([n]) => n === name);
		if (i >= 0) entries[i] = [name, value];
		else entries.push([name, value]);
	};
	let expected: Expected | undefined;
	let single: { name: string; value: FactValue } | undefined;
	const first = (e: Expected, name: string, value: FactValue) => {
		if (expected === undefined) {
			expected = e;
			single = { name, value };
		}
	};
	if (f.unknown) {
		put(ghost, true);
		first({ code: "UNKNOWN_FACT", name: ghost }, ghost, true);
	}
	const d = derived[0];
	if (f.derived && d !== undefined) {
		put(d, true);
		first({ code: "NOT_ANSWERABLE", name: d }, d, true);
	}
	const a = askable[0];
	if (f.invalid && a !== undefined) {
		const bad = invalidFor(kb.facts[a] as FactDef);
		put(a, bad);
		first({ code: "INVALID_ANSWER", name: a }, a, bad);
	}
	return { answers: entriesToRecord(entries), expected, single };
}

/** A small Knowledge_Base whose goal raises EVALUATION_ERROR when x is 0. */
function evalKb(): KnowledgeBase {
	const to = parse("100 / x");
	if (!to.ok) throw new Error("evalKb: parse failed");
	return {
		id: "eval-kb",
		goals: ["g"],
		facts: {
			x: { type: "number", ask: "x?" },
			g: { type: "number", derived: true },
		},
		rules: [
			{ id: "r_div", cite: "c1", set: "g", to: to.expr, because: "Div." },
		],
		clauses: { c1: { id: "c1", title: "C", text: "T" } },
	};
}

interface Scenario {
	readonly kb: KnowledgeBase;
	readonly answers: Record<string, FactValue>;
	readonly explainFact: string | undefined;
	/** Code expected from the functions that evaluate rules, absent faults aside. */
	readonly baseline: Expected | undefined;
}

const generatedScenarioArb: fc.Arbitrary<{
	base: Session;
	faults: Faults;
	ghost: string;
	scenario: "generated";
}> = fc.record({
	base: sessionWithKbArb,
	faults: faultsArb,
	ghost: ghostNameArb,
	scenario: fc.constant("generated" as const),
});

const evalScenarioArb = fc.record({
	base: fc.constant<Session>({ kb: evalKb(), answers: { x: 0 } }),
	faults: faultsArb,
	ghost: ghostNameArb,
	scenario: fc.constant("eval" as const),
});

describe("Property 10 (order): validation runs before rule evaluation", () => {
	// Feature: inference-engine, Property 10: Invalid input gives a typed error, in a fixed order
	// Also Property 9 on the error path: frozen inputs, only EngineError, nothing changed.
	// **Validates: Requirements 1.9, 1.10, 2.5, 2.6, 3.9, 3.10, 13.5, 13.7**
	it(
		"INVALID_KB, CYCLE, UNKNOWN_FACT, NOT_ANSWERABLE, INVALID_ANSWER, then evaluation errors",
		() => {
			fc.assert(
				fc.property(
					fc.oneof(generatedScenarioArb, evalScenarioArb),
					({ base, faults, ghost, scenario }) => {
						const kbPart = injectKbFaults(base.kb, faults, ghost);
						const ansPart = injectAnswerFaults(
							base.kb,
							base.answers,
							faults,
							ghost,
						);
						const s: Scenario = {
							kb: kbPart.kb,
							answers: ansPart.answers,
							explainFact:
								scenario === "eval" ? "g" : Object.keys(base.kb.facts)[0],
							baseline:
								scenario === "eval"
									? { code: "EVALUATION_ERROR", name: "r_div" }
									: undefined,
						};
						const kb = deepFreeze(snapshot(s.kb));
						const answers = deepFreeze(snapshot(s.answers));
						const before = snapshot({ kb: s.kb, answers: s.answers });
						const session: Session = { kb, answers };
						const afterwards = (label: string) => {
							expect({ kb, answers }, label).toStrictEqual(before);
						};

						const kbExpected = kbPart.expected;
						const evalExpected = kbExpected ?? ansPart.expected ?? s.baseline;

						// start looks at the Knowledge_Base only.
						const startOut = attempt(() => start(kb));
						afterwards("start");
						if (kbExpected !== undefined) {
							expectError(startOut, kbExpected.code, kbExpected.name, "start");
						} else {
							expect(startOut.ok, "start").toBe(true);
						}

						// answer sees the Knowledge_Base, then one answer.
						const answerExpected = kbExpected ?? ansPart.expected;
						if (answerExpected !== undefined && ansPart.single !== undefined) {
							const one = ansPart.single;
							const out = attempt(() =>
								answer({ kb, answers: {} }, one.name, one.value),
							);
							afterwards("answer");
							expectError(
								out,
								answerExpected.code,
								answerExpected.name,
								"answer",
							);
						}

						// Functions that validate but do not evaluate rules.
						const validating: Record<string, () => unknown> = {
							encode: () => encode(session),
						};
						// Functions that also resolve rules.
						const evaluating: Record<string, () => unknown> = {
							next: () => next(session),
							audit: () => audit(kb, answers),
							whatIf: () => whatIf(session),
						};
						if (s.explainFact !== undefined) {
							const fact = s.explainFact;
							evaluating.explain = () => explain(session, fact);
						}
						const validationExpected = kbExpected ?? ansPart.expected;
						for (const [label, run] of Object.entries(validating)) {
							const out = attempt(run);
							afterwards(label);
							if (validationExpected !== undefined) {
								expectError(
									out,
									validationExpected.code,
									validationExpected.name,
									label,
								);
							}
						}
						for (const [label, run] of Object.entries(evaluating)) {
							const out = attempt(run);
							afterwards(label);
							if (evalExpected !== undefined) {
								expectError(out, evalExpected.code, evalExpected.name, label);
							}
						}
					},
				),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	// Feature: inference-engine, Property 10: explain of a fact that is not in the Knowledge_Base
	// **Validates: Requirements 3.4, 13.3**
	it(
		"explain of an unknown fact name gives UNKNOWN_FACT naming it",
		() => {
			fc.assert(
				fc.property(sessionWithKbArb, ghostNameArb, (s, ghost) => {
					const out = attempt(() => explain(deepFreeze(snapshot(s)), ghost));
					expectError(out, "UNKNOWN_FACT", ghost, "explain");
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);
});

// ─── Property 13: Money is whole paise ─────────────────────────────────────

const MULTIPLIERS: readonly number[] = [
	0.01, 0.5, 0.25, 0.125, 0.333, 0.075, 0.9, 1, 2, 3, 10, 1.5, 0.001, 12.5,
];

type RuleShape = "plain" | "guarded" | "shadowed";

function moneyRule(id: string, to: string, when: string | undefined): Rule {
	const t = parse(to);
	if (!t.ok) throw new Error(`parse failed: ${to}`);
	const base = { id, cite: "c1", set: "fee", to: t.expr, because: "Fee." };
	if (when === undefined) return base;
	const w = parse(when);
	if (!w.ok) throw new Error(`parse failed: ${when}`);
	return { ...base, when: w.expr };
}

function moneyKb(shape: RuleShape, product: string): KnowledgeBase {
	const rules: Rule[] =
		shape === "plain"
			? [moneyRule("r_fee", product, undefined)]
			: shape === "guarded"
				? [moneyRule("r_fee", product, "flag")]
				: [
						moneyRule("r_zero", "0", "flag"),
						moneyRule("r_fee", product, undefined),
					];
	return {
		id: "money-kb",
		goals: ["fee"],
		facts: {
			sum_insured: { type: "money", ask: "Sum insured?" },
			flag: { type: "boolean", ask: "Flag?" },
			fee: { type: "money", derived: true },
		},
		rules,
		clauses: { c1: { id: "c1", title: "Clause", text: "Text" } },
	};
}

describe("Property 13: Money is whole paise", () => {
	// Feature: inference-engine, Property 13: Money is whole paise
	// **Validates: Requirements 4.14, 4.15, 4.16, 13.7**
	it(
		"sum_insured * c throws NON_INTEGER_MONEY exactly when the deciding rule gives a fraction; round(...) never throws",
		() => {
			fc.assert(
				fc.property(
					fc.constantFrom<RuleShape>("plain", "guarded", "shadowed"),
					fc.constantFrom(...MULTIPLIERS),
					fc.option(fc.integer({ min: 0, max: 2_000_000 }), { nil: undefined }),
					fc.option(fc.boolean(), { nil: undefined }),
					(shape, c, sumInsured, flag) => {
						const answers: Record<string, FactValue> = {};
						if (sumInsured !== undefined) answers.sum_insured = sumInsured;
						if (flag !== undefined) answers.flag = flag;

						// Is the rule `sum_insured * c` the deciding rule?
						const reached =
							shape === "plain" ||
							(shape === "guarded" && flag === true) ||
							(shape === "shadowed" && flag === false);
						const product =
							sumInsured === undefined ? undefined : sumInsured * c;
						const fraction =
							reached && product !== undefined && !Number.isInteger(product);

						const plain = moneyKb(shape, `sum_insured * ${c}`);
						const session: Session = { kb: plain, answers };
						const calls: Record<string, () => unknown> = {
							next: () => next(session),
							audit: () => audit(plain, answers),
							explain: () => explain(session, "fee"),
							whatIf: () => whatIf(session),
						};
						for (const [label, run] of Object.entries(calls)) {
							const out = attempt(run);
							if (fraction) {
								expectError(out, "NON_INTEGER_MONEY", "r_fee", label);
								if (!out.ok) expect(out.error.message, label).toContain("fee");
							} else {
								expect(out.ok, `${label} must not throw`).toBe(true);
							}
						}

						const rounded = moneyKb(shape, `round(sum_insured * ${c})`);
						const verdict = audit(rounded, answers);
						expect(next({ kb: rounded, answers }).kind).toBeDefined();
						if (reached && sumInsured !== undefined) {
							const fee = verdict.goals.fee;
							expect(Number.isInteger(fee), `fee ${String(fee)}`).toBe(true);
						}
						expect(() =>
							explain({ kb: rounded, answers }, "fee"),
						).not.toThrow();
						expect(() => whatIf({ kb: rounded, answers })).not.toThrow();
					},
				),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);
});
