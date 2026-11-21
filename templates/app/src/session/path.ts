import {
	answer,
	type FactValue,
	type KnowledgeBase,
	next,
	start,
} from "@dead-certain/engine";

/**
 * The facts the engine asks, in order, found by replaying the answers from an
 * empty session. The open question, if any, is last. It ends because each pass
 * answers one more fact.
 */
export function questionPath(
	kb: KnowledgeBase,
	answers: Readonly<Record<string, FactValue>>,
): string[] {
	let s = start(kb);
	const path: string[] = [];
	for (;;) {
		const step = next(s);
		if (step.kind === "verdict") return path;
		path.push(step.fact);
		const value = answers[step.fact];
		if (value === undefined) return path;
		s = answer(s, step.fact, value);
	}
}
