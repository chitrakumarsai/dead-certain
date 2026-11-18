import type { Clause, KnowledgeBase, Rule } from "@dead-certain/engine";

export interface Coverage {
	/** Every clause id, in natural order, with the rules that cite it (possibly none). */
	readonly byClause: Readonly<Record<string, readonly Rule[]>>;
	/** Every rule, in knowledge-base order, with its clause when the knowledge base holds it. */
	readonly byRule: readonly { rule: Rule; clause: Clause | undefined }[];
	/** Rules whose cite is not a clause in the knowledge base. */
	readonly missing: readonly Rule[];
}

/** Natural order for clause ids, so 4.10 follows 4.9. */
export const byClauseId = (a: string, b: string): number =>
	a.localeCompare(b, "en", { numeric: true });

/** Which rules use each clause, and which clause each rule uses (requirement 9). */
export function coverage(kb: KnowledgeBase): Coverage {
	const ids = Object.keys(kb.clauses).sort(byClauseId);
	const byClause = Object.fromEntries(
		ids.map((id) => [id, kb.rules.filter((r) => r.cite === id)]),
	);
	const byRule = kb.rules.map((rule) => ({
		rule,
		clause: Object.hasOwn(kb.clauses, rule.cite)
			? kb.clauses[rule.cite]
			: undefined,
	}));
	return {
		byClause,
		byRule,
		missing: byRule.filter((r) => r.clause === undefined).map((r) => r.rule),
	};
}
