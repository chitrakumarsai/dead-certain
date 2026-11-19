import type { ProofNode } from "@dead-certain/engine";
import { beforeAll, describe, expect, it } from "vitest";
import { deriveFacts } from "../../collectors/derive";
import { preflightKb } from "../../collectors/testing/kb";
import { recordedSnapshot } from "../../collectors/testing/snapshots";
import type { RepoSnapshot } from "../../collectors/types";
import { CHECKLIST } from "../checklists";
import { buildReport } from "./audit";
import { evidenceFor } from "./evidence";
import { relabelSources } from "./sources";

const kb = preflightKb();
let self: RepoSnapshot;
let notReady: RepoSnapshot;
let warnings: RepoSnapshot;
beforeAll(async () => {
	self = await recordedSnapshot("dead-certain");
	notReady = await recordedSnapshot("dc-sample-not-ready");
	warnings = await recordedSnapshot("dc-sample-warnings");
});

const report = (
	snapshot: RepoSnapshot,
	answers: Record<string, boolean | number | string> = {},
) =>
	buildReport({
		kb,
		checklist: CHECKLIST,
		snapshot,
		derived: deriveFacts(snapshot, kb),
		answers,
	});

/** This repository with the two failing checks fixed: a run heading, and a package.json in each app. */
const passing = (s: RepoSnapshot): RepoSnapshot => ({
	...s,
	tree: {
		...s.tree,
		entries: [
			...s.tree.entries,
			{ path: "apps/pre-flight/package.json", type: "blob" },
		],
	},
	readme: {
		text: "# x\n\n## Getting started\n",
		clipped: false,
		name: "README.md",
	},
});

describe("buildReport: the summary (5.2 to 5.4)", () => {
	it("counts failed blockers and warnings", () => {
		expect(report(self).summary).toEqual({
			state: "not_ready",
			sentence: "1 blocker and 1 warning in chitrakumarsai/dead-certain",
		});
		expect(report(notReady).summary.sentence).toBe(
			"3 blockers and 1 warning in chitrakumarsai/dc-sample-not-ready",
		);
		expect(report(warnings).summary.sentence).toBe(
			"2 warnings in chitrakumarsai/dc-sample-warnings",
		);
	});

	it("says how many checks need an answer while undecided, in the singular for one", () => {
		expect(report(passing(self)).summary).toEqual({
			state: "undecided",
			sentence: "1 check needs your answer in chitrakumarsai/dead-certain",
		});
		const blind = { ...passing(self), tree: { ...self.tree, truncated: true } };
		expect(report(blind).summary.sentence).toMatch(
			/^\d+ checks need your answer in /,
		);
	});

	it("says all checks passed when ready", () => {
		expect(report(passing(self), { demo_video_seconds: 150 }).summary).toEqual({
			state: "ready",
			sentence: "All 9 checks passed in chitrakumarsai/dead-certain",
		});
	});

	it("says 1 blocker alone", () => {
		expect(
			report(passing(self), { demo_video_seconds: 200 }).summary.sentence,
		).toBe("1 blocker in chitrakumarsai/dead-certain");
	});
});

describe("buildReport: rows (5.5 to 5.10)", () => {
	it("lists the checklist's groups and checks in order, values from the audit", () => {
		const r = report(warnings);
		expect(r.groups.map((g) => g.title)).toEqual(
			CHECKLIST.groups.map((g) => g.title),
		);
		expect(r.groups.flatMap((g) => g.checks.map((c) => c.item.fact))).toEqual(
			CHECKLIST.groups.flatMap((g) => g.checks.map((c) => c.fact)),
		);
		const has = r.groups
			.flatMap((g) => g.checks)
			.find((c) => c.item.fact === "has_spec");
		expect(has?.item.value).toBe(false);
		expect(has?.severity).toBe("warning");
	});

	it("gives each check the evidence of its collected facts, and none to an asked check", () => {
		const rows = report(notReady).groups.flatMap((g) => g.checks);
		expect(
			rows.find((c) => c.item.fact === "kiro_dir_committed")?.evidence,
		).toContain(".gitignore line 2: .kiro/");
		expect(
			rows.find((c) => c.item.fact === "video_under_limit")?.evidence,
		).toBe("");
	});
});

describe("collected values win (6.9)", () => {
	it("ignores an answer for a fact the collector read", () => {
		const r = report(warnings, { repo_private: true, license_detected: false });
		const row = r.groups
			.flatMap((g) => g.checks)
			.find((c) => c.item.fact === "repo_public");
		expect(row?.item.value).toBe(true);
		expect(r.summary.sentence).toBe(
			"2 warnings in chitrakumarsai/dc-sample-warnings",
		);
	});
});

describe("questions (6.1, 6.4)", () => {
	it("puts a number question in the list, not inline", () => {
		const r = report(passing(self));
		expect(r.listQuestions.map((q) => q.fact)).toEqual(["demo_video_seconds"]);
		for (const c of r.groups.flatMap((g) => g.checks))
			expect(c.question).toBeUndefined();
	});

	it("puts a boolean question inline in the row whose proof needs it", () => {
		const blind = { ...passing(self), tree: { ...self.tree, truncated: true } };
		const rows = report(blind, { demo_video_seconds: 100 }).groups.flatMap(
			(g) => g.checks,
		);
		expect(
			rows.find((c) => c.item.fact === "has_open_licence")?.question?.fact,
		).toBe("license_file_at_root");
	});

	it("asks nothing once the goal is decided (6.8)", () => {
		const r = report(notReady);
		expect(r.listQuestions).toEqual([]);
		for (const c of r.groups.flatMap((g) => g.checks))
			expect(c.question).toBeUndefined();
	});
});

const leaf = (
	fact: string,
	value: boolean | undefined,
	source: ProofNode["source"] = "answered",
): ProofNode => ({ fact, value, source, children: [] });

describe("relabelSources (7.4)", () => {
	it("marks collected leaves and leaves the rest", () => {
		const tree: ProofNode = {
			fact: "c",
			value: true,
			source: "derived",
			rule: "R",
			children: [leaf("a", true), leaf("b", true)],
		};
		const out = relabelSources(tree, new Set(["a"]));
		expect(out.children.map((n) => n.source)).toEqual([
			"collected",
			"answered",
		]);
		expect(out.source).toBe("derived");
		expect(tree.children[0]?.source).toBe("answered");
	});
});

describe("evidenceFor (5.8)", () => {
	it("takes collected leaves in tree order, drops repeats and missing lines", () => {
		const tree: ProofNode = {
			fact: "c",
			value: true,
			source: "derived",
			children: [
				leaf("a", true, "collected"),
				leaf("b", true, "collected"),
				leaf("a", true, "collected"),
				leaf("x", true, "answered"),
			],
		};
		expect(evidenceFor(tree, { a: "line a", x: "not collected" })).toBe(
			"line a",
		);
		expect(evidenceFor(tree, { a: "line a", b: "line b" })).toBe(
			"line a\nline b",
		);
		expect(evidenceFor(tree, { a: "x", b: "x" })).toBe("x");
	});
});
