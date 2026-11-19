import type { FactValue } from "@dead-certain/engine";
import { type VerdictState, verdictStateFrom } from "@dead-certain/ui";
import type { Severity } from "../checklists";

export interface Summary {
	state: VerdictState;
	sentence: string;
	/**
	 * Why a check shows "Needs your answer" with nothing to answer: a failed
	 * check has already decided the result, so the engine stopped asking.
	 */
	note?: string;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const listOf = (items: readonly string[]) =>
	items.length === 1
		? (items[0] ?? "")
		: `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/**
 * The headline state comes from the goal; the counts only count rows the
 * engine already decided (5.2 to 5.4).
 */
export function summarize(
	goal: FactValue | undefined,
	checks: readonly {
		severity: Severity;
		value: FactValue | undefined;
		label: string;
	}[],
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
		const sentence = `${parts.join(" and ")} in ${repo}`;
		const unasked = checks
			.filter((c) => c.value === undefined)
			.map((c) => c.label);
		if (unasked.length === 0) return { state, sentence };
		const verb = unasked.length === 1 ? "was" : "were";
		return {
			state,
			sentence,
			note: `${listOf(unasked)} ${verb} not asked, because a failed check already makes this repository not ready.`,
		};
	}
	const open = checks.filter((c) => c.value === undefined).length;
	return {
		state,
		sentence: `${open} ${open === 1 ? "check needs" : "checks need"} your answer in ${repo}`,
	};
}
