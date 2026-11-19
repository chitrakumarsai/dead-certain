import { describe, expect, it, vi } from "vitest";
import type { CollectResult } from "../../collectors/collect";
import { recordedSnapshot } from "../../collectors/testing/snapshots";
import { initialRun, type Run, reducer, runFor } from "./controller";
import { loadSample, SAMPLES } from "./samples";

const TARGET = { owner: "chitrakumarsai", name: "dead-certain" };
const start = (runId: number): Run =>
	reducer(initialRun, { type: "start", runId, target: TARGET });

describe("the run reducer", () => {
	it("starts with every step waiting", () => {
		const r = start(1);
		expect(r).toEqual({
			phase: "collecting",
			runId: 1,
			target: TARGET,
			steps: {
				metadata: "waiting",
				tree: "waiting",
				gitignore: "waiting",
				readme: "waiting",
			},
		});
	});

	it("moves a step only on the collector's events, and ignores an older run's events", () => {
		let r = start(2);
		r = reducer(r, {
			type: "step",
			runId: 2,
			event: { step: "metadata", status: "reading" },
		});
		r = reducer(r, {
			type: "step",
			runId: 1,
			event: { step: "tree", status: "done" },
		});
		expect(r.phase === "collecting" && r.steps).toEqual({
			metadata: "reading",
			tree: "waiting",
			gitignore: "waiting",
			readme: "waiting",
		});
		expect(
			reducer(r, {
				type: "done",
				runId: 1,
				result: {
					ok: false,
					error: { kind: "unreachable" },
					steps: r.phase === "collecting" ? r.steps : ({} as never),
				},
			}),
		).toBe(r);
	});

	it("shows an error with the collector's steps", () => {
		const steps = {
			metadata: "done",
			tree: "failed",
			gitignore: "not_run",
			readme: "not_run",
		} as const;
		const r = reducer(start(1), {
			type: "done",
			runId: 1,
			result: { ok: false, error: { kind: "unreadable" }, steps },
		});
		expect(r).toEqual({
			phase: "error",
			runId: 1,
			target: TARGET,
			error: { kind: "unreadable" },
			steps,
		});
	});

	it("keeps answers for the current report, reopens one, and clears them on a new run (6.7)", async () => {
		const snapshot = await recordedSnapshot("dead-certain");
		let r = reducer(start(1), {
			type: "done",
			runId: 1,
			result: { ok: true, snapshot },
		});
		expect(r).toMatchObject({ phase: "report", origin: "live", answers: {} });
		r = reducer(r, { type: "answer", fact: "demo_video_seconds", value: 120 });
		r = reducer(r, { type: "reopen", fact: "demo_video_seconds" });
		expect(r).toMatchObject({
			answers: { demo_video_seconds: 120 },
			reopened: "demo_video_seconds",
		});
		r = reducer(r, { type: "answer", fact: "demo_video_seconds", value: 90 });
		expect(r).toMatchObject({ answers: { demo_video_seconds: 90 } });
		expect(r.phase === "report" && r.reopened).toBeUndefined();
		expect(
			reducer(r, { type: "start", runId: 2, target: TARGET }),
		).toMatchObject({ phase: "collecting" });
		expect(reducer(r, { type: "reset" })).toEqual(initialRun);
	});

	it("opens a sample as a report from a snapshot", async () => {
		const snapshot = await recordedSnapshot("dc-sample-warnings");
		expect(
			reducer(initialRun, { type: "sample", runId: 3, snapshot }),
		).toMatchObject({
			phase: "report",
			origin: "snapshot",
			runId: 3,
			answers: {},
		});
	});
});

describe("runFor (the route to a run)", () => {
	it("reads a live repository, a sample, or nothing", () => {
		expect(runFor("#/report?repo=chitrakumarsai%2Fdead-certain")).toEqual({
			kind: "live",
			target: TARGET,
		});
		expect(
			runFor(
				"#/report?repo=https://github.com/chitrakumarsai/dead-certain.git",
			),
		).toEqual({ kind: "live", target: TARGET });
		expect(runFor("#/report?sample=dc-sample-warnings")).toEqual({
			kind: "sample",
			id: "dc-sample-warnings",
		});
		expect(runFor("#/report?sample=nope")).toEqual({ kind: "none" });
		expect(runFor("#/report?repo=evil.example/x/y")).toEqual({ kind: "none" });
		expect(runFor("#/")).toEqual({ kind: "none" });
	});
});

describe("samples", () => {
	it("lists the three bundled repositories", () => {
		expect(SAMPLES.map((s) => `${s.target.owner}/${s.target.name}`)).toEqual([
			"chitrakumarsai/dead-certain",
			"chitrakumarsai/dc-sample-not-ready",
			"chitrakumarsai/dc-sample-warnings",
		]);
	});

	it("builds a sample from its recorded responses without any request (9.4)", async () => {
		const spy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
			throw new Error("a sample must make no request");
		});
		try {
			const s = await loadSample("dc-sample-not-ready");
			expect(s?.target).toEqual({
				owner: "chitrakumarsai",
				name: "dc-sample-not-ready",
			});
			expect(s?.takenAt).toMatch(/^2026-11-18T/);
			expect(spy).not.toHaveBeenCalled();
			const r: CollectResult = { ok: true, snapshot: s as never };
			expect(r.ok).toBe(true);
		} finally {
			spy.mockRestore();
		}
	});
});
