// The only module that names a fact or a goal (requirement 5.3).
// The compiled knowledge base is written by `pnpm dc build` to kb/dist/starter.json.
import compiled from "../kb/dist/starter.json";

export const config = {
	/** The goal whose value is the verdict word, such as `paid` or `ready`. Change it when the rules change. */
	verdictGoal: "outcome",
} as const;

/** The compiled JSON, not yet shape-checked. */
export const compiledKb: unknown = compiled;
