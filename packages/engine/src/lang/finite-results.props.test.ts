// Feature: rule-language, Property 6: finite results
// Validates: Requirements 4.19, 4.20, 4.21, 4.22, 11.4

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Expr, FactValue, Unknown } from "../types";
import { UNKNOWN } from "../types";
import { type Env, type EvalErrorCode, evaluate } from "./evaluate";

// ─── Constants ────────────────────────────────────────────────────────────────

const GEN_DEPTH = 4;
const NUM_RUNS = 200;

const DOCUMENTED_CODES: readonly EvalErrorCode[] = [
	"DIVISION_BY_ZERO",
	"TYPE_MISMATCH",
	"NUMERIC_OVERFLOW",
	"UNKNOWN_ERROR",
];

const NUM_FACTS = ["n0", "n1", "n2"] as const;
const BOOL_FACTS = ["b0", "b1"] as const;
const DATE_FACTS = ["d0", "d1"] as const;

// ─── Leaf arbitraries ─────────────────────────────────────────────────────────

const numberValue: fc.Arbitrary<number> = fc.oneof(
	{
		weight: 4,
		arbitrary: fc.constantFrom(
			1e308,
			-1e308,
			Number.MAX_SAFE_INTEGER,
			-Number.MAX_SAFE_INTEGER,
			Number.MAX_VALUE,
			0,
			-0,
			1,
			-1,
			0.5,
			1e-7,
			5e-324,
			1e-300,
		),
	},
	{ weight: 2, arbitrary: fc.integer({ min: -1000, max: 1000 }) },
	{
		weight: 2,
		arbitrary: fc.double({ noNaN: true, noDefaultInfinity: true }),
	},
);

const dateValue: fc.Arbitrary<string> = fc.constantFrom(
	"2024-01-15",
	"2024-02-29",
	"2023-12-31",
	"2000-02-29",
	"0001-01-01",
	"9999-12-31",
	"1999-07-04",
);

const numLit: fc.Arbitrary<Expr> = numberValue.map(
	(value): Expr => ({ kind: "literal", type: "number", value }),
);
const boolLit: fc.Arbitrary<Expr> = fc
	.boolean()
	.map((value): Expr => ({ kind: "literal", type: "boolean", value }));
const dateLit: fc.Arbitrary<Expr> = dateValue.map(
	(value): Expr => ({ kind: "literal", type: "date", value }),
);
const factRef = (names: readonly string[]): fc.Arbitrary<Expr> =>
	fc.constantFrom(...names).map((name): Expr => ({ kind: "fact", name }));

// ─── Typed recursive arbitraries ──────────────────────────────────────────────

const call =
	(fn: "min" | "max" | "round" | "if" | "days_between") =>
	(...args: Expr[]): Expr => ({ kind: "call", fn, args });

const bin =
	(
		op:
			| "+"
			| "-"
			| "*"
			| "/"
			| "<"
			| "<="
			| ">"
			| ">="
			| "=="
			| "!="
			| "and"
			| "or",
	) =>
	(left: Expr, right: Expr): Expr => ({ kind: "binary", op, left, right });

interface Trio {
	num: fc.Arbitrary<Expr>;
	bool: fc.Arbitrary<Expr>;
	date: fc.Arbitrary<Expr>;
}

const treeCache = new Map<number, Trio>();

function tree(depth: number): Trio {
	const cached = treeCache.get(depth);
	if (cached) return cached;
	const built = buildTree(depth);
	treeCache.set(depth, built);
	return built;
}

