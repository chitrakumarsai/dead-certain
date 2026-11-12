import { describe, expect, it } from "vitest";
import type { BinaryOp, BuiltinFn, Expr } from "../types";
import { print } from "./print";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fact(name: string): Expr {
	return { kind: "fact", name };
}

function numLit(value: number): Expr {
	return { kind: "literal", type: "number", value };
}

function bin(op: BinaryOp, left: Expr, right: Expr): Expr {
	return { kind: "binary", op, left, right };
}

function call(fn: BuiltinFn, ...args: Expr[]): Expr {
	return { kind: "call", fn, args };
}

function unary(op: "not" | "-", operand: Expr): Expr {
	return { kind: "unary", op, operand };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("printer", () => {
	describe("literals", () => {
		it("formats a decimal number without trailing zeros: 1.5", () => {
			expect(print({ kind: "literal", type: "number", value: 1.5 })).toBe(
				"1.5",
			);
		});

		it("formats an integer-valued number without a decimal point: 2", () => {
			expect(print({ kind: "literal", type: "number", value: 2 })).toBe("2");
		});

		it("formats a larger integer: 42", () => {
			expect(print({ kind: "literal", type: "number", value: 42 })).toBe("42");
		});

		it("wraps a date value in double quotes", () => {
			expect(
				print({ kind: "literal", type: "date", value: "2024-03-15" }),
			).toBe('"2024-03-15"');
		});

		it("wraps an enum value in single quotes", () => {
			expect(print({ kind: "literal", type: "enum", value: "approved" })).toBe(
				"'approved'",
			);
		});

		it("prints boolean true", () => {
			expect(print({ kind: "literal", type: "boolean", value: true })).toBe(
				"true",
			);
		});

		it("prints boolean false", () => {
			expect(print({ kind: "literal", type: "boolean", value: false })).toBe(
				"false",
			);
		});
	});

	describe("fact names", () => {
		it("prints the fact name verbatim", () => {
			expect(print({ kind: "fact", name: "sum_insured" })).toBe("sum_insured");
		});
	});

	describe("parenthesisation", () => {
		it("adds parens around lower-precedence left child: (a + b) * c", () => {
			// AST: (a + b) * c
			const expr = bin("*", bin("+", fact("a"), fact("b")), fact("c"));
			expect(print(expr)).toBe("(a + b) * c");
		});

		it("adds parens around lower-precedence right child: a * (b + c)", () => {
			// AST: a * (b + c)
			const expr = bin("*", fact("a"), bin("+", fact("b"), fact("c")));
			expect(print(expr)).toBe("a * (b + c)");
		});

		it("omits parens when right child has higher precedence: a + b * c", () => {
			// AST: a + (b * c)  — higher prec on right, no parens needed
			const expr = bin("+", fact("a"), bin("*", fact("b"), fact("c")));
			expect(print(expr)).toBe("a + b * c");
		});

		it("adds parens around 'and' when negated: not (a and b)", () => {
			const expr = unary("not", bin("and", fact("a"), fact("b")));
			expect(print(expr)).toBe("not (a and b)");
		});

		it("omits parens after 'not' for a plain fact: not a", () => {
			const expr = unary("not", fact("a"));
			expect(print(expr)).toBe("not a");
		});
	});

	describe("no parentheses around outermost expression", () => {
		it("prints a + b without wrapping parens", () => {
			expect(print(bin("+", fact("a"), fact("b")))).toBe("a + b");
		});
	});

	describe("left-associativity", () => {
		it("prints (a - b) - c without extra parens: a - b - c", () => {
			// (a - b) - c is the natural left-associative reading — no parens needed
			const expr = bin("-", bin("-", fact("a"), fact("b")), fact("c"));
			expect(print(expr)).toBe("a - b - c");
		});

		it("prints a - (b - c) with parens on the right: a - (b - c)", () => {
			// right-associative grouping differs from default — parens required
			const expr = bin("-", fact("a"), bin("-", fact("b"), fact("c")));
			expect(print(expr)).toBe("a - (b - c)");
		});
	});

	describe("function calls", () => {
		it("prints min(a, b) with two arguments", () => {
			expect(print(call("min", fact("a"), fact("b")))).toBe("min(a, b)");
		});

		it("prints if(x, 1, 0) with three arguments", () => {
			const expr = call("if", fact("x"), numLit(1), numLit(0));
			expect(print(expr)).toBe("if(x, 1, 0)");
		});
	});

	describe("unrecognised kind", () => {
		it("throws an Error for an unknown expr kind", () => {
			expect(() => print({ kind: "unknown_kind" } as unknown as Expr)).toThrow(
				Error,
			);
		});
	});
});
