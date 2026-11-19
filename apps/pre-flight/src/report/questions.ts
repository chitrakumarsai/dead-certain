import type { KnowledgeBase, ProofNode, Question } from "@dead-certain/engine";

/** Every fact in the proof, in tree order. */
function factsIn(proof: ProofNode): Set<string> {
	const out = new Set<string>();
	const walk = (n: ProofNode) => {
		out.add(n.fact);
		n.children.forEach(walk);
	};
	walk(proof);
	return out;
}

/**
 * Where each needed question goes (6.1, 6.4): a boolean question inline in the
 * first unknown check whose proof holds its fact, everything else in the list.
 * Only the engine's `needed` is ever asked (6.8).
 */
export function placeQuestions(
	kb: KnowledgeBase,
	unknownChecks: readonly { fact: string; proof: ProofNode }[],
	needed: readonly Question[],
): { inline: Map<string, Question>; list: Question[] } {
	const inline = new Map<string, Question>();
	const list: Question[] = [];
	const owners = unknownChecks.map((c) => ({
		fact: c.fact,
		facts: factsIn(c.proof),
	}));
	for (const q of needed) {
		const owner =
			kb.facts[q.fact]?.type === "boolean"
				? owners.find((o) => o.facts.has(q.fact) && !inline.has(o.fact))
				: undefined;
		if (owner === undefined) list.push(q);
		else inline.set(owner.fact, q);
	}
	return { inline, list };
}
