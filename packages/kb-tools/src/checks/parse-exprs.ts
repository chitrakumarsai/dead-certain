import { type Expr, parse } from "@dead-certain/engine";
import {
	clip,
	type LocatedDiagnostic,
	makeError,
	SECTION,
} from "../diagnostics";
import { children } from "../expr-walk";
import type { ParsedKb, ParsedRule } from "../model";

/** True when the tree holds a number literal that is not finite. Iterative. */
function hasNonFiniteNumber(expr: Expr): boolean {
	const stack: Expr[] = [expr];
	while (stack.length > 0) {
		const node = stack.pop() as Expr;
		if (
			node.kind === "literal" &&
			typeof node.value === "number" &&
			!Number.isFinite(node.value)
		) {
			return true;
		}
		stack.push(...children(node));
	}
	return false;
}

function parseField(
	rule: ParsedRule,
	field: "to" | "when",
	source: string,
	file: string,
): { expr?: Expr; diagnostic?: LocatedDiagnostic } {
	const parts = {
		id: rule.id,
		field,
		at: { section: SECTION.rules, index: rule.index },
	};
	try {
		const result = parse(source);
		if (!result.ok) {
			const e = result.error;
			return {
				diagnostic: makeError(
					"PARSE_ERROR",
					file,
					`Rule '${rule.id}' field '${field}' does not parse (${e.code} at position ${e.position}): ${e.message} Source: '${clip(source)}'`,
					parts,
				),
			};
		}
		if (hasNonFiniteNumber(result.expr)) {
			return {
				diagnostic: makeError(
					"PARSE_ERROR",
					file,
					`Rule '${rule.id}' field '${field}' holds a number literal that is too large to be finite. Source: '${clip(source)}'`,
					parts,
				),
			};
		}
		return { expr: result.expr };
	} catch (error) {
		if (error instanceof RangeError) {
			return {
				diagnostic: makeError(
					"PARSE_ERROR",
					file,
					`Rule '${rule.id}' field '${field}' is too deeply nested to parse. Source: '${clip(source)}'`,
					parts,
				),
			};
		}
		throw error;
	}
}

/**
 * Parse every rule's `to` and `when` with the Engine's parser, exactly as the
 * canonical text. Stores the parsed Expr on the rule. Never evaluates.
 */
export function checkParseExprs(
	kb: ParsedKb,
	file: string,
): LocatedDiagnostic[] {
	const diagnostics: LocatedDiagnostic[] = [];
	for (const rule of kb.rules) {
		const to = parseField(rule, "to", rule.toText, file);
		if (to.expr !== undefined) rule.toExpr = to.expr;
		if (to.diagnostic !== undefined) diagnostics.push(to.diagnostic);

		if (rule.whenText !== undefined) {
			const when = parseField(rule, "when", rule.whenText, file);
			if (when.expr !== undefined) rule.whenExpr = when.expr;
			if (when.diagnostic !== undefined) diagnostics.push(when.diagnostic);
		}
	}
	return diagnostics;
}
