import type { FactValue } from "@dead-certain/engine/types";
import type { VerdictState } from "./types";

/** The only place the verdict vocabulary lives. Goal value to headline state. */
export const GOAL_TO_STATE: Readonly<Record<string, VerdictState>> = {
	paid: "paid",
	reduced: "reduced",
	denied: "denied",
	ready: "ready",
	not_ready: "not_ready",
};

/** The word for each state, shared by every component that names a verdict. */
export const VERDICT_WORDS: Readonly<Record<VerdictState, string>> = {
	paid: "Paid in full",
	reduced: "Paid in part",
	denied: "Not paid",
	ready: "Ready",
	not_ready: "Not ready",
	undecided: "More answers needed",
};

/**
 * The headline state for a verdict goal. Total: any value outside the table,
 * or no value yet, is "undecided". `needed` is the count of questions still
 * open; it does not change the state today and is kept for the signature the
 * design fixes.
 */
export function verdictStateFrom(
	goal: FactValue | undefined,
	_needed: number,
): VerdictState {
	// hasOwn, not `in`: "toString" is in every object.
	if (typeof goal === "string" && Object.hasOwn(GOAL_TO_STATE, goal)) {
		return GOAL_TO_STATE[goal] as VerdictState;
	}
	return "undecided";
}
