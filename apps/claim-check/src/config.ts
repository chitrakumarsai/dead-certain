// The only module that names a fact or a goal (requirement 1.7).
// The compiled knowledge base is written by `pnpm dc build` to kb/dist/policy.json.
import compiled from "../kb/dist/policy.json";

export const config = {
	/** Money goal: the amount the policy pays, in minor units. */
	amountGoal: "payable",
	/** Enum goal with the values paid, reduced and denied. */
	stateGoal: "outcome",
	/** Money fact: the total on the hospital bill. */
	claimedFact: "claimed",
} as const;

/** The compiled JSON, not yet shape-checked. */
export const compiledKb: unknown = compiled;
