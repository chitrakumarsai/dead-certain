import type { FactValue } from "@dead-certain/engine";
import type {
	CollectResult,
	StepEvent,
	StepId,
	StepStatus,
} from "../../collectors/collect";
import type { CollectError } from "../../collectors/parse";
import { parseTarget } from "../../collectors/target";
import type { RepoSnapshot, Target } from "../../collectors/types";
import { SAMPLES } from "./samples";

export type Steps = Record<StepId, StepStatus>;

export type Run =
	| { phase: "idle" }
	| { phase: "collecting"; runId: number; target: Target; steps: Steps }
	| {
			phase: "error";
			runId: number;
			target: Target;
			error: CollectError;
			steps: Steps;
	  }
	| {
			phase: "report";
			runId: number;
			snapshot: RepoSnapshot;
			origin: "live" | "snapshot";
			answers: Record<string, FactValue>;
			reopened?: string;
	  };

export type Action =
	| { type: "start"; runId: number; target: Target }
	| { type: "step"; runId: number; event: StepEvent }
	| { type: "done"; runId: number; result: CollectResult }
	| { type: "sample"; runId: number; snapshot: RepoSnapshot }
	| { type: "answer"; fact: string; value: FactValue }
	| { type: "reopen"; fact: string }
	| { type: "reset" };

export const initialRun: Run = { phase: "idle" };
const WAITING: Steps = {
	metadata: "waiting",
	tree: "waiting",
	gitignore: "waiting",
	readme: "waiting",
};

/** One run at a time: an event from an older run is dropped (design: run ids). */
export function reducer(run: Run, action: Action): Run {
	const current =
		"runId" in action && run.phase !== "idle"
			? run.runId === action.runId
			: true;
	switch (action.type) {
		case "start":
			return {
				phase: "collecting",
				runId: action.runId,
				target: action.target,
				steps: WAITING,
			};
		case "sample":
			return {
				phase: "report",
				runId: action.runId,
				snapshot: action.snapshot,
				origin: "snapshot",
				answers: {},
			};
		case "step":
			if (run.phase !== "collecting" || !current) return run;
			return {
				...run,
				steps: { ...run.steps, [action.event.step]: action.event.status },
			};
		case "done":
			if (run.phase !== "collecting" || !current) return run;
			return action.result.ok
				? {
						phase: "report",
						runId: run.runId,
						snapshot: action.result.snapshot,
						origin: "live",
						answers: {},
					}
				: {
						phase: "error",
						runId: run.runId,
						target: run.target,
						error: action.result.error,
						steps: action.result.steps,
					};
		case "answer": {
			if (run.phase !== "report") return run;
			const { reopened: _, ...rest } = run;
			return {
				...rest,
				answers: { ...run.answers, [action.fact]: action.value },
			};
		}
		case "reopen":
			return run.phase === "report" ? { ...run, reopened: action.fact } : run;
		case "reset":
			return initialRun;
	}
}

export type RunRequest =
	| { kind: "live"; target: Target }
	| { kind: "sample"; id: string }
	| { kind: "none" };

/** What a fragment asks for: #/report?repo=<owner/name> or #/report?sample=<id> (design: Routing). */
export function runFor(hash: string): RunRequest {
	const [path, query = ""] = hash.replace(/^#/, "").split("?");
	if (path !== "/report") return { kind: "none" };
	const params = new URLSearchParams(query);
	const sample = params.get("sample");
	if (sample !== null)
		return SAMPLES.some((s) => s.id === sample)
			? { kind: "sample", id: sample }
			: { kind: "none" };
	const parsed = parseTarget(params.get("repo") ?? "");
	return parsed.ok ? { kind: "live", target: parsed.target } : { kind: "none" };
}
