// Feature: rule-language, Property 1: parser-printer round-trip
// Validates: Requirements 3.2, 7.3

import * as fc from "fast-check";
import { describe, it } from "vitest";
import type { Expr } from "../types";
import { parse } from "./parse";
import { print } from "./print";

// ─── Exported depth constants ─────────────────────────────────────────────────

export const DEFAULT_DEPTH = 3;
export const MAX_DEPTH = 5;

// ─── Valid fact names (identifiers, not reserved keywords) ───────────────────

const VALID_FACT_NAMES = fc.constantFrom(
	"a",
	"b",
	"x",
	"my_fact",
	"sum_insured",
	"claim_amount",
	"age",
	"rate",
);

// ─── Valid date strings ───────────────────────────────────────────────────────

const VALID_DATE_STRINGS = fc.constantFrom(
	"2024-01-15",
	"2024-03-15",
	"2000-02-29", // leap year
	"1999-12-31",
	"2023-07-04",
	"2010-10-10",
);

// ─── Valid enum values ────────────────────────────────────────────────────────

const VALID_ENUM_VALUES = fc.constantFrom("approved", "pending", "denied");

// ─── Arbitrary for literal nodes ─────────────────────────────────────────────
//
// Note: `money` type is excluded because the printer emits numbers for money
// literals but the parser always produces `type: "number"` — money literals
// cannot survive a print→parse round-trip.
//
// Number literals are constrained to non-negative integers so that:
//   1. toString() never produces scientific notation (safe lexer range).
//   2. Negative numbers would print as "-N" which the parser reads as a unary
//      node rather than a literal — only non-negative values round-trip as
//      literals.

const literalArbitrary: fc.Arbitrary<Expr> = fc.oneof(
	// boolean literal
	fc
		.boolean()
		.map((v): Expr => ({ kind: "literal", type: "boolean", value: v })),
	// number literal (non-negative integer to avoid scientific notation and
	// negative-literal ambiguity)
	fc
		.integer({ min: 0, max: 999999 })
		.map((v): Expr => ({ kind: "literal", type: "number", value: v })),
	// date literal
	VALID_DATE_STRINGS.map(
		(v): Expr => ({ kind: "literal", type: "date", value: v }),
	),
	// enum literal
	VALID_ENUM_VALUES.map(
		(v): Expr => ({ kind: "literal", type: "enum", value: v }),
	),
);

// ─── Recursive Expr arbitrary ─────────────────────────────────────────────────

function makeExprArbitrary(depth: number): fc.Arbitrary<Expr> {
	if (depth <= 0) {
		// Force terminals at depth 0
		return fc.oneof(
			literalArbitrary,
			VALID_FACT_NAMES.map((name): Expr => ({ kind: "fact", name })),
		);
	}

	const childArb = makeExprArbitrary(depth - 1);

	const unaryArb = fc
		.tuple(fc.constantFrom("not" as const, "-" as const), childArb)
		.map(([op, operand]): Expr => ({ kind: "unary", op, operand }));

	const binaryArb = fc
		.tuple(
			fc.constantFrom(
				"+" as const,
				"-" as const,
				"*" as const,
				"/" as const,
				"==" as const,
				"!=" as const,
				"<" as const,
				"<=" as const,
				">" as const,
				">=" as const,
				"and" as const,
				"or" as const,
			),
			childArb,
			childArb,
		)
		.map(([op, left, right]): Expr => ({ kind: "binary", op, left, right }));

	// call nodes: each builtin with its correct arity
	const callArb = fc.oneof(
		// min(a, b) — 2 args
		fc
			.tuple(childArb, childArb)
			.map(([a, b]): Expr => ({ kind: "call", fn: "min", args: [a, b] })),
		// max(a, b) — 2 args
		fc
			.tuple(childArb, childArb)
			.map(([a, b]): Expr => ({ kind: "call", fn: "max", args: [a, b] })),
		// round(a) — 1 arg
		childArb.map((a): Expr => ({ kind: "call", fn: "round", args: [a] })),
		// if(cond, then, else) — 3 args
		fc
			.tuple(childArb, childArb, childArb)
			.map(([c, t, e]): Expr => ({ kind: "call", fn: "if", args: [c, t, e] })),
		// days_between(a, b) — 2 args
		fc.tuple(childArb, childArb).map(
			([a, b]): Expr => ({
				kind: "call",
				fn: "days_between",
				args: [a, b],
			}),
		),
	);

	return fc.oneof(
		literalArbitrary,
		VALID_FACT_NAMES.map((name): Expr => ({ kind: "fact", name })),
		unaryArb,
		binaryArb,
		callArb,
	);
}

// Build the main arbitrary at DEFAULT_DEPTH
const exprArbitrary = makeExprArbitrary(DEFAULT_DEPTH);

// ─── Deep equality for Expr nodes ────────────────────────────────────────────

function deepEqual(a: Expr, b: Expr): boolean {
	if (a.kind !== b.kind) return false;

	switch (a.kind) {
		case "literal": {
			const bLit = b as Extract<Expr, { kind: "literal" }>;
			if (a.type !== bLit.type) return false;
			// Use Object.is to distinguish +0/-0 and handle NaN (though NaN
			// is excluded from the generator)
			return Object.is(a.value, bLit.value);
		}

		case "fact": {
			const bFact = b as Extract<Expr, { kind: "fact" }>;
			return a.name === bFact.name;
		}

		case "unary": {
			const bUnary = b as Extract<Expr, { kind: "unary" }>;
			return a.op === bUnary.op && deepEqual(a.operand, bUnary.operand);
		}

		case "binary": {
			const bBin = b as Extract<Expr, { kind: "binary" }>;
			return (
				a.op === bBin.op &&
				deepEqual(a.left, bBin.left) &&
				deepEqual(a.right, bBin.right)
			);
		}

		case "call": {
			const bCall = b as Extract<Expr, { kind: "call" }>;
			if (a.fn !== bCall.fn) return false;
			if (a.args.length !== bCall.args.length) return false;
			for (let i = 0; i < a.args.length; i++) {
				if (!deepEqual(a.args[i] as Expr, bCall.args[i] as Expr)) return false;
			}
			return true;
		}

		default:
			return false;
	}
}

// ─── Property test ────────────────────────────────────────────────────────────

describe("Property 1: parser–printer round-trip", () => {
	it("parse(print(expr)) succeeds and reconstructs the original expression", () => {
		// **Property 1: Parser–Printer round-trip**
		// **Validates: Requirements 3.2, 7.3**
		fc.assert(
			fc.property(exprArbitrary, (expr) => {
				const printed = print(expr);
				const result = parse(printed);
				if (!result.ok) return false;
				return deepEqual(result.expr, expr);
			}),
			{ numRuns: 100 },
		);
	});
});
