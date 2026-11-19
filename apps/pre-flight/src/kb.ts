// The compiled knowledge base is written by `pnpm dc build` to kb/dist/checklist.json.
import {
	type Clause,
	type FactDef,
	type KnowledgeBase,
	print,
} from "@dead-certain/engine";
import { humanize } from "@dead-certain/ui";
import compiled from "../kb/dist/checklist.json";
import { isKnowledgeBase } from "./kbShape";

/** The compiled JSON, not yet shape-checked. */
export const compiledKb: unknown = compiled;

/** The knowledge base, or null when the compiled JSON fails its shape check (1.9). */
export const kb: KnowledgeBase | null = isKnowledgeBase(compiledKb)
	? compiledKb
	: null;

export const defFor = (k: KnowledgeBase, fact: string): FactDef | undefined =>
	k.facts[fact];

/** The fact's label, or a name derived from the fact id. */
export const labelFor = (k: KnowledgeBase, fact: string): string =>
	k.facts[fact]?.label ?? humanize(fact);

export const clauseFor = (k: KnowledgeBase, id: string): Clause | undefined =>
	k.clauses[id];

/** The rule's expression in the rule language, with its condition when it has one. */
export function ruleExpression(k: KnowledgeBase, ruleId: string): string {
	const rule = k.rules.find((r) => r.id === ruleId);
	if (rule === undefined) return "";
	const to = print(rule.to);
	return rule.when === undefined ? to : `${to} when ${print(rule.when)}`;
}