function buildTree(depth: number): Trio {
	if (depth <= 0) {
		return {
			num: fc.oneof(numLit, factRef(NUM_FACTS)),
			bool: fc.oneof(boolLit, factRef(BOOL_FACTS)),
			date: fc.oneof(dateLit, factRef(DATE_FACTS)),
		};
	}
	const sub = () => tree(depth - 1);
	const num = fc.oneof(
		numLit,
		factRef(NUM_FACTS),
		fc
			.constantFrom("+", "-", "*", "/")
			.chain((op) =>
				fc.tuple(sub().num, sub().num).map(([l, r]) => bin(op)(l, r)),
			),
		// zero divisor emphasis
		sub().num.map((l) =>
			bin("/")(l, { kind: "literal", type: "number", value: 0 }),
		),
		sub().num.map((operand): Expr => ({ kind: "unary", op: "-", operand })),
		fc
			.tuple(fc.constantFrom("min", "max"), sub().num, sub().num)
			.map(([fn, a, b]) => call(fn)(a, b)),
		sub().num.map((a) => call("round")(a)),
		fc
			.tuple(sub().date, sub().date)
			.map(([a, b]) => call("days_between")(a, b)),
		fc
			.tuple(sub().bool, sub().num, sub().num)
			.map(([c, t, e]) => call("if")(c, t, e)),
	);
	const bool = fc.oneof(
		boolLit,
		factRef(BOOL_FACTS),
		fc
			.tuple(
				fc.constantFrom("<", "<=", ">", ">=", "==", "!="),
				sub().num,
				sub().num,
			)
			.map(([op, l, r]) => bin(op)(l, r)),
		fc
			.tuple(
				fc.constantFrom("<", "<=", ">", ">=", "==", "!="),
				sub().date,
				sub().date,
			)
			.map(([op, l, r]) => bin(op)(l, r)),
		fc
			.tuple(fc.constantFrom("and", "or"), sub().bool, sub().bool)
			.map(([op, l, r]) => bin(op)(l, r)),
		sub().bool.map((operand): Expr => ({ kind: "unary", op: "not", operand })),
		fc
			.tuple(sub().bool, sub().bool, sub().bool)
			.map(([c, t, e]) => call("if")(c, t, e)),
	);
	const date = fc.oneof(
		dateLit,
		factRef(DATE_FACTS),
		fc
			.tuple(sub().bool, sub().date, sub().date)
			.map(([c, t, e]) => call("if")(c, t, e)),
	);
	return { num, bool, date };
}

/** Any well-typed expression: numeric, boolean or date. */
const exprArbitrary: fc.Arbitrary<Expr> = fc.oneof(
	tree(GEN_DEPTH).num,
	tree(GEN_DEPTH).bool,
	tree(GEN_DEPTH).date,
);

// ─── Environment: some facts present, some absent (unknown) ───────────────────

function maybe<T extends FactValue>(
	a: fc.Arbitrary<T>,
): fc.Arbitrary<T | Unknown | undefined> {
	return fc.oneof(
		{ weight: 3, arbitrary: a },
		{ weight: 1, arbitrary: fc.constant(undefined) }, // absent
		{ weight: 1, arbitrary: fc.constant(UNKNOWN) }, // explicitly unknown
	);
}

const envArbitrary: fc.Arbitrary<Env> = fc
	.tuple(
		fc.tuple(...NUM_FACTS.map(() => maybe(numberValue))),
		fc.tuple(...BOOL_FACTS.map(() => maybe(fc.boolean()))),
		fc.tuple(...DATE_FACTS.map(() => maybe(dateValue))),
	)
	.map(([nums, bools, dates]) => {
		const env: Record<string, FactValue | Unknown> = {};
		const names = [...NUM_FACTS, ...BOOL_FACTS, ...DATE_FACTS];
		const values = [...nums, ...bools, ...dates];
		names.forEach((name, i) => {
			const v = values[i];
			if (v !== undefined) env[name] = v;
		});
		return env;
	});

// ─── Properties ───────────────────────────────────────────────────────────────

describe("Property 6: finite results", () => {
	it("evaluate never throws for well-typed expressions", () => {
		fc.assert(
			fc.property(exprArbitrary, envArbitrary, (expr, env) => {
				evaluate(expr, env);
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	it("an ok numeric result is always finite", () => {
		fc.assert(
			fc.property(exprArbitrary, envArbitrary, (expr, env) => {
				const result = evaluate(expr, env);
				if (result.ok && typeof result.value === "number") {
					return Number.isFinite(result.value);
				}
				return true;
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	it("a failed result carries a documented evaluation error code", () => {
		fc.assert(
			fc.property(exprArbitrary, envArbitrary, (expr, env) => {
				const result = evaluate(expr, env);
				if (!result.ok) {
					return DOCUMENTED_CODES.includes(result.error.code);
				}
				return true;
			}),
			{ numRuns: NUM_RUNS },
		);
	});

	it("regression: a chain of 1e308 multiplications is NUMERIC_OVERFLOW, not Infinity", () => {
		const big: Expr = { kind: "literal", type: "number", value: 1e308 };
		let expr: Expr = big;
		for (let i = 0; i < 5; i++) {
			expr = { kind: "binary", op: "*", left: expr, right: big };
		}
		const result = evaluate(expr, {});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe("NUMERIC_OVERFLOW");
	});
});
