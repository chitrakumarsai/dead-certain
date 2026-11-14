import { type Expr, print } from "@dead-certain/engine";
import {
	clip,
	type LocatedDiagnostic,
	makeWarning,
	SECTION,
} from "../diagnostics";
import { exprEqual } from "../expr-walk";
import type { ParsedKb } from "../model";

function isAnd(e: Expr): e is Extract<Expr, { kind: "binary" }> {
	return e.kind === "binary" && e.op === "and";
}

function isNotOf(e: Expr, x: Expr): boolean {
	return e.kind === "unary" && e.op === "not" && exprEqual(e.operand, x);
}

/**
 * True when the guard can never be true: the literal `false`, or an `and`
 * whose operand is dead (at any depth of nested `and` nodes) or whose two
 * operands are `x` and `not x`. Iterative over the `and` tree.
 */
export function isDead(expr: Expr): boolean {
	const stack: Expr[] = [expr];
	while (stack.length > 0) {
		const e = stack.pop() as Expr;
		if (e.kind === "literal") {
			if (e.type === "boolean" && e.value === false) return true;
			continue;
		}
		if (!isAnd(e)) continue;
		if (isNotOf(e.right, e.left) || isNotOf(e.left, e.right)) return true;
		stack.push(e.left, e.right);
	}
	return false;
}

/** DEAD_GUARD (warning) for every rule whose parsed `when` is dead. */
export function checkDeadGuards(
	kb: ParsedKb,
	file: string,
): LocatedDiagnostic[] {
	const out: LocatedDiagnostic[] = [];
	for (const rule of kb.rules) {
		const when = rule.whenExpr;
		if (when === undefined) continue;
		try {
			if (!isDead(when)) continue;
			out.push(
				makeWarning(
					"DEAD_GUARD",
					file,
					`Rule '${clip(rule.id)}' has a guard that can never be true: '${clip(print(when))}'. The rule never fires.`,
					{
						id: rule.id,
						field: "when",
						at: { section: SECTION.rules, index: rule.index },
					},
				),
			);
		} catch (error) {
			// Too deeply nested to print; the parse check reports that case.
			if (!(error instanceof RangeError)) throw error;
		}
	}
	return out;
}
