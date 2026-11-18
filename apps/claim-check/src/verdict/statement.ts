import type { KnowledgeBase, Verdict } from "@dead-certain/engine";
import {
	formatMoney,
	type VerdictState,
	verdictStateFrom,
} from "@dead-certain/ui";
import { config } from "../config";

export const stateOf = (verdict: Verdict): VerdictState =>
	verdictStateFrom(verdict.goals[config.stateGoal], verdict.needed.length);

/** "₹1,42,500 of ₹2,10,000 will be paid" (6.2). */
export function statementFor(
	kb: KnowledgeBase,
	payable: number,
	claimed: number,
): string {
	const currency = kb.currency ?? "INR";
	return `${formatMoney(payable, currency)} of ${formatMoney(claimed, currency)} will be paid`;
}
