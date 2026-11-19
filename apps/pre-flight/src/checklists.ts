// With collectors/extractors.ts, the only module that names a fact or a goal (1.8).
// The checklist copies apps/pre-flight/rulebook/checklist.md: its groups, order
// and severities, approved by the human on 2026-11-19 (open questions 1 and 2).
import type { KnowledgeBase } from "@dead-certain/engine";

/** The knowledge base's single goal; its values are "ready" and "not_ready". */
export const GOAL = "readiness";

export type Severity = "blocker" | "warning";
export interface CheckSpec {
	readonly fact: string;
	readonly severity: Severity;
}
export interface GroupSpec {
	readonly title: string;
	readonly checks: readonly CheckSpec[];
}
export interface Checklist {
	readonly title: string;
	readonly groups: readonly GroupSpec[];
}

export const CHECKLIST: Checklist = {
	title: "Submission checklist",
	groups: [
		{
			title: "Repository",
			checks: [
				{ fact: "repo_public", severity: "blocker" },
				{ fact: "has_open_licence", severity: "blocker" },
				{ fact: "not_archived", severity: "warning" },
			],
		},
		{
			title: "Kiro usage",
			checks: [
				{ fact: "kiro_dir_present", severity: "blocker" },
				{ fact: "kiro_dir_committed", severity: "blocker" },
				{ fact: "has_spec", severity: "warning" },
			],
		},
		{
			title: "Project",
			checks: [
				{ fact: "readme_run_section", severity: "warning" },
				{ fact: "two_app_folders", severity: "blocker" },
			],
		},
		{
			title: "Submission",
			checks: [{ fact: "video_under_limit", severity: "blocker" }],
		},
	],
};

export type Validation = { ok: true } | { ok: false; problem: string };

/**
 * Start-up check (1.10): one goal, equal to GOAL, with the values ready and
 * not_ready; every check fact in exactly one group; every listed fact a check.
 */
export function validateChecklists(
	kb: KnowledgeBase,
	checklist: Checklist = CHECKLIST,
): Validation {
	if (kb.goals.length !== 1 || kb.goals[0] !== GOAL)
		return {
			ok: false,
			problem: `expected the one goal ${GOAL}, found ${kb.goals.join(", ") || "none"}`,
		};
	const options = kb.facts[GOAL]?.options ?? [];
	if (
		options.length !== 2 ||
		!options.includes("ready") ||
		!options.includes("not_ready")
	)
		return {
			ok: false,
			problem: `${GOAL} must have the values ready and not_ready`,
		};
	const listed = checklist.groups.flatMap((g) => g.checks.map((c) => c.fact));
	for (const fact of listed) {
		if (kb.facts[fact]?.role !== "check")
			return {
				ok: false,
				problem: `${fact} is not a check of the knowledge base`,
			};
		if (listed.indexOf(fact) !== listed.lastIndexOf(fact))
			return { ok: false, problem: `${fact} is listed twice` };
	}
	for (const [fact, def] of Object.entries(kb.facts))
		if (def.role === "check" && !listed.includes(fact))
			return { ok: false, problem: `${fact} is in no group` };
	return { ok: true };
}
