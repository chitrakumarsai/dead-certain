import type { Expr, FactValue, Unknown } from "../types";
import { UNKNOWN } from "../types";
import { compareDates, isValidDate } from "./dates";
import { print } from "./print";

export type EvalErrorCode =
	| "DIVISION_BY_ZERO"
	| "TYPE_MISMATCH"
	| "NUMERIC_OVERFLOW"
	| "UNKNOWN_ERROR";

export interface EvalError {
	readonly code: EvalErrorCode;
	readonly message: string;
	readonly expr?: string; // the sub-expression that caused the error, as a string (max 1000 chars)
}

export type Env = Readonly<Record<string, FactValue | Unknown>>;

export type EvalResult =
	| { readonly ok: true; readonly value: FactValue | Unknown }
	| { readonly ok: false; readonly error: EvalError };

// ─── Internal helpers ────────────────────────────────────────────────────────

function ok(value: FactValue | Unknown): EvalResult {
	return { ok: true, value };
}

function fail(
	code: EvalErrorCode,
	message: string,
	exprNode?: Expr,
): EvalResult {
	const error: EvalError = {
		code,
		message,
		...(exprNode !== undefined ? { expr: print(exprNode).slice(0, 1000) } : {}),
	};
	return { ok: false, error };
}

/** Returns ok(n) when n is finite, otherwise a NUMERIC_OVERFLOW error. */
function finite(n: number, exprNode: Expr): EvalResult {
	if (Number.isFinite(n)) return ok(n);
	return fail(
		"NUMERIC_OVERFLOW",
		"Numeric result is not finite (overflow)",
		exprNode,
	);
}

function isNumber(v: FactValue | Unknown): v is number {
	return typeof v === "number";
}

function isBoolean(v: FactValue | Unknown): v is boolean {
	return typeof v === "boolean";
}

function isString(v: FactValue | Unknown): v is string {
	return typeof v === "string";
}

function isUnknown(v: FactValue | Unknown): v is Unknown {
	return v === UNKNOWN;
}

// ─── Main evaluator ──────────────────────────────────────────────────────────

/**
 * Evaluates expr in the given environment.
 * Never throws; propagates Unknown and EvalError per Kleene logic.
 */
