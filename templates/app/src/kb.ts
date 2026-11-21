import {
	type Clause,
	type FactValue,
	type KnowledgeBase,
	print,
} from "@dead-certain/engine";
import { formatValue, humanize } from "@dead-certain/ui";
import { compiledKb, config } from "./config";
import { isKnowledgeBase } from "./kbShape";

/** The knowledge base, or null when the compiled JSON fails its shape check. */
export const loadedKb: KnowledgeBase | null = isKnowledgeBase(
	compiledKb,
	config.verdictGoal,
)
	? compiledKb
	: null;

/** The kit's FormatContext: money is printed in the knowledge base's currency. */
export const formatFor = (kb: KnowledgeBase) => ({ currency: kb.currency });

/** The fact's label, or a name derived from the fact id. */
export const labelFor = (kb: KnowledgeBase, fact: string): string =>
	kb.facts[fact]?.label ?? humanize(fact);

export const clauseFor = (kb: KnowledgeBase, id: string): Clause | undefined =>
	kb.clauses[id];

/** A fact's value as the interface prints it. */
export function printValue(
	kb: KnowledgeBase,
	fact: string,
	value: FactValue,
): string {
	const def = kb.facts[fact];
	return def === undefined
		? String(value)
		: formatValue(def, value, formatFor(kb));
}

/** The rule's expression in the rule language, with its condition when it has one. */
export function ruleExpression(kb: KnowledgeBase, ruleId: string): string {
	const rule = kb.rules.find((r) => r.id === ruleId);
	if (rule === undefined) return "";
	const to = print(rule.to);
	return rule.when === undefined ? to : `${to} when ${print(rule.when)}`;
}
