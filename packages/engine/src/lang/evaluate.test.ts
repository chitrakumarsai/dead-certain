import { describe, expect, it } from "vitest";
import type { BinaryOp, BuiltinFn, Expr } from "../types";
import { UNKNOWN } from "../types";
import type { Env } from "./evaluate";
import { evaluate } from "./evaluate";
import { parse } from "./parse";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fact(name: string): Expr {
	return { kind: "fact", name };
}

function numLit(v: number): Expr {
	return { kind: "literal", type: "number", value: v };
}

function boolLit(v: boolean): Expr {
	return { kind: "literal", type: "boolean", value: v };
}

function dateLit(v: string): Expr {
	return { kind: "literal", type: "date", value: v };
}

function enumLit(v: string): Expr {
	return { kind: "literal", type: "enum", value: v };
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

// An absent fact — always resolves to UNKNOWN
const _UNKNOWN_FACT: Expr = { kind: "fact", name: "__unknown__" };

// An expression that always produces TYPE_MISMATCH when evaluated (true + 1)
const ERROR_EXPR: Expr = bin("+", boolLit(true), numLit(1));

const EMPTY_ENV: Env = {};

// ---------------------------------------------------------------------------
// 1. Literals evaluate to themselves
// ---------------------------------------------------------------------------

describe("literals evaluate to themselves", () => {
	it("boolean true", () => {
		expect(evaluate(boolLit(true), EMPTY_ENV)).toEqual({
			ok: true,
			value: true,
		});
	});

	it("boolean false", () => {
		expect(evaluate(boolLit(false), EMPTY_ENV)).toEqual({
			ok: true,
			value: false,
		});
	});

	it("number 42", () => {
		expect(evaluate(numLit(42), EMPTY_ENV)).toEqual({ ok: true, value: 42 });
	});

	it("date string", () => {
		expect(evaluate(dateLit("2024-03-15"), EMPTY_ENV)).toEqual({
			ok: true,
			value: "2024-03-15",
		});
	});

	it("enum literal 'gold'", () => {
		expect(evaluate(enumLit("gold"), EMPTY_ENV)).toEqual({
			ok: true,
			value: "gold",
		});
	});
});

// ---------------------------------------------------------------------------
// 2. Fact references
// ---------------------------------------------------------------------------

describe("fact references", () => {
	it("fact present in env → returns its value", () => {
		const env: Env = { age: 30 };
		expect(evaluate(fact("age"), env)).toEqual({ ok: true, value: 30 });
	});

	it("fact present in env as UNKNOWN → returns UNKNOWN", () => {
		const env: Env = { age: UNKNOWN };
		expect(evaluate(fact("age"), env)).toEqual({ ok: true, value: UNKNOWN });
	});

	it("fact absent from env → returns UNKNOWN", () => {
		expect(evaluate(fact("missing"), EMPTY_ENV)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});
});

// ---------------------------------------------------------------------------
// 3. Division by zero
// ---------------------------------------------------------------------------

describe("division by zero", () => {
	it("a / 0 with a = 10 → DIVISION_BY_ZERO", () => {
		const env: Env = { a: 10 };
		const result = evaluate(bin("/", fact("a"), numLit(0)), env);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("DIVISION_BY_ZERO");
		}
	});
});

// ---------------------------------------------------------------------------
// 4. Type mismatches
// ---------------------------------------------------------------------------

describe("type mismatches", () => {
	it("true + 1 → TYPE_MISMATCH", () => {
		const result = evaluate(bin("+", boolLit(true), numLit(1)), EMPTY_ENV);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("TYPE_MISMATCH");
		}
	});

	it('"hello" < 5 → TYPE_MISMATCH', () => {
		// A string fact compared with a number
		const env: Env = { s: "hello" };
		const result = evaluate(bin("<", fact("s"), numLit(5)), env);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("TYPE_MISMATCH");
		}
	});

	it("not 42 → TYPE_MISMATCH", () => {
		const result = evaluate(unary("not", numLit(42)), EMPTY_ENV);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("TYPE_MISMATCH");
		}
	});
});

// ---------------------------------------------------------------------------
// 5. Kleene rows for 'and' (9 cases)
// ---------------------------------------------------------------------------

