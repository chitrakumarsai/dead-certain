import { describe, expect, it } from "vitest";
import type { Expr } from "../types";
import { parse } from "./parse";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fact(name: string): Expr {
	return { kind: "fact", name };
}

function binary(op: string, left: Expr, right: Expr): Expr {
	return { kind: "binary", op: op as never, left, right };
}

function unary(op: string, operand: Expr): Expr {
	return { kind: "unary", op: op as never, operand };
}

function literal(type: string, value: boolean | number | string): Expr {
	return { kind: "literal", type: type as never, value };
}

function call(fn: string, args: Expr[]): Expr {
	return { kind: "call", fn: fn as never, args };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("parser", () => {
	describe("literals", () => {
		it("parses true", () => {
			const result = parse("true");
			expect(result).toEqual({
				ok: true,
				expr: { kind: "literal", type: "boolean", value: true },
			});
		});

		it("parses false", () => {
			const result = parse("false");
			expect(result).toEqual({
				ok: true,
				expr: { kind: "literal", type: "boolean", value: false },
			});
		});

		it("parses integer number 42", () => {
			const result = parse("42");
			expect(result).toEqual({
				ok: true,
				expr: { kind: "literal", type: "number", value: 42 },
			});
		});

		it("parses decimal number 3.14", () => {
			const result = parse("3.14");
			expect(result).toEqual({
				ok: true,
				expr: { kind: "literal", type: "number", value: 3.14 },
			});
		});

		it('parses a date literal "2024-03-15"', () => {
			const result = parse('"2024-03-15"');
			expect(result).toEqual({
				ok: true,
				expr: { kind: "literal", type: "date", value: "2024-03-15" },
			});
		});

		it("parses an enum literal 'approved'", () => {
			const result = parse("'approved'");
			expect(result).toEqual({
				ok: true,
				expr: { kind: "literal", type: "enum", value: "approved" },
			});
		});
	});

	describe("fact names", () => {
		it("parses a plain fact name", () => {
			const result = parse("my_fact");
			expect(result).toEqual({
				ok: true,
				expr: { kind: "fact", name: "my_fact" },
			});
		});

		it("parses a single-letter fact name", () => {
			const result = parse("x");
			expect(result).toEqual({ ok: true, expr: { kind: "fact", name: "x" } });
		});
	});

	describe("operator precedence", () => {
		it("a + b * c parses as a + (b * c)", () => {
			const result = parse("a + b * c");
			expect(result).toEqual({
				ok: true,
				expr: binary("+", fact("a"), binary("*", fact("b"), fact("c"))),
			});
		});

		it("(a + b) * c overrides default precedence", () => {
			const result = parse("(a + b) * c");
			expect(result).toEqual({
				ok: true,
				expr: binary("*", binary("+", fact("a"), fact("b")), fact("c")),
			});
		});

		it("not a and b parses as (not a) and b", () => {
			const result = parse("not a and b");
			expect(result).toEqual({
				ok: true,
				expr: binary("and", unary("not", fact("a")), fact("b")),
			});
		});

		it("a or b and c parses as a or (b and c)", () => {
			const result = parse("a or b and c");
			expect(result).toEqual({
				ok: true,
				expr: binary("or", fact("a"), binary("and", fact("b"), fact("c"))),
			});
		});

		it("subtraction is left-associative: a - b - c", () => {
			const result = parse("a - b - c");
			expect(result).toEqual({
				ok: true,
				expr: binary("-", binary("-", fact("a"), fact("b")), fact("c")),
			});
		});
	});

	describe("comparisons non-associative", () => {
		it("a < b is valid", () => {
			const result = parse("a < b");
			expect(result.ok).toBe(true);
		});

		it("a < b < c is invalid (trailing content or error)", () => {
			// The parser is non-associative at the comparison level; a second
			// comparison operator after a full comparison expression must fail.
			const result = parse("a < b < c");
			expect(result.ok).toBe(false);
		});

		it("a == b is valid", () => {
			expect(parse("a == b").ok).toBe(true);
		});

		it("a != b is valid", () => {
			expect(parse("a != b").ok).toBe(true);
		});

		it("a <= b is valid", () => {
			expect(parse("a <= b").ok).toBe(true);
		});

		it("a >= b is valid", () => {
			expect(parse("a >= b").ok).toBe(true);
		});
	});

	describe("built-in functions", () => {
		it("parses min(a, b) with correct arity", () => {
			const result = parse("min(a, b)");
			expect(result).toEqual({
				ok: true,
				expr: call("min", [fact("a"), fact("b")]),
			});
		});

		it("parses max(a, b) with correct arity", () => {
			const result = parse("max(a, b)");
			expect(result).toEqual({
				ok: true,
				expr: call("max", [fact("a"), fact("b")]),
			});
		});

		it("parses round(x) with correct arity", () => {
			const result = parse("round(x)");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.expr.kind).toBe("call");
				if (result.expr.kind === "call") {
					expect(result.expr.fn).toBe("round");
					expect(result.expr.args).toHaveLength(1);
				}
			}
		});

		it("parses days_between(d1, d2) with correct arity", () => {
			const result = parse("days_between(d1, d2)");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.expr.kind).toBe("call");
				if (result.expr.kind === "call") {
					expect(result.expr.fn).toBe("days_between");
					expect(result.expr.args).toHaveLength(2);
				}
			}
		});

		it("parses if(x > 0, x, 0) with 3 arguments", () => {
			const result = parse("if(x > 0, x, 0)");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.expr.kind).toBe("call");
				if (result.expr.kind === "call") {
					expect(result.expr.fn).toBe("if");
					expect(result.expr.args).toHaveLength(3);
				}
			}
		});

		it("max(a) fails: arity mismatch (expects UNEXPECTED_TOKEN)", () => {
			const result = parse("max(a)");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("UNEXPECTED_TOKEN");
			}
		});

		it("min(a, b, c) fails: too many arguments", () => {
			const result = parse("min(a, b, c)");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("UNEXPECTED_TOKEN");
			}
		});

		it("round(a, b) fails: too many arguments", () => {
			const result = parse("round(a, b)");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("UNEXPECTED_TOKEN");
			}
		});

		it("if(x, y) fails: too few arguments", () => {
			const result = parse("if(x, y)");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("UNEXPECTED_TOKEN");
			}
		});
	});

	describe("error codes", () => {
		it("empty string → EMPTY_INPUT at position 0", () => {
			const result = parse("");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("EMPTY_INPUT");
				expect(result.error.position).toBe(0);
			}
		});

		it("whitespace-only string → EMPTY_INPUT at position 0", () => {
			const result = parse("   ");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("EMPTY_INPUT");
				expect(result.error.position).toBe(0);
			}
		});

		it("incomplete expression 'a +' → UNEXPECTED_END", () => {
			const result = parse("a +");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("UNEXPECTED_END");
			}
		});

		it("'42 43' → TRAILING_CONTENT", () => {
			const result = parse("42 43");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("TRAILING_CONTENT");
			}
		});

		it("'foo(a, b)' → UNKNOWN_FUNCTION (foo is not a builtin)", () => {
			const result = parse("foo(a, b)");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("UNKNOWN_FUNCTION");
			}
		});

		it('"2024-13-01" → INVALID_DATE (month 13 is invalid)', () => {
			const result = parse('"2024-13-01"');
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_DATE");
			}
		});

		it('"2024-02-30" → INVALID_DATE (Feb 30 does not exist)', () => {
			const result = parse('"2024-02-30"');
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_DATE");
			}
		});

		it('"2000-00-01" → INVALID_DATE (month 0 is invalid)', () => {
			const result = parse('"2000-00-01"');
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_DATE");
			}
		});

		it('"2024-01-00" → INVALID_DATE (day 0 is invalid)', () => {
			const result = parse('"2024-01-00"');
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_DATE");
			}
		});

		it("'(' alone → UNEXPECTED_END", () => {
			const result = parse("(");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("UNEXPECTED_END");
			}
		});

		it("'not' alone (without operand) → UNEXPECTED_END", () => {
			// 'not' is a valid unary prefix — but needs an operand, which is missing
			const result = parse("not");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("UNEXPECTED_END");
			}
		});
	});

	describe("YAML safety", () => {
		it("bare 2026-11-10 is NOT parsed as a date literal", () => {
			// Should parse as arithmetic 2026 - 11 - 10, or fail — but never as a date
			const result = parse("2026-11-10");
			if (result.ok) {
				expect(result.expr.kind).not.toBe("literal");
				// Even if the kind were "literal" (which it must not be), the type must not be "date"
				if (result.expr.kind === "literal") {
					expect(result.expr.type).not.toBe("date");
				}
			}
			// Failing is also acceptable — what's not acceptable is ok:true with a date literal
		});

		it("bare 2026-11-10 parses as arithmetic (2026 - 11 - 10 = 2005)", () => {
			const result = parse("2026-11-10");
			// If the parse succeeds it must be arithmetic, not a date literal
			if (result.ok) {
				expect(result.expr).toEqual(
					binary(
						"-",
						binary("-", literal("number", 2026), literal("number", 11)),
						literal("number", 10),
					),
				);
			}
		});
	});

	describe("reserved keywords as fact names", () => {
		it("'and' alone cannot be used as a fact name → error", () => {
			const result = parse("and");
			expect(result.ok).toBe(false);
		});

		it("'or + 1' — keyword 'or' in operand position → error", () => {
			const result = parse("or + 1");
			expect(result.ok).toBe(false);
		});

		it("'not + 1' — 'not' applies to +1 (unary not on a number, not a keyword-as-fact)", () => {
			// 'not' is a unary operator; "not + 1" means not(+1). The fact that it doesn't
			// make semantic sense is fine — the parser only checks syntax.
			const result = parse("not + 1");
			// Parser may succeed syntactically (not unary applied to unary-+ applied to 1)
			// or fail; either is acceptable as long as 'not' isn't used as a bare fact name.
			// The important guarantee: no { ok: true, expr: { kind: "fact", name: "not" } }.
			if (result.ok) {
				expect(result.expr).not.toEqual({ kind: "fact", name: "not" });
			}
		});

		it("'min' alone (not followed by '(') → error", () => {
			const result = parse("min");
			expect(result.ok).toBe(false);
		});

		it("'max' alone → error", () => {
			const result = parse("max");
			expect(result.ok).toBe(false);
		});

		it("'if' alone → error", () => {
			const result = parse("if");
			expect(result.ok).toBe(false);
		});
	});

	describe("whitespace", () => {
		it("leading and trailing whitespace is accepted", () => {
			const result = parse("  42  ");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.expr).toEqual({
					kind: "literal",
					type: "number",
					value: 42,
				});
			}
		});

		it("whitespace inside expressions is accepted", () => {
			const result = parse("  a  +  b  ");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.expr).toEqual(binary("+", fact("a"), fact("b")));
			}
		});

		it("tab and newline whitespace is consumed", () => {
			const result = parse("\t42\n");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.expr).toEqual({
					kind: "literal",
					type: "number",
					value: 42,
				});
			}
		});
	});

	describe("unary minus", () => {
		it("parses -3.14 as unary minus applied to 3.14", () => {
			const result = parse("-3.14");
			expect(result).toEqual({
				ok: true,
				expr: {
					kind: "unary",
					op: "-",
					operand: { kind: "literal", type: "number", value: 3.14 },
				},
			});
		});

		it("parses -x as unary minus applied to fact x", () => {
			const result = parse("-x");
			expect(result).toEqual({
				ok: true,
				expr: {
					kind: "unary",
					op: "-",
					operand: { kind: "fact", name: "x" },
				},
			});
		});

		it("parses -(a + b) as unary minus applied to (a + b)", () => {
			const result = parse("-(a + b)");
			expect(result).toEqual({
				ok: true,
				expr: unary("-", binary("+", fact("a"), fact("b"))),
			});
		});
	});

	describe("valid date literals", () => {
		it("parses a leap-year date 2000-02-29", () => {
			const result = parse('"2000-02-29"');
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.expr).toEqual({
					kind: "literal",
					type: "date",
					value: "2000-02-29",
				});
			}
		});

		it('"1999-02-29" → INVALID_DATE (1999 is not a leap year)', () => {
			const result = parse('"1999-02-29"');
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("INVALID_DATE");
			}
		});

		it('parses a date at start of year "2024-01-01"', () => {
			const result = parse('"2024-01-01"');
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.expr).toEqual({
					kind: "literal",
					type: "date",
					value: "2024-01-01",
				});
			}
		});

		it('parses a date at end of year "2024-12-31"', () => {
			const result = parse('"2024-12-31"');
			expect(result.ok).toBe(true);
		});
	});

	describe("complex expressions", () => {
		it("parses a + b == c as (a + b) == c", () => {
			const result = parse("a + b == c");
			expect(result).toEqual({
				ok: true,
				expr: binary("==", binary("+", fact("a"), fact("b")), fact("c")),
			});
		});

		it("parses nested function calls", () => {
			const result = parse("min(round(x), 10)");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.expr.kind).toBe("call");
				if (result.expr.kind === "call") {
					expect(result.expr.fn).toBe("min");
					expect(result.expr.args[0]).toEqual(call("round", [fact("x")]));
				}
			}
		});

		it("parses a fully specified if expression", () => {
			const result = parse("if(x > 0, x, 0)");
			expect(result.ok).toBe(true);
			if (result.ok && result.expr.kind === "call") {
				expect(result.expr.fn).toBe("if");
				expect(result.expr.args).toHaveLength(3);
				expect(result.expr.args[0]).toEqual(
					binary(">", fact("x"), literal("number", 0)),
				);
				expect(result.expr.args[1]).toEqual(fact("x"));
				expect(result.expr.args[2]).toEqual(literal("number", 0));
			}
		});
	});

	describe("unknown characters and malformed quoted literals", () => {
		const err = (src: string) => {
			const r = parse(src);
			expect(r.ok).toBe(false);
			if (r.ok) throw new Error("expected failure");
			expect(r.error.message.length).toBeLessThanOrEqual(200);
			return r.error;
		};

		it("$ → UNEXPECTED_TOKEN at 0", () => {
			expect(err("$")).toMatchObject({ code: "UNEXPECTED_TOKEN", position: 0 });
		});
		it(".5 → UNEXPECTED_TOKEN at 0", () => {
			expect(err(".5")).toMatchObject({
				code: "UNEXPECTED_TOKEN",
				position: 0,
			});
		});
		it("a $ b → TRAILING_CONTENT at 2", () => {
			expect(err("a $ b")).toMatchObject({
				code: "TRAILING_CONTENT",
				position: 2,
			});
		});
		it("'abc → UNEXPECTED_END at source.length", () => {
			expect(err("'abc")).toMatchObject({
				code: "UNEXPECTED_END",
				position: 4,
			});
		});
		it('"2024-01-01 → UNEXPECTED_END at source.length', () => {
			expect(err('"2024-01-01')).toMatchObject({
				code: "UNEXPECTED_END",
				position: 11,
			});
		});
		it("'' → UNEXPECTED_TOKEN at the opening quote", () => {
			expect(err("''")).toMatchObject({
				code: "UNEXPECTED_TOKEN",
				position: 0,
			});
			expect(err("x == ''")).toMatchObject({
				code: "UNEXPECTED_TOKEN",
				position: 5,
			});
		});
		it("'x' + 'abc → UNEXPECTED_END at source.length", () => {
			expect(err("'x' + 'abc")).toMatchObject({
				code: "UNEXPECTED_END",
				position: 10,
			});
		});
		it('"2024-13-01" still → INVALID_DATE', () => {
			expect(err('"2024-13-01"').code).toBe("INVALID_DATE");
		});
		it("'abc' still parses as an enum literal", () => {
			expect(parse("'abc'")).toEqual({
				ok: true,
				expr: literal("enum", "abc"),
			});
		});
	});
});
