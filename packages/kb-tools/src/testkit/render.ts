// Test-only. Never imported from non-test source, never exported from index.ts.
import { type KnowledgeBase, print } from "@dead-certain/engine";
import { stringify } from "yaml";

/**
 * Render a KnowledgeBase as knowledge-base YAML. Expressions are written with the
 * engine's printer. The yaml library quotes any string that plain YAML would misread
 * (`to: "'gold'"`, `"4.2":` as a key, `"true"`), and maps are built with
 * Object.fromEntries so keys such as `__proto__` stay ordinary keys.
 */
export function renderYaml(kb: KnowledgeBase): string {
	return renderDoc(docOf(kb));
}

/** A mutable plain-object form of a knowledge-base file, before YAML rendering. */
export interface KbDoc {
	id: string;
	currency?: string;
	goals: string[];
	facts: Record<string, Record<string, unknown>>;
	rules: Record<string, unknown>[];
	clauses: Record<string, Record<string, unknown>>;
	[key: string]: unknown;
}

/** Render a plain document (possibly with injected faults) as YAML text. */
export function renderDoc(doc: unknown): string {
	return stringify(doc, { lineWidth: 0 });
}

/** The document form of a knowledge base. A fresh object on every call. */
export function docOf(kb: KnowledgeBase): KbDoc {
	return {
		id: kb.id,
		...(kb.currency === undefined ? {} : { currency: kb.currency }),
		goals: [...kb.goals],
		facts: Object.fromEntries(
			Object.entries(kb.facts).map(([name, def]) => [name, { ...def }]),
		),
		rules: kb.rules.map((rule) => ({
			id: rule.id,
			cite: rule.cite,
			set: rule.set,
			...(rule.when === undefined ? {} : { when: print(rule.when) }),
			to: print(rule.to),
			because: rule.because,
		})),
		clauses: Object.fromEntries(
			Object.entries(kb.clauses).map(([id, clause]) => [
				id,
				{ title: clause.title, text: clause.text },
			]),
		),
	};
}
