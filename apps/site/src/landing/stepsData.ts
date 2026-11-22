import type { Clause, KnowledgeBase } from "@dead-certain/engine";
import { ruleExpression } from "./kb";

export interface StepsData {
	clause: Clause;
	rule: { id: string; because: string; expression: string; cite: string };
}

/** The rule the steps quote, with its clause, read from the knowledge base; null when either is missing. */
export function steps(kb: KnowledgeBase, ruleId: string): StepsData | null {
	const rule = kb.rules.find((r) => r.id === ruleId);
	const clause = rule === undefined ? undefined : kb.clauses[rule.cite];
	if (rule === undefined || clause === undefined) return null;
	return {
		clause,
		rule: {
			id: rule.id,
			because: rule.because,
			expression: ruleExpression(kb, rule.id),
			cite: rule.cite,
		},
	};
}
