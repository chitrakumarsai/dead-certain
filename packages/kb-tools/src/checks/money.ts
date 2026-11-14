import { type Expr, print } from "@dead-certain/engine";
import {
	clip,
	type LocatedDiagnostic,
	makeError,
	SECTION,
} from "../diagnostics";
import { factRefs } from "../expr-walk";
import type { ParsedKb } from "../model";

/** Minimal view of the fact table that the classifier needs. */
export type MoneyFacts = ReadonlyMap<
	string,
	{ readonly def: { readonly type: string } }
>;

function isIntegerLiteral(expr: Expr): boolean {
	return (
		expr.kind === "literal" &&
		expr.type === "number" &&
		typeof expr.value === "number" &&
		Number.isInteger(expr.value)
	);
}

/**
 * Requirement 12, criterion 1: true when `expr` can only produce a whole
 * number of minor units.
 */
export function isRoundedMoney(expr: Expr, facts: MoneyFacts): boolean {
	switch (expr.kind) {
		case "literal":
			return isIntegerLiteral(expr);
		case "fact":
			return facts.get(expr.name)?.def.type === "money";
		case "unary":
			return expr.op === "-" && isRoundedMoney(expr.operand, facts);
		case "binary": {
			if (expr.op === "+" || expr.op === "-") {
				return (
					isRoundedMoney(expr.left, facts) && isRoundedMoney(expr.right, facts)
				);
			}
			if (expr.op === "*") {
				return (
					(isRoundedMoney(expr.left, facts) && isIntegerLiteral(expr.right)) ||
					(isIntegerLiteral(expr.left) && isRoundedMoney(expr.right, facts))
				);
			}
			return false;
		}
		case "call":
			switch (expr.fn) {
				case "round":
					return true;
				case "min":
				case "max":
					return expr.args.every((a) => isRoundedMoney(a, facts));
				case "if":
					return expr.args.slice(1).every((a) => isRoundedMoney(a, facts));
				default:
					return false;
			}
	}
}

/** MONEY_NOT_ROUNDED for every money rule whose parsed `to` is not rounded. */
export function checkMoney(kb: ParsedKb, file: string): LocatedDiagnostic[] {
	const out: LocatedDiagnostic[] = [];
	for (const rule of kb.rules) {
		const to = rule.toExpr;
		if (to === undefined) continue;
		if (kb.facts.get(rule.set)?.def.type !== "money") continue;
		try {
			// An undeclared fact is already UNKNOWN_FACT; do not pile on.
			if (factRefs(to).some((name) => !kb.facts.has(name))) continue;
			if (isRoundedMoney(to, kb.facts)) continue;
			out.push(
				makeError(
					"MONEY_NOT_ROUNDED",
					file,
					`Rule '${clip(rule.id)}' sets money fact '${clip(rule.set)}' from '${clip(print(to))}', which can produce a fraction. Wrap the expression in round(...).`,
					{
						id: rule.id,
						field: "to",
						at: { section: SECTION.rules, index: rule.index },
					},
				),
			);
		} catch (error) {
			// Too deeply nested to classify; the type check reports that case.
			if (!(error instanceof RangeError)) throw error;
		}
	}
	return out;
}
