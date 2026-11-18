import type { FactDef, FactValue, KnowledgeBase } from "@dead-certain/engine";
import { EXTRACTORS, type Extractor } from "./extractors";
import type { RepoSnapshot } from "./types";

export interface Derived {
	/** Collected facts, each of its declared type. */
	facts: Record<string, FactValue>;
	/** One evidence line per collected fact, at most 200 characters. */
	evidence: Record<string, string>;
	/** Non-derived facts the snapshot cannot give; the app asks for them. */
	unseen: string[];
}

const EVIDENCE_LIMIT = 200;

/** True when `value` has the fact's declared type (and, for an enum, is one of its options). */
function fits(def: FactDef, value: FactValue): boolean {
	switch (def.type) {
		case "boolean":
			return typeof value === "boolean";
		case "number":
			return typeof value === "number" && Number.isFinite(value);
		case "money":
			return typeof value === "number" && Number.isSafeInteger(value);
		case "date":
			return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
		case "enum":
			return typeof value === "string" && (def.options ?? []).includes(value);
	}
}

/** The facts a snapshot shows, never guessed (requirements 3.14 to 3.16). Pure. */
export function deriveFacts(
	snapshot: RepoSnapshot,
	kb: KnowledgeBase,
	extractors: Readonly<Record<string, Extractor>> = EXTRACTORS,
): Derived {
	const derived: Derived = { facts: {}, evidence: {}, unseen: [] };
	for (const [fact, def] of Object.entries(kb.facts)) {
		if (def.derived === true) continue;
		const extractor = Object.hasOwn(extractors, fact)
			? extractors[fact]
			: undefined;
		const blind = extractor?.reads === "tree" && snapshot.tree.truncated;
		const result =
			extractor === undefined || blind ? undefined : extractor.read(snapshot);
		if (result === undefined || !fits(def, result.value)) {
			derived.unseen.push(fact);
			continue;
		}
		derived.facts[fact] = result.value;
		derived.evidence[fact] = result.evidence.slice(0, EVIDENCE_LIMIT);
	}
	return derived;
}
