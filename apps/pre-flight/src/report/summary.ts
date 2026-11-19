import type { FactValue } from "@dead-certain/engine";
import { type VerdictState, verdictStateFrom } from "@dead-certain/ui";
import type { Severity } from "../checklists";

export interface Summary {
	state: VerdictState;
	sentence: string;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * The headline state comes from the goal; the counts only count rows the
 * engine already decided (5.2 to 5.4).
 */
export function summarize(
	goal: FactValue | undefined,
	checks: readonly { severity: Severity; value: FactValue | undefined }[],
	needed: number,
	repo: string,
): Summary {
	const state = verdictStateFrom(goal, needed);
	if (state === "ready")
		return { state, sentence: `All ${checks.length} checks passed in ${repo}` };
	if (state === "not_ready") {
		const failed = (s: Severity) =>
			checks.filter((c) => c.value === false && c.severity === s).length;
		const parts = [
			failed("blocker") > 0 ? plural(failed("blocker"), "blocker") : "",
			failed("warning") > 0 ? plural(failed("warning"), "warning") : "",
		].filter((p) => p !== "");
		return { state, sentence: `${parts.join(" and ")} in ${repo}` };
	}
	const open = checks.filter((c) => c.value === undefined).length;
	return {
		state,
		sentence: `${open} ${open === 1 ? "check needs" : "checks need"} your answer in ${repo}`,
	};
}
