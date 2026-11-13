import type { Expr } from "@dead-certain/engine";
import {
	clip,
	type LocatedDiagnostic,
	makeError,
	SECTION,
} from "../diagnostics";
import { children, valueLeaves } from "../expr-walk";
import type { ParsedKb } from "../model";

/** Enum literal checks for every rule's `to` and `when` (Requirement 9). */
export function checkEnums(kb: ParsedKb, file: string): LocatedDiagnostic[] {
	const out: LocatedDiagnostic[] = [];

	for (const rule of kb.rules) {
		const at = { section: SECTION.rules, index: rule.index };

		const report = (
			field: "to" | "when",
			literal: string,
			factName: string,
		) => {
			const options = kb.facts.get(factName)?.def.options ?? [];
			out.push(
				makeError(
					"ENUM_VALUE_NOT_IN_OPTIONS",
					file,
					clip(
						`Rule '${rule.id}' field '${field}': '${literal}' is not an option of enum fact '${factName}' (options: ${options.join(", ")}).`,
					),
					{ id: rule.id, field, at },
				),
			);
		};

		const enumOptions = (factName: string): readonly string[] | undefined => {
			const def = kb.facts.get(factName)?.def;
			return def?.type === "enum" ? (def.options ?? []) : undefined;
		};

		const enumLiteral = (node: Expr): string | undefined =>
			node.kind === "literal" && node.type === "enum"
				? String(node.value)
				: undefined;

		const scan = (field: "to" | "when", expr: Expr | undefined): void => {
			if (expr === undefined) return;

			// Criterion 1 applies to `to` only.
			if (field === "to") {
				const options = enumOptions(rule.set);
				if (options !== undefined) {
					for (const leaf of valueLeaves(expr)) {
						const lit = enumLiteral(leaf);
						if (lit !== undefined && !options.includes(lit)) {
							report(field, lit, rule.set);
						}
					}
				}
			}

			// Criterion 2: ==/!= between an enum literal and an enum fact.
			const stack: Expr[] = [expr];
			while (stack.length > 0) {
				const node = stack.pop() as Expr;
				if (node.kind === "binary" && (node.op === "==" || node.op === "!=")) {
					for (const [lit, fact] of [
						[node.left, node.right],
						[node.right, node.left],
					] as const) {
						const value = enumLiteral(lit);
						if (value === undefined || fact.kind !== "fact") continue;
						const options = enumOptions(fact.name);
						if (options !== undefined && !options.includes(value)) {
							report(field, value, fact.name);
						}
					}
				}
				const kids = children(node);
				for (let i = kids.length - 1; i >= 0; i -= 1) {
					stack.push(kids[i] as Expr);
				}
			}
		};

		scan("to", rule.toExpr);
		scan("when", rule.whenExpr);
	}
	return out;
}
