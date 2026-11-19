import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import { deriveFacts } from "../../collectors/derive";
import { preflightKb } from "../../collectors/testing/kb";
import { recordedSnapshot } from "../../collectors/testing/snapshots";
import { CHECKLIST } from "../checklists";
import { buildReport, type ReportView } from "./audit";
import { toMarkdown } from "./markdown";

const kb = preflightKb();
let base: ReportView;
beforeAll(async () => {
	const s = await recordedSnapshot("dc-sample-not-ready");
	base = buildReport({
		kb,
		checklist: CHECKLIST,
		snapshot: s,
		derived: deriveFacts(s, kb),
		answers: {},
	});
});

const nasty = fc.oneof(
	fc.string({ maxLength: 40 }),
	fc
		.array(
			fc.constantFrom(
				"`",
				"``",
				"<script>",
				"</b>",
				"#",
				"- ",
				"> ",
				"|",
				"[x](y)",
				"![i](j)",
				"*",
				"_",
				"\n",
				"\r\n",
				" ",
				"a",
				"1.",
				"&amp;",
			),
			{ maxLength: 10 },
		)
		.map((p) => p.join("")),
);

/** The content of a CommonMark code span that fills the rest of `s`, or null. */
function decodeSpan(s: string): string | null {
	const open = /^`+/.exec(s)?.[0];
	if (open === undefined || !s.endsWith(open) || s.length < open.length * 2)
		return null;
	const inner = s.slice(open.length, s.length - open.length);
	if (new RegExp(`(^|[^\`])${open}([^\`]|$)`).test(inner)) return null;
	return inner.length > 1 &&
		inner.startsWith(" ") &&
		inner.endsWith(" ") &&
		inner.trim() !== ""
		? inner.slice(1, -1)
		: inner;
}

const ALLOWED = [
	/^# /,
	/^$/,
	/^Checklist: /,
	/^Checked /,
	/^## /,
	/^- (Passed|Failed|Needs your answer): /,
	/^ {2}- `/,
	/^Checked with Pre-Flight\.$/,
];

describe("Markdown properties", () => {
	it("cannot be injected into", () => {
		// Feature: pre-flight-app, Property 12: Markdown cannot be injected into
		fc.assert(
			fc.property(
				nasty,
				nasty,
				fc.array(nasty, { minLength: 1, maxLength: 3 }),
				(label, title, evidence) => {
					const first = base.groups[0];
					const check = first?.checks[0];
					if (first === undefined || check === undefined)
						throw new Error("no rows");
					const report: ReportView = {
						...base,
						groups: [
							{
								title,
								checks: [
									{
										...check,
										item: { ...check.item, label },
										evidence: evidence.join("\n"),
									},
								],
							},
							...base.groups.slice(1),
						],
					};
					const md = toMarkdown(report, {
						title: CHECKLIST.title,
						stamp: "Checked 14:02",
					});
					expect(
						toMarkdown(report, {
							title: CHECKLIST.title,
							stamp: "Checked 14:02",
						}),
					).toBe(md);
					const lines = md.split("\n");
					for (const line of lines)
						expect(
							ALLOWED.some((re) => re.test(line)),
							JSON.stringify(line),
						).toBe(true);
					const spans = lines
						.filter((l) => l.startsWith("  - "))
						.map((l) => decodeSpan(l.slice(4)));
					// A lone \r is a line break to CommonMark, so it must come out as a space.
					const want = evidence
						.join("\n")
						.split(/\r?\n/)
						.filter((l) => l !== "")
						.map((l) => l.replace(/\r/g, " "));
					expect(spans.slice(0, want.length)).toEqual(want);
					expect(md).not.toMatch(/\r/);
					for (const line of lines.filter((l) => !l.startsWith("  - "))) {
						const outside = line
							.replace(/ \((`+)[^`]*?\1\)$/, "")
							.replace(/ in (`+).*\1$/, "");
						expect(/(^|[^\\])</.test(outside), JSON.stringify(line)).toBe(
							false,
						);
					}
				},
			),
			{ numRuns: 300 },
		);
	});
});
