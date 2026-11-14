// Feature: rule-language, Property 3-5: Kleene and/or/not laws
// Validates: Requirements 4.8, 4.9, 4.10, 9.3, 9.4, 9.5, 9.6

import * as fc from "fast-check";
import { describe, it } from "vitest";
import type { Expr } from "../types";
import { UNKNOWN } from "../types";
import type { EvalResult } from "./evaluate";
import { evaluate } from "./evaluate";

// ─── Tri-value arbitrary ──────────────────────────────────────────────────────

/** Generates from the three-element set { true, false, UNKNOWN }. */
const triArbitrary = fc.oneof(
	fc.constant(true as boolean | typeof UNKNOWN),
	fc.constant(false as boolean | typeof UNKNOWN),
	fc.constant(UNKNOWN as boolean | typeof UNKNOWN),
);

// ─── Helper: build an Expr from a known tri-value and evaluate it ─────────────

/**
 * Builds a binary AST node `left op right` using already-constructed
 * sub-expressions and returns the EvalResult.
 */
function evalBinary(
	op: "and" | "or",
	a: boolean | typeof UNKNOWN,
	b: boolean | typeof UNKNOWN,
): EvalResult {
	// Build the sub-expressions as Expr nodes
	function toExpr(v: boolean | typeof UNKNOWN): Expr {
		if (v === UNKNOWN) {
			return { kind: "fact", name: "__missing__" };
		}
		return { kind: "literal", type: "boolean", value: v as boolean };
	}

	return evaluate(
		{ kind: "binary", op, left: toExpr(a), right: toExpr(b) },
		{},
	);
}

/**
 * Extracts the `value` from a successful EvalResult.
 * Throws if the result is an error (the properties should never trigger EvalErrors).
 */
function unwrap(result: EvalResult): boolean | typeof UNKNOWN {
	if (!result.ok) {
		throw new Error(`Unexpected EvalError: ${result.error.message}`);
	}
	return result.value as boolean | typeof UNKNOWN;
}

// ─── Property 3 — `and` Kleene laws ──────────────────────────────────────────

describe("Property 3: and Kleene laws", () => {
	it("false and x = false for all x; x and false = false for all x; true and true = true; true and UNKNOWN = UNKNOWN; UNKNOWN and true = UNKNOWN", () => {
		// **Property 3: and Kleene laws**
		// **Validates: Requirements 4.9, 9.3**
		fc.assert(
			fc.property(triArbitrary, triArbitrary, (a, b) => {
				const result = unwrap(evalBinary("and", a, b));

				// false and x = false
				if (a === false) {
					if (result !== false) return false;
				}
				// x and false = false
				if (b === false) {
					if (result !== false) return false;
				}
				// true and true = true
				if (a === true && b === true) {
					if (result !== true) return false;
				}
				// true and UNKNOWN = UNKNOWN
				if (a === true && b === UNKNOWN) {
					if (result !== UNKNOWN) return false;
				}
				// UNKNOWN and true = UNKNOWN
				if (a === UNKNOWN && b === true) {
					if (result !== UNKNOWN) return false;
				}

				return true;
			}),
			{ numRuns: 100 },
		);
	});
});

// ─── Property 4 — `or` Kleene laws ───────────────────────────────────────────

describe("Property 4: or Kleene laws", () => {
	it("true or x = true for all x; x or true = true for all x; false or false = false; false or UNKNOWN = UNKNOWN; UNKNOWN or false = UNKNOWN", () => {
		// **Property 4: or Kleene laws**
		// **Validates: Requirements 4.10, 9.4**
		fc.assert(
			fc.property(triArbitrary, triArbitrary, (a, b) => {
				const result = unwrap(evalBinary("or", a, b));

				// true or x = true
				if (a === true) {
					if (result !== true) return false;
				}
				// x or true = true
				if (b === true) {
					if (result !== true) return false;
				}
				// false or false = false
				if (a === false && b === false) {
					if (result !== false) return false;
				}
				// false or UNKNOWN = UNKNOWN
				if (a === false && b === UNKNOWN) {
					if (result !== UNKNOWN) return false;
				}
				// UNKNOWN or false = UNKNOWN
				if (a === UNKNOWN && b === false) {
					if (result !== UNKNOWN) return false;
				}

				return true;
			}),
			{ numRuns: 100 },
		);
	});
});

