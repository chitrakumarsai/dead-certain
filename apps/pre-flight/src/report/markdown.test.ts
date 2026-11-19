import { beforeAll, describe, expect, it } from "vitest";
import { deriveFacts } from "../../collectors/derive";
import { preflightKb } from "../../collectors/testing/kb";
import { recordedSnapshot } from "../../collectors/testing/snapshots";
import type { RepoSnapshot } from "../../collectors/types";
import { CHECKLIST } from "../checklists";
import { buildReport, type ReportView } from "./audit";
import { codeSpan, escapeMd, toMarkdown } from "./markdown";

const kb = preflightKb();
const META = { title: CHECKLIST.title, stamp: "Checked 14:02" };
let notReady: ReportView;
let self: RepoSnapshot;
beforeAll(async () => {
	self = await recordedSnapshot("dead-certain");
	const s = await recordedSnapshot("dc-sample-not-ready");
	notReady = buildReport({
		kb,
		checklist: CHECKLIST,
		snapshot: s,
		derived: deriveFacts(s, kb),
		answers: {},
	});
});

describe("escapeMd", () => {
	it("backslash-escapes Markdown punctuation and & and flattens line breaks", () => {
		expect(escapeMd("a*b_[c](d) #1 <x> | ~ & ! +-.`{}\\")).toBe(
			"a\\*b\\_\\[c\\]\\(d\\) \\#1 \\<x\\> \\| \\~ \\& \\! \\+\\-\\.\\`\\{\\}\\\\",
		);
		expect(escapeMd("one\ntwo\r\nthree")).toBe("one two three");
	});
});

describe("codeSpan", () => {
	it("uses a fence one longer than the longest backtick run, padded at a backtick edge", () => {
		expect(codeSpan("plain")).toBe("`plain`");
		expect(codeSpan("a`b")).toBe("``a`b``");
		expect(codeSpan("``x")).toBe("``` ``x ```");
		expect(codeSpan("x`")).toBe("`` x` ``");
	});

	it("keeps a .gitignore line starting with # or - and a path with <script> inert", () => {
		expect(codeSpan("# .kiro")).toBe("`# .kiro`");
		expect(codeSpan("- .kiro")).toBe("`- .kiro`");
		expect(codeSpan("<script>alert(1)</script>")).toBe(
			"`<script>alert(1)</script>`",
		);
	});

	it("turns line breaks into spaces and pads text that starts and ends with a space", () => {
		expect(codeSpan("a\nb")).toBe("`a b`");
		expect(codeSpan(" x ")).toBe("`  x  `");
	});
});

describe("toMarkdown", () => {
	it("writes the design's shape for a not-ready report", () => {
		const md = toMarkdown(notReady, META);
		const lines = md.split("\n");
		expect(lines.slice(0, 4)).toEqual([
			"# 3 blockers and 1 warning in `chitrakumarsai/dc-sample-not-ready`",
			"",
			"Checklist: Submission checklist",
			"Checked 14:02",
		]);
		expect(md).toContain("\n## Repository\n\n");
		expect(md).toContain("- Passed: ");
		expect(md).toMatch(
			/- Failed: .+ \(`R-02`\)\n {2}- `GitHub detects no licence`/,
		);
		expect(md).toContain("  - `.gitignore line 2: .kiro/`");
		expect(md).toMatch(/- Needs your answer: .+ \(`R-09`\)/);
		expect(md.endsWith("\nChecked with Pre-Flight.\n")).toBe(true);
	});

	it("escapes a label with * and [", () => {
		const r: ReportView = {
			...notReady,
			groups: [
				{
					title: "Group [1]",
					checks: [
						{
							...(notReady.groups[0]
								?.checks[0] as ReportView["groups"][0]["checks"][0]),
							item: {
								...(notReady.groups[0]?.checks[0]
									?.item as ReportView["groups"][0]["checks"][0]["item"]),
								label: "Has *stars* and [links]",
							},
						},
					],
				},
			],
		};
		const md = toMarkdown(r, META);
		expect(md).toContain("## Group \\[1\\]");
		expect(md).toContain("Has \\*stars\\* and \\[links\\]");
	});

	it("puts a snapshot date in place of the time, and gives the same text for the same report", () => {
		const md = toMarkdown(notReady, {
			title: CHECKLIST.title,
			stamp: "Snapshot taken 18 November 2026",
		});
		expect(md.split("\n")[3]).toBe("Snapshot taken 18 November 2026");
		expect(toMarkdown(notReady, META)).toBe(toMarkdown(notReady, META));
	});

	it("writes a ready report and an undecided one", () => {
		const pass = {
			...self,
			tree: {
				...self.tree,
				entries: [
					...self.tree.entries,
					{ path: "apps/pre-flight/package.json", type: "blob" as const },
				],
			},
			readme: { text: "## Usage", clipped: false, name: "README.md" },
		};
		const build = (answers: Record<string, number>) =>
			buildReport({
				kb,
				checklist: CHECKLIST,
				snapshot: pass,
				derived: deriveFacts(pass, kb),
				answers,
			});
		expect(
			toMarkdown(build({ demo_video_seconds: 120 }), META).split("\n")[0],
		).toBe("# All 9 checks passed in `chitrakumarsai/dead-certain`");
		expect(toMarkdown(build({}), META).split("\n")[0]).toBe(
			"# 1 check needs your answer in `chitrakumarsai/dead-certain`",
		);
	});

	it("holds no HTML tag and no emoji outside code spans", () => {
		const outside = toMarkdown(notReady, META).replace(/(`+)[^`]*?\1/g, "");
		expect(outside).not.toMatch(/<[a-z/]/i);
		expect(outside).not.toMatch(/\p{Extended_Pictographic}/u);
	});
});