export function evaluate(expr: Expr, env: Env): EvalResult {
	switch (expr.kind) {
		case "literal": {
			if (typeof expr.value === "number" && !Number.isFinite(expr.value)) {
				return fail("TYPE_MISMATCH", "Non-finite numeric literal", expr);
			}
			return ok(expr.value);
		}

		case "fact": {
			const val = env[expr.name];
			// If name is in env, return its value (may be UNKNOWN); if absent, return UNKNOWN
			if (typeof val === "number" && !Number.isFinite(val)) {
				return fail(
					"TYPE_MISMATCH",
					`Fact '${expr.name}' holds a non-finite number`,
					expr,
				);
			}
			return ok(val !== undefined ? val : UNKNOWN);
		}

		case "unary": {
			const operandResult = evaluate(expr.operand, env);
			if (!operandResult.ok) return operandResult;
			const v = operandResult.value;

			if (expr.op === "-") {
				if (isUnknown(v)) return ok(UNKNOWN);
				if (!isNumber(v)) {
					return fail(
						"TYPE_MISMATCH",
						`Unary '-' requires a number, got ${typeof v}`,
						expr,
					);
				}
				return finite(-v, expr);
			}

			// op === "not"
			if (isUnknown(v)) return ok(UNKNOWN);
			if (!isBoolean(v)) {
				return fail(
					"TYPE_MISMATCH",
					`'not' requires a boolean, got ${typeof v}`,
					expr,
				);
			}
			return ok(!v);
		}

		case "binary": {
			const { op, left, right } = expr;

			// ── Kleene short-circuit for 'and' ──────────────────────────────
			if (op === "and") {
				const leftResult = evaluate(left, env);
				if (!leftResult.ok) return leftResult;
				const lv = leftResult.value;

				// false and <anything> = false (do NOT evaluate right)
				if (isBoolean(lv) && lv === false) return ok(false);
				if (!isBoolean(lv) && !isUnknown(lv)) {
					return fail("TYPE_MISMATCH", "'and' requires boolean operands", expr);
				}

				const rightResult = evaluate(right, env);
				if (!rightResult.ok) return rightResult;
				const rv = rightResult.value;

				if (isBoolean(rv) && rv === false) return ok(false);
				if (!isBoolean(rv) && !isUnknown(rv)) {
					return fail("TYPE_MISMATCH", "'and' requires boolean operands", expr);
				}

				// If either is UNKNOWN → UNKNOWN
				if (isUnknown(lv) || isUnknown(rv)) return ok(UNKNOWN);
				// Both must be true
				return ok(true);
			}

			// ── Kleene short-circuit for 'or' ───────────────────────────────
			if (op === "or") {
				const leftResult = evaluate(left, env);
				if (!leftResult.ok) return leftResult;
				const lv = leftResult.value;

				// true or <anything> = true (do NOT evaluate right)
				if (isBoolean(lv) && lv === true) return ok(true);
				if (!isBoolean(lv) && !isUnknown(lv)) {
					return fail("TYPE_MISMATCH", "'or' requires boolean operands", expr);
				}

				const rightResult = evaluate(right, env);
				if (!rightResult.ok) return rightResult;
				const rv = rightResult.value;

				if (isBoolean(rv) && rv === true) return ok(true);
				if (!isBoolean(rv) && !isUnknown(rv)) {
					return fail("TYPE_MISMATCH", "'or' requires boolean operands", expr);
				}

				// If either is UNKNOWN → UNKNOWN
				if (isUnknown(lv) || isUnknown(rv)) return ok(UNKNOWN);
				// Both must be false
				return ok(false);
			}

			// ── All other binary ops: evaluate both sides first ──────────────
			const leftResult = evaluate(left, env);
			if (!leftResult.ok) return leftResult;
			const lv = leftResult.value;

			const rightResult = evaluate(right, env);
			if (!rightResult.ok) return rightResult;
			const rv = rightResult.value;

			// Propagate UNKNOWN
			if (isUnknown(lv) || isUnknown(rv)) return ok(UNKNOWN);

			// ── Arithmetic operators ─────────────────────────────────────────
			if (op === "+" || op === "-" || op === "*" || op === "/") {
				if (!isNumber(lv)) {
					return fail(
						"TYPE_MISMATCH",
						`Arithmetic '${op}' requires numbers, left operand is ${typeof lv}`,
						left,
					);
				}
				if (!isNumber(rv)) {
					return fail(
						"TYPE_MISMATCH",
						`Arithmetic '${op}' requires numbers, right operand is ${typeof rv}`,
						right,
					);
				}
				if (op === "/") {
					if (rv === 0) {
						return fail("DIVISION_BY_ZERO", "Division by zero", expr);
					}
					return finite(lv / rv, expr);
				}
				if (op === "+") return finite(lv + rv, expr);
				if (op === "-") return finite(lv - rv, expr);
				return finite(lv * rv, expr);
			}

			// ── Comparison operators ─────────────────────────────────────────
			const bothDates =
				isString(lv) && isString(rv) && isValidDate(lv) && isValidDate(rv);
			if (bothDates) {
				const c = compareDates(lv, rv);
				if (op === "==") return ok(c === 0);
				if (op === "!=") return ok(c !== 0);
				if (op === "<") return ok(c < 0);
				if (op === "<=") return ok(c <= 0);
				if (op === ">") return ok(c > 0);
				return ok(c >= 0);
			}

			if (op === "==" || op === "!=") {
				// Works on any matching types (boolean, number, string)
				if (typeof lv !== typeof rv) {
					return fail(
						"TYPE_MISMATCH",
						`Cannot compare ${typeof lv} with ${typeof rv}`,
						expr,
					);
				}
				if (op === "==") return ok(lv === rv);
				return ok(lv !== rv);
			}

			// op is <, <=, >, >= — only on numbers or two valid dates
			if (!isNumber(lv)) {
				return fail(
					"TYPE_MISMATCH",
					`Comparison '${op}' requires numbers or dates, left operand is ${typeof lv}`,
					left,
				);
			}
			if (!isNumber(rv)) {
				return fail(
					"TYPE_MISMATCH",
					`Comparison '${op}' requires numbers or dates, right operand is ${typeof rv}`,
					right,
				);
			}
			if (op === "<") return ok(lv < rv);
			if (op === "<=") return ok(lv <= rv);
			if (op === ">") return ok(lv > rv);
			return ok(lv >= rv);
		}

		case "call": {
			const { fn, args } = expr;

			// ── if(cond, then, else) — lazy: do NOT evaluate non-selected branch ──
			if (fn === "if") {
				// Parser enforces arity=3
				const [condExpr, thenExpr, elseExpr] = args;
				if (
					condExpr === undefined ||
					thenExpr === undefined ||
					elseExpr === undefined
				) {
					return fail(
						"UNKNOWN_ERROR",
						"'if' requires exactly 3 arguments",
						expr,
					);
				}

				const condResult = evaluate(condExpr, env);
				if (!condResult.ok) return condResult;
				const cond = condResult.value;

				if (isUnknown(cond)) return ok(UNKNOWN);
				if (!isBoolean(cond)) {
					return fail(
						"TYPE_MISMATCH",
						`'if' condition must be a boolean, got ${typeof cond}`,
						condExpr,
					);
				}
				// Lazy: only evaluate the selected branch
				return evaluate(cond ? thenExpr : elseExpr, env);
			}

			// ── min(a, b) / max(a, b) ────────────────────────────────────────
			if (fn === "min" || fn === "max") {
				// Parser enforces arity=2
				const [arg0, arg1] = args;
				if (arg0 === undefined || arg1 === undefined) {
					return fail(
						"UNKNOWN_ERROR",
						`'${fn}' requires exactly 2 arguments`,
						expr,
					);
				}

				const r0 = evaluate(arg0, env);
				if (!r0.ok) return r0;
				const r1 = evaluate(arg1, env);
				if (!r1.ok) return r1;

				const v0 = r0.value;
				const v1 = r1.value;

				if (isUnknown(v0) || isUnknown(v1)) return ok(UNKNOWN);

				if (!isNumber(v0)) {
					return fail(
						"TYPE_MISMATCH",
						`'${fn}' requires numbers, first argument is ${typeof v0}`,
						arg0,
					);
				}
				if (!isNumber(v1)) {
					return fail(
						"TYPE_MISMATCH",
						`'${fn}' requires numbers, second argument is ${typeof v1}`,
						arg1,
					);
				}
				return finite(fn === "min" ? Math.min(v0, v1) : Math.max(v0, v1), expr);
			}

			// ── round(x) ─────────────────────────────────────────────────────
			if (fn === "round") {
				// Parser enforces arity=1
				const [arg0] = args;
				if (arg0 === undefined) {
					return fail(
						"UNKNOWN_ERROR",
						"'round' requires exactly 1 argument",
						expr,
					);
				}

				const r0 = evaluate(arg0, env);
				if (!r0.ok) return r0;
				const v0 = r0.value;

				if (isUnknown(v0)) return ok(UNKNOWN);
				if (!isNumber(v0)) {
					return fail(
						"TYPE_MISMATCH",
						`'round' requires a number, got ${typeof v0}`,
						arg0,
					);
				}
				// Half-up rounding
				return finite(Math.floor(v0 + 0.5), expr);
			}

			// ── days_between(d1, d2) ─────────────────────────────────────────
			if (fn === "days_between") {
				// Parser enforces arity=2
				const [arg0, arg1] = args;
				if (arg0 === undefined || arg1 === undefined) {
					return fail(
						"UNKNOWN_ERROR",
						"'days_between' requires exactly 2 arguments",
						expr,
					);
				}

				const r0 = evaluate(arg0, env);
				if (!r0.ok) return r0;
				const r1 = evaluate(arg1, env);
				if (!r1.ok) return r1;

				const v0 = r0.value;
				const v1 = r1.value;

				if (isUnknown(v0) || isUnknown(v1)) return ok(UNKNOWN);
				if (!isString(v0)) {
					return fail(
						"TYPE_MISMATCH",
						`'days_between' requires date strings, first argument is ${typeof v0}`,
						arg0,
					);
				}
				if (!isString(v1)) {
					return fail(
						"TYPE_MISMATCH",
						`'days_between' requires date strings, second argument is ${typeof v1}`,
						arg1,
					);
				}
				if (!isValidDate(v0)) {
					return fail(
						"TYPE_MISMATCH",
						"'days_between' first argument is not a valid YYYY-MM-DD date",
						arg0,
					);
				}
				if (!isValidDate(v1)) {
					return fail(
						"TYPE_MISMATCH",
						"'days_between' second argument is not a valid YYYY-MM-DD date",
						arg1,
					);
				}
				const d1 = new Date(`${v0}T00:00:00Z`);
				const d2 = new Date(`${v1}T00:00:00Z`);
				return finite(
					Math.trunc((d2.getTime() - d1.getTime()) / 86_400_000),
					expr,
				);
			}

			// Should never reach here if the parser enforces known builtins
			return fail("UNKNOWN_ERROR", `Unknown built-in function: ${fn}`, expr);
		}
	}
}
