import type { Expr } from "@dead-certain/engine";
import {
	clip,
	type LocatedDiagnostic,
	makeError,
	SECTION,
} from "../diagnostics";
import { factRefs } from "../expr-walk";
import type { ParsedKb, ParsedRule } from "../model";

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]{0,127})\}/g;

/** Message for a fact name that is not defined (Requirement 6). */
function unknownFactMessage(name: string, expr: Expr): string {
	const shown = clip(name);
	if (expr.kind === "fact") {
		return `Fact '${shown}' is not defined — did you mean the enum literal '${shown}'? Corrected YAML: "'${shown}'"`;
	}
	return `Fact '${shown}' is not defined.`;
}

function checkExpr(
	kb: ParsedKb,
	rule: ParsedRule,
	field: "to" | "when",
	expr: Expr | undefined,
	file: string,
	out: LocatedDiagnostic[],
): void {
	if (expr === undefined) return;
	for (const name of factRefs(expr)) {
		if (kb.facts.has(name)) continue;
		out.push(
			makeError("UNKNOWN_FACT", file, unknownFactMessage(name, expr), {
				id: rule.id,
				field,
				at: { section: SECTION.rules, index: rule.index },
			}),
		);
	}
}

/**
 * Reference and id checks: UNKNOWN_FACT, DUPLICATE_RULE, UNKNOWN_GOAL,
 * UNKNOWN_SET_FACT, UNKNOWN_CLAUSE and UNKNOWN_PLACEHOLDER. Lookups go through
 * Maps, so names such as `toString` and `__proto__` are ordinary names.
 * DUPLICATE_FACT and DUPLICATE_CLAUSE come from the Loader.
 */
export function checkRefs(kb: ParsedKb, file: string): LocatedDiagnostic[] {
	const out: LocatedDiagnostic[] = [];

	kb.goals.forEach((goal, index) => {
		if (kb.facts.has(goal)) return;
		out.push(
			makeError("UNKNOWN_GOAL", file, `Goal '${clip(goal)}' is not a fact.`, {
				id: goal,
				at: { section: SECTION.goals, index },
			}),
		);
	});

	const seenRuleIds = new Set<string>();
	for (const rule of kb.rules) {
		const at = { section: SECTION.rules, index: rule.index };

		if (seenRuleIds.has(rule.id)) {
			out.push(
				makeError(
					"DUPLICATE_RULE",
					file,
					`Rule id '${clip(rule.id)}' is used by more than one rule.`,
					{ id: rule.id, at },
				),
			);
		}
		seenRuleIds.add(rule.id);

		if (!kb.facts.has(rule.set)) {
			out.push(
				makeError(
					"UNKNOWN_SET_FACT",
					file,
					`Rule '${clip(rule.id)}' sets '${clip(rule.set)}', which is not a fact.`,
					{ id: rule.id, field: "set", at },
				),
			);
		}

		if (!kb.clauses.has(rule.cite)) {
			out.push(
				makeError(
					"UNKNOWN_CLAUSE",
					file,
					`Rule '${clip(rule.id)}' cites clause '${clip(rule.cite)}', which is not in clauses.`,
					{ id: rule.id, field: "cite", at },
				),
			);
		}

		checkExpr(kb, rule, "to", rule.toExpr, file, out);
		checkExpr(kb, rule, "when", rule.whenExpr, file, out);

		const reported = new Set<string>();
		for (const match of rule.because.matchAll(PLACEHOLDER)) {
			const name = match[1] as string;
			if (kb.facts.has(name) || reported.has(name)) continue;
			reported.add(name);
			out.push(
				makeError(
					"UNKNOWN_PLACEHOLDER",
					file,
					`The 'because' text of rule '${clip(rule.id)}' uses {${name}}, which is not a fact.`,
					{ id: rule.id, field: "because", at },
				),
			);
		}
	}

	return out;
}
