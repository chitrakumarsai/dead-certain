import type { Alternative, KnowledgeBase } from "@dead-certain/engine";
import { config } from "../config";

/**
 * The alternatives worth showing: the amount is known, and a money value is a
 * whole currency unit. The engine also probes one minor unit either side of a
 * threshold (₹4,999.99, ₹5,000.01), which reads as noise next to ₹5,000.
 */
export function usefulAlternatives(
	kb: KnowledgeBase,
	alternatives: readonly Alternative[],
): Alternative[] {
	return alternatives.filter((alt) => {
		if (alt.verdict.goals[config.amountGoal] === undefined) return false;
		const isMoney = kb.facts[alt.fact]?.type === "money";
		return !isMoney || (typeof alt.value === "number" && alt.value % 100 === 0);
	});
}
