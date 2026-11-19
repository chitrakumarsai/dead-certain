import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../collectors/derive";
import { preflightKb } from "../../collectors/testing/kb";
import { recordedSnapshot } from "../../collectors/testing/snapshots";
import { CHECKLIST } from "../checklists";
import { buildReport } from "../report/audit";
import { loadSample, SAMPLES } from "./samples";

const kb = preflightKb();
const reportOf = async (id: string, answers: Record<string, number> = {}) => {
	const snapshot = await loadSample(id);
	if (snapshot === undefined) throw new Error(`no sample ${id}`);
	return buildReport({
		kb,
		checklist: CHECKLIST,
		snapshot,
		derived: deriveFacts(snapshot, kb),
		answers,
	});
};

describe("the bundled samples (requirement 9)", () => {
	it("each is a public RepoSnapshot of its repository, dated by its recording", async () => {
		for (const s of SAMPLES) {
			const snapshot = await loadSample(s.id);
			expect(snapshot?.version).toBe(1);
			expect(snapshot?.target).toEqual(s.target);
			expect(snapshot?.metadata.private).toBe(false);
			expect(snapshot?.takenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		}
	});

	it("goes through the same collect, deriveFacts and audit as a live run (9.4)", async () => {
		for (const s of SAMPLES) {
			const sample = await loadSample(s.id);
			const live = await recordedSnapshot(s.id);
			expect({ ...sample, takenAt: "" }).toEqual({ ...live, takenAt: "" });
		}
	});

	it("this repository shows .kiro present and not ignored (9.8)", async () => {
		const r = await reportOf("dead-certain");
		const rows = r.groups.flatMap((g) => g.checks);
		expect(
			rows.find((c) => c.item.fact === "kiro_dir_present")?.item.value,
		).toBe(true);
		expect(
			rows.find((c) => c.item.fact === "kiro_dir_committed")?.item.value,
		).toBe(true);
	});

	it("together show a not-ready result and an unseen fact (9.3, as recorded)", async () => {
		const reports = await Promise.all(SAMPLES.map((s) => reportOf(s.id)));
		expect(reports.map((r) => r.summary.state)).toContain("not_ready");
		expect(
			reports.some((r) =>
				r.groups
					.flatMap((g) => g.checks)
					.some((c) => c.item.value === undefined),
			),
		).toBe(true);
	});
});