describe("and — Kleene truth table", () => {
	const env: Env = { u: UNKNOWN };
	const T = boolLit(true);
	const F = boolLit(false);
	const U = fact("u"); // evaluates to UNKNOWN

	it("true and true = true", () => {
		expect(evaluate(bin("and", T, T), env)).toEqual({ ok: true, value: true });
	});

	it("true and false = false", () => {
		expect(evaluate(bin("and", T, F), env)).toEqual({ ok: true, value: false });
	});

	it("false and true = false", () => {
		expect(evaluate(bin("and", F, T), env)).toEqual({ ok: true, value: false });
	});

	it("false and false = false", () => {
		expect(evaluate(bin("and", F, F), env)).toEqual({ ok: true, value: false });
	});

	it("true and UNKNOWN = UNKNOWN", () => {
		expect(evaluate(bin("and", T, U), env)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});

	it("UNKNOWN and true = UNKNOWN", () => {
		expect(evaluate(bin("and", U, T), env)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});

	it("false and UNKNOWN = false (short-circuit)", () => {
		expect(evaluate(bin("and", F, U), env)).toEqual({ ok: true, value: false });
	});

	it("UNKNOWN and false = false", () => {
		expect(evaluate(bin("and", U, F), env)).toEqual({ ok: true, value: false });
	});

	it("UNKNOWN and UNKNOWN = UNKNOWN", () => {
		expect(evaluate(bin("and", U, U), env)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});
});

// ---------------------------------------------------------------------------
// 6. Kleene rows for 'or' (9 cases)
// ---------------------------------------------------------------------------

describe("or — Kleene truth table", () => {
	const env: Env = { u: UNKNOWN };
	const T = boolLit(true);
	const F = boolLit(false);
	const U = fact("u"); // evaluates to UNKNOWN

	it("true or true = true", () => {
		expect(evaluate(bin("or", T, T), env)).toEqual({ ok: true, value: true });
	});

	it("true or false = true", () => {
		expect(evaluate(bin("or", T, F), env)).toEqual({ ok: true, value: true });
	});

	it("false or true = true", () => {
		expect(evaluate(bin("or", F, T), env)).toEqual({ ok: true, value: true });
	});

	it("false or false = false", () => {
		expect(evaluate(bin("or", F, F), env)).toEqual({ ok: true, value: false });
	});

	it("true or UNKNOWN = true (short-circuit)", () => {
		expect(evaluate(bin("or", T, U), env)).toEqual({ ok: true, value: true });
	});

	it("UNKNOWN or true = true", () => {
		expect(evaluate(bin("or", U, T), env)).toEqual({ ok: true, value: true });
	});

	it("false or UNKNOWN = UNKNOWN", () => {
		expect(evaluate(bin("or", F, U), env)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});

	it("UNKNOWN or false = UNKNOWN", () => {
		expect(evaluate(bin("or", U, F), env)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});

	it("UNKNOWN or UNKNOWN = UNKNOWN", () => {
		expect(evaluate(bin("or", U, U), env)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});
});

// ---------------------------------------------------------------------------
// 7. All three rows for 'not'
// ---------------------------------------------------------------------------

describe("not — Kleene truth table", () => {
	const env: Env = { u: UNKNOWN };
	const U = fact("u");

	it("not true = false", () => {
		expect(evaluate(unary("not", boolLit(true)), EMPTY_ENV)).toEqual({
			ok: true,
			value: false,
		});
	});

	it("not false = true", () => {
		expect(evaluate(unary("not", boolLit(false)), EMPTY_ENV)).toEqual({
			ok: true,
			value: true,
		});
	});

	it("not UNKNOWN = UNKNOWN", () => {
		expect(evaluate(unary("not", U), env)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});
});

// ---------------------------------------------------------------------------
// 8. Short-circuit behaviour
// ---------------------------------------------------------------------------

describe("short-circuit behaviour", () => {
	it("false and <TYPE_MISMATCH expr> → false without error", () => {
		// ERROR_EXPR would produce TYPE_MISMATCH, but short-circuit must prevent evaluation
		const result = evaluate(bin("and", boolLit(false), ERROR_EXPR), EMPTY_ENV);
		expect(result).toEqual({ ok: true, value: false });
	});

	it("true or <TYPE_MISMATCH expr> → true without error", () => {
		const result = evaluate(bin("or", boolLit(true), ERROR_EXPR), EMPTY_ENV);
		expect(result).toEqual({ ok: true, value: true });
	});
});

// ---------------------------------------------------------------------------
// 9. if() lazy semantics
// ---------------------------------------------------------------------------

describe("if() lazy semantics", () => {
	it("if(true, 1, <error expr>) → 1 — else branch not evaluated", () => {
		const result = evaluate(
			call("if", boolLit(true), numLit(1), ERROR_EXPR),
			EMPTY_ENV,
		);
		expect(result).toEqual({ ok: true, value: 1 });
	});

	it("if(false, <error expr>, 2) → 2 — then branch not evaluated", () => {
		const result = evaluate(
			call("if", boolLit(false), ERROR_EXPR, numLit(2)),
			EMPTY_ENV,
		);
		expect(result).toEqual({ ok: true, value: 2 });
	});

	it("if(UNKNOWN, 1, 2) → UNKNOWN", () => {
		const env: Env = { u: UNKNOWN };
		const result = evaluate(call("if", fact("u"), numLit(1), numLit(2)), env);
		expect(result).toEqual({ ok: true, value: UNKNOWN });
	});
});

// ---------------------------------------------------------------------------
// 10. days_between with known dates
// ---------------------------------------------------------------------------

describe("days_between", () => {
	it("days_between('2024-01-10', '2024-01-15') → 5", () => {
		const result = evaluate(
			call("days_between", dateLit("2024-01-10"), dateLit("2024-01-15")),
			EMPTY_ENV,
		);
		expect(result).toEqual({ ok: true, value: 5 });
	});

	it("days_between('2024-01-15', '2024-01-10') → -5 (signed)", () => {
		const result = evaluate(
			call("days_between", dateLit("2024-01-15"), dateLit("2024-01-10")),
			EMPTY_ENV,
		);
		expect(result).toEqual({ ok: true, value: -5 });
	});

	it("first arg UNKNOWN → UNKNOWN", () => {
		const env: Env = { u: UNKNOWN };
		const result = evaluate(
			call("days_between", fact("u"), dateLit("2024-01-15")),
			env,
		);
		expect(result).toEqual({ ok: true, value: UNKNOWN });
	});

	it("second arg UNKNOWN → UNKNOWN", () => {
		const env: Env = { u: UNKNOWN };
		const result = evaluate(
			call("days_between", dateLit("2024-01-10"), fact("u")),
			env,
		);
		expect(result).toEqual({ ok: true, value: UNKNOWN });
	});
});

// ---------------------------------------------------------------------------
// 11. round half-up
// ---------------------------------------------------------------------------

describe("round — half-up", () => {
	it("round(0.5) → 1", () => {
		expect(evaluate(call("round", numLit(0.5)), EMPTY_ENV)).toEqual({
			ok: true,
			value: 1,
		});
	});

	it("round(-0.5) → 0", () => {
		expect(evaluate(call("round", numLit(-0.5)), EMPTY_ENV)).toEqual({
			ok: true,
			value: 0,
		});
	});

	it("round(2.4) → 2", () => {
		expect(evaluate(call("round", numLit(2.4)), EMPTY_ENV)).toEqual({
			ok: true,
			value: 2,
		});
	});

	it("round(2.6) → 3", () => {
		expect(evaluate(call("round", numLit(2.6)), EMPTY_ENV)).toEqual({
			ok: true,
			value: 3,
		});
	});
});

// ---------------------------------------------------------------------------
// 12. min / max
// ---------------------------------------------------------------------------

describe("min / max", () => {
	it("min(3, 5) → 3", () => {
		expect(evaluate(call("min", numLit(3), numLit(5)), EMPTY_ENV)).toEqual({
			ok: true,
			value: 3,
		});
	});

	it("max(3, 5) → 5", () => {
		expect(evaluate(call("max", numLit(3), numLit(5)), EMPTY_ENV)).toEqual({
			ok: true,
			value: 5,
		});
	});

	it("min with first arg UNKNOWN → UNKNOWN", () => {
		const env: Env = { u: UNKNOWN };
		expect(evaluate(call("min", fact("u"), numLit(5)), env)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});

	it("min with second arg UNKNOWN → UNKNOWN", () => {
		const env: Env = { u: UNKNOWN };
		expect(evaluate(call("min", numLit(3), fact("u")), env)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});

	it("max with first arg UNKNOWN → UNKNOWN", () => {
		const env: Env = { u: UNKNOWN };
		expect(evaluate(call("max", fact("u"), numLit(5)), env)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});

	it("max with second arg UNKNOWN → UNKNOWN", () => {
		const env: Env = { u: UNKNOWN };
		expect(evaluate(call("max", numLit(3), fact("u")), env)).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});
});

// ---------------------------------------------------------------------------
// 13. Error propagation
// ---------------------------------------------------------------------------

describe("error propagation", () => {
	it("error in sub-expression propagates to the top result", () => {
		// (a / 0) + 1 — the division error should propagate through the addition
		const env: Env = { a: 10 };
		const divByZero = bin("/", fact("a"), numLit(0));
		const result = evaluate(bin("+", divByZero, numLit(1)), env);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("DIVISION_BY_ZERO");
		}
	});

	it("error in right operand propagates when left is not short-circuiting", () => {
		// 1 + (a / 0) — right side error should propagate
		const env: Env = { a: 5 };
		const divByZero = bin("/", fact("a"), numLit(0));
		const result = evaluate(bin("+", numLit(1), divByZero), env);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("DIVISION_BY_ZERO");
		}
	});

	it("error in 'and' left operand propagates", () => {
		const env: Env = { a: 10 };
		const divByZero = bin("/", fact("a"), numLit(0));
		// (a / 0) can't be used directly with 'and', but we can wrap it in a comparison
		// (a / 0) > 0 evaluates the division first → DIVISION_BY_ZERO propagates
		const errorBool = bin(">", divByZero, numLit(0));
		const result = evaluate(bin("and", errorBool, boolLit(true)), env);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("DIVISION_BY_ZERO");
		}
	});

	it("error in 'or' left operand propagates", () => {
		const env: Env = { a: 10 };
		const divByZero = bin("/", fact("a"), numLit(0));
		const errorBool = bin(">", divByZero, numLit(0));
		const result = evaluate(bin("or", errorBool, boolLit(false)), env);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("DIVISION_BY_ZERO");
		}
	});
});

// ---------------------------------------------------------------------------
// days_between validation, finite-result guard, NUMERIC_OVERFLOW
// ---------------------------------------------------------------------------

function expectCode(result: ReturnType<typeof evaluate>, code: string): void {
	expect(result.ok).toBe(false);
	if (!result.ok) expect(result.error.code).toBe(code);
}

describe("days_between argument validation", () => {
	it("non-date string 'x' → TYPE_MISMATCH", () => {
		expectCode(
			evaluate(call("days_between", enumLit("x"), dateLit("2024-01-01")), {}),
			"TYPE_MISMATCH",
		);
	});

	it("invalid calendar date 2023-02-29 → TYPE_MISMATCH", () => {
		expectCode(
			evaluate(
				call("days_between", dateLit("2023-02-29"), dateLit("2024-01-01")),
				{},
			),
			"TYPE_MISMATCH",
		);
	});

	it("number argument → TYPE_MISMATCH", () => {
		expectCode(
			evaluate(call("days_between", dateLit("2024-01-01"), numLit(5)), {}),
			"TYPE_MISMATCH",
		);
	});

	it("boolean argument → TYPE_MISMATCH", () => {
		expectCode(
			evaluate(call("days_between", boolLit(true), dateLit("2024-01-01")), {}),
			"TYPE_MISMATCH",
		);
	});

	it("valid pair still works, positive and negative", () => {
		expect(
			evaluate(
				call("days_between", dateLit("2024-02-28"), dateLit("2024-03-01")),
				{},
			),
		).toEqual({ ok: true, value: 2 });
		expect(
			evaluate(
				call("days_between", dateLit("2024-03-01"), dateLit("2024-02-28")),
				{},
			),
		).toEqual({ ok: true, value: -2 });
	});

	it("one unknown argument → unknown", () => {
		expect(
			evaluate(call("days_between", fact("u"), dateLit("2024-01-01")), {}),
		).toEqual({ ok: true, value: UNKNOWN });
	});
});

describe("finite-result guard", () => {
	it("1e308 * 10 → NUMERIC_OVERFLOW", () => {
		expectCode(
			evaluate(bin("*", numLit(1e308), numLit(10)), {}),
			"NUMERIC_OVERFLOW",
		);
	});

	it("1.7e308 + 1.7e308 → NUMERIC_OVERFLOW", () => {
		expectCode(
			evaluate(bin("+", numLit(1.7e308), numLit(1.7e308)), {}),
			"NUMERIC_OVERFLOW",
		);
	});

	it("NaN in env → TYPE_MISMATCH", () => {
		expectCode(
			evaluate(bin("+", fact("a"), numLit(1)), { a: Number.NaN }),
			"TYPE_MISMATCH",
		);
	});

	it("Infinity in env → TYPE_MISMATCH", () => {
		expectCode(
			evaluate(fact("a"), { a: Number.POSITIVE_INFINITY }),
			"TYPE_MISMATCH",
		);
		expectCode(
			evaluate(fact("a"), { a: Number.NEGATIVE_INFINITY }),
			"TYPE_MISMATCH",
		);
	});

	it("non-finite numeric literal → TYPE_MISMATCH", () => {
		expectCode(evaluate(numLit(Number.POSITIVE_INFINITY), {}), "TYPE_MISMATCH");
	});

	it("division by zero stays DIVISION_BY_ZERO", () => {
		expectCode(
			evaluate(bin("/", numLit(1), numLit(0)), {}),
			"DIVISION_BY_ZERO",
		);
	});
});

// ---------------------------------------------------------------------------
// Date ordering and equality
// ---------------------------------------------------------------------------

describe("date comparison", () => {
	const cmp = (op: BinaryOp, a: string, b: string) =>
		evaluate(bin(op, dateLit(a), dateLit(b)), EMPTY_ENV);
	const before = "2024-01-01";
	const after = "2024-06-15";

	const table: Array<[BinaryOp, boolean, boolean, boolean]> = [
		// op, before-vs-after (a<b), equal, after-vs-before (a>b)
		["<", true, false, false],
		["<=", true, true, false],
		[">", false, false, true],
		[">=", false, true, true],
	];

	for (const [op, lt, eq, gt] of table) {
		it(`'${op}' on earlier/equal/later dates`, () => {
			expect(cmp(op, before, after)).toEqual({ ok: true, value: lt });
			expect(cmp(op, before, before)).toEqual({ ok: true, value: eq });
			expect(cmp(op, after, before)).toEqual({ ok: true, value: gt });
		});
	}

	it("leap day pair 2024-02-29 vs 2024-03-01", () => {
		expect(cmp("<", "2024-02-29", "2024-03-01")).toEqual({
			ok: true,
			value: true,
		});
		expect(cmp(">", "2024-02-29", "2024-03-01")).toEqual({
			ok: true,
			value: false,
		});
	});

	it("year boundary 2023-12-31 vs 2024-01-01", () => {
		expect(cmp("<", "2023-12-31", "2024-01-01")).toEqual({
			ok: true,
			value: true,
		});
		expect(cmp(">=", "2023-12-31", "2024-01-01")).toEqual({
			ok: true,
			value: false,
		});
	});

	it("== and != on equal and different dates", () => {
		expect(cmp("==", before, before)).toEqual({ ok: true, value: true });
		expect(cmp("!=", before, before)).toEqual({ ok: true, value: false });
		expect(cmp("==", before, after)).toEqual({ ok: true, value: false });
		expect(cmp("!=", before, after)).toEqual({ ok: true, value: true });
	});

	it("date vs number ordering → TYPE_MISMATCH", () => {
		expectCode(
			evaluate(bin("<", dateLit(before), numLit(1)), {}),
			"TYPE_MISMATCH",
		);
		expectCode(
			evaluate(bin(">", numLit(1), dateLit(before)), {}),
			"TYPE_MISMATCH",
		);
	});

	it("enum vs enum ordering → TYPE_MISMATCH", () => {
		expectCode(
			evaluate(bin("<", enumLit("gold"), enumLit("silver")), {}),
			"TYPE_MISMATCH",
		);
	});

	it("enum == enum still works", () => {
		expect(evaluate(bin("==", enumLit("gold"), enumLit("gold")), {})).toEqual({
			ok: true,
			value: true,
		});
	});

	it("number ordering is unchanged", () => {
		expect(evaluate(bin("<", numLit(1), numLit(2)), {})).toEqual({
			ok: true,
			value: true,
		});
	});

	it("date vs unknown → unknown", () => {
		expect(evaluate(bin("<", dateLit(before), fact("missing")), {})).toEqual({
			ok: true,
			value: UNKNOWN,
		});
	});

	it("parse then evaluate: admission_date < policy_start", () => {
		const parsed = parse("admission_date < policy_start");
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		const env: Env = {
			admission_date: "2023-12-31",
			policy_start: "2024-01-01",
		};
		expect(evaluate(parsed.expr, env)).toEqual({ ok: true, value: true });
		expect(
			evaluate(parsed.expr, { ...env, admission_date: "2024-02-29" }),
		).toEqual({ ok: true, value: false });
	});
});
