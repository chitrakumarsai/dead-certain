import { type LocatedDiagnostic, makeWarning, SECTION } from "../diagnostics";
import type { ParsedKb } from "../model";

/**
 * NO_FALLBACK_RULE (warning): a `role: deduction` fact that no rule without a
 * `when` guard sets. Facts with `role: check` or no role are skipped.
 */
export function checkFallback(kb: ParsedKb, file: string): LocatedDiagnostic[] {
	const unguarded = new Set<string>();
	for (const rule of kb.rules) {
		if (rule.whenText === undefined) unguarded.add(rule.set);
	}
	const out: LocatedDiagnostic[] = [];
	for (const [name, fact] of kb.facts) {
		if (fact.def.role !== "deduction" || unguarded.has(name)) continue;
		out.push(
			makeWarning(
				"NO_FALLBACK_RULE",
				file,
				`Deduction fact '${name}' has no rule without a 'when' guard, so the engine reports it as undefined whenever every guard is false. Add an unguarded default rule.`,
				{ id: name, at: { section: SECTION.facts, index: fact.index } },
			),
		);
	}
	return out;
}
