// The only module that names a fact or a goal (requirement 1.7).
// The compiled knowledge base is written by `pnpm dc build` to kb/dist/policy.json.
import type { FactValue } from "@dead-certain/engine";
import compiled from "../kb/dist/policy.json";

export const config = {
	/** Money goal: the amount the policy pays, in minor units. */
	amountGoal: "payable",
	/** Enum goal with the values paid, reduced and denied. */
	stateGoal: "outcome",
	/** Money fact: the total on the hospital bill. */
	claimedFact: "claimed",
} as const;

/** Shown after a number field. The knowledge base has no unit field. */
export const units: Readonly<Record<string, string>> = {
	room_days: "days",
	age: "years",
};

/**
 * The parts of the bill the answers name: Annexure 1 items and room charges.
 * Together they cannot be more than the bill, or the deductions would be too.
 */
export function namedCharges(
	answers: Readonly<Record<string, FactValue>>,
): number {
	const n = (fact: string) => {
		const v = answers[fact];
		return typeof v === "number" ? v : 0;
	};
	return n("annexure_items") + n("room_rent_per_day") * n("room_days");
}

/** The compiled JSON, not yet shape-checked. */
export const compiledKb: unknown = compiled;
