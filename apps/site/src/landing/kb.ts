import { type Clause, type KnowledgeBase, print } from "@dead-certain/engine";
import { humanize } from "@dead-certain/ui";

// Read-only helpers over the knowledge base, copied from apps/claim-check/src/kb.ts.

/** The kit's FormatContext: money is printed in the knowledge base's currency. */
export const formatFor = (kb: KnowledgeBase) => ({ currency: kb.currency });

/** The fact's label, or a name derived from the fact id. */
export const labelFor = (kb: KnowledgeBase, fact: string): string =>
	kb.facts[fact]?.label ?? humanize(fact);

export const clauseFor = (kb: KnowledgeBase, id: string): Clause | undefined =>
	kb.clauses[id];

/** The rule's expression in the rule language, with its condition when it has one. */
export function ruleExpression(kb: KnowledgeBase, ruleId: string): string {
	const rule = kb.rules.find((r) => r.id === ruleId);
	if (rule === undefined) return "";
	const to = print(rule.to);
	return rule.when === undefined ? to : `${to} when ${print(rule.when)}`;
}
