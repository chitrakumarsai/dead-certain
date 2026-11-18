import {
	explain,
	type FactValue,
	type ProofNode,
	type Session,
} from "@dead-certain/engine";
import { formatValue, type SkippedNote } from "@dead-certain/ui";
import { defFor, formatFor, labelFor } from "../kb";
import { questionPath } from "./path";

// An unanswered leaf also carries source "answered", so the answer itself is checked.
function collectAnswered(node: ProofNode, s: Session, into: Set<string>): void {
	if (node.source === "answered" && s.answers[node.fact] !== undefined)
		into.add(node.fact);
	for (const child of node.children) collectAnswered(child, s, into);
}

/**
 * Answered facts on the question path that the goals' proofs use, plus the
 * question being asked. The path matters too: a proof refers to every fact
 * its rules name, even after an early stop made the later answers unnecessary.
 */
export function relevantFacts(s: Session, currentFact?: string): Set<string> {
	const inProof = new Set<string>();
	for (const goal of s.kb.goals) collectAnswered(explain(s, goal), s, inProof);
	const facts = new Set(
		questionPath(s.kb, s.answers).filter((fact) => inProof.has(fact)),
	);
	if (currentFact !== undefined) facts.add(currentFact);
	return facts;
}

/** A fact's value as the interface prints it. */
export function printValue(s: Session, fact: string, value: FactValue): string {
	const def = defFor(s.kb, fact);
	return def === undefined
		? String(value)
		: formatValue(def, value, formatFor(s.kb));
}

/** Facts one answer made irrelevant, each with the reason (requirement 4.5). */
export function skippedNotes(
	before: Session,
	after: Session,
	changed: string,
): SkippedNote[] {
	const was = relevantFacts(before);
	const now = relevantFacts(after);
	const value = after.answers[changed];
	if (value === undefined) return [];
	const reason = `Not needed now that ${labelFor(after.kb, changed)} is ${printValue(after, changed, value)}.`;
	return [...was]
		.filter((fact) => fact !== changed && !now.has(fact))
		.map((fact) => ({ fact, label: labelFor(after.kb, fact), reason }));
}

/**
 * The skipped list after one answer: earlier notes whose fact is still not
 * relevant, then the new ones. A fact relevant again leaves the list (4.6).
 */
export function updateSkipped(
	previous: readonly SkippedNote[],
	before: Session,
	after: Session,
	changed: string,
): SkippedNote[] {
	const now = relevantFacts(after);
	const added = skippedNotes(before, after, changed);
	const kept = previous.filter(
		(note) => !now.has(note.fact) && !added.some((n) => n.fact === note.fact),
	);
	return [...kept, ...added];
}
