import type { ReportView } from "./audit";

const STATE_WORDS = {
	pass: "Passed",
	fail: "Failed",
	unknown: "Needs your answer",
} as const;

/** Text from the knowledge base or the app: Markdown punctuation and & backslash-escaped, one line. */
export const escapeMd = (text: string): string =>
	text
		.replace(/\r\n|\r|\n/g, " ")
		.replace(/[\\`*_{}[\]()#+\-.!|<>~&]/g, "\\$&");

/**
 * Text from GitHub, as a code span that cannot end early: a fence one backtick
 * longer than the longest run inside, padded where CommonMark would strip.
 */
export function codeSpan(text: string): string {
	const flat = text.replace(/\r\n|\r|\n/g, " ");
	const longest = Math.max(
		0,
		...(flat.match(/`+/g) ?? []).map((run) => run.length),
	);
	const fence = "`".repeat(longest + 1);
	const pad =
		flat.startsWith("`") ||
		flat.endsWith("`") ||
		(flat.length > 1 &&
			flat.startsWith(" ") &&
			flat.endsWith(" ") &&
			flat.trim() !== "");
	return pad ? `${fence} ${flat} ${fence}` : `${fence}${flat}${fence}`;
}

const stateOf = (value: unknown) =>
	value === true ? "pass" : value === false ? "fail" : "unknown";

/**
 * The report as Markdown (10.4 to 10.9). A pure function of the report and the
 * stamp line ("Checked 14:02" or "Snapshot taken ..."), so the same report
 * always gives the same text.
 */
export function toMarkdown(
	report: ReportView,
	meta: { title: string; stamp: string },
): string {
	const suffix = ` in ${report.repo}`;
	const sentence = report.summary.sentence.endsWith(suffix)
		? report.summary.sentence.slice(0, -suffix.length)
		: report.summary.sentence;
	const out = [
		`# ${escapeMd(sentence)} in ${codeSpan(report.repo)}`,
		"",
		`Checklist: ${escapeMd(meta.title)}`,
		escapeMd(meta.stamp),
		...(report.summary.note === undefined
			? []
			: [escapeMd(report.summary.note)]),
	];
	for (const group of report.groups) {
		out.push("", `## ${escapeMd(group.title)}`, "");
		for (const check of group.checks) {
			const word = STATE_WORDS[stateOf(check.item.value)];
			const rule =
				check.item.rule === "" ? "" : ` (${codeSpan(check.item.rule)})`;
			out.push(`- ${word}: ${escapeMd(check.item.label)}${rule}`);
			// An empty line has no code span to write, as a check with no evidence has none.
			for (const line of check.evidence.split(/\r?\n/).filter((l) => l !== ""))
				out.push(`  - ${codeSpan(line)}`);
		}
	}
	out.push("", "Checked with Pre-Flight.", "");
	return out.join("\n");
}