// ─── Property 5 — double negation and De Morgan ───────────────────────────────

describe("Property 5: double negation and De Morgan", () => {
	it("not (not a) = a for all a in {true, false, UNKNOWN}", () => {
		// **Property 5a: double negation**
		// **Validates: Requirements 4.8, 9.5**
		fc.assert(
			fc.property(triArbitrary, (a) => {
				function toExpr(v: boolean | typeof UNKNOWN): Expr {
					if (v === UNKNOWN) {
						return { kind: "fact", name: "__missing__" };
					}
					return { kind: "literal", type: "boolean", value: v as boolean };
				}

				const doubleNot: Expr = {
					kind: "unary",
					op: "not",
					operand: { kind: "unary", op: "not", operand: toExpr(a) },
				};

				const result = unwrap(evaluate(doubleNot, {}));

				return result === a;
			}),
			{ numRuns: 100 },
		);
	});

	it("not (a and b) = (not a) or (not b) for all a, b in {true, false, UNKNOWN}", () => {
		// **Property 5b: De Morgan 1**
		// **Validates: Requirements 4.8, 4.9, 9.6**
		fc.assert(
			fc.property(triArbitrary, triArbitrary, (a, b) => {
				function toExpr(v: boolean | typeof UNKNOWN): Expr {
					if (v === UNKNOWN) {
						return { kind: "fact", name: "__missing__" };
					}
					return { kind: "literal", type: "boolean", value: v as boolean };
				}

				// not (a and b)
				const lhs: Expr = {
					kind: "unary",
					op: "not",
					operand: {
						kind: "binary",
						op: "and",
						left: toExpr(a),
						right: toExpr(b),
					},
				};

				// (not a) or (not b)
				const rhs: Expr = {
					kind: "binary",
					op: "or",
					left: { kind: "unary", op: "not", operand: toExpr(a) },
					right: { kind: "unary", op: "not", operand: toExpr(b) },
				};

				const lhsResult = unwrap(evaluate(lhs, {}));
				const rhsResult = unwrap(evaluate(rhs, {}));

				return lhsResult === rhsResult;
			}),
			{ numRuns: 100 },
		);
	});

	it("not (a or b) = (not a) and (not b) for all a, b in {true, false, UNKNOWN}", () => {
		// **Property 5c: De Morgan 2**
		// **Validates: Requirements 4.8, 4.10, 9.6**
		fc.assert(
			fc.property(triArbitrary, triArbitrary, (a, b) => {
				function toExpr(v: boolean | typeof UNKNOWN): Expr {
					if (v === UNKNOWN) {
						return { kind: "fact", name: "__missing__" };
					}
					return { kind: "literal", type: "boolean", value: v as boolean };
				}

				// not (a or b)
				const lhs: Expr = {
					kind: "unary",
					op: "not",
					operand: {
						kind: "binary",
						op: "or",
						left: toExpr(a),
						right: toExpr(b),
					},
				};

				// (not a) and (not b)
				const rhs: Expr = {
					kind: "binary",
					op: "and",
					left: { kind: "unary", op: "not", operand: toExpr(a) },
					right: { kind: "unary", op: "not", operand: toExpr(b) },
				};

				const lhsResult = unwrap(evaluate(lhs, {}));
				const rhsResult = unwrap(evaluate(rhs, {}));

				return lhsResult === rhsResult;
			}),
			{ numRuns: 100 },
		);
	});
});
