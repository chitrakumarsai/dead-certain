import { useAnnounce } from "@dead-certain/ui";
import { useEffect, useRef } from "react";
import type { StepId, StepStatus } from "../../collectors/collect";

export const STEP_LABELS: Readonly<Record<StepId, string>> = {
	metadata: "Read repository details",
	tree: "Read file tree",
	gitignore: "Read .gitignore",
	readme: "Read README",
};
const STATUS_WORDS: Readonly<Record<StepStatus, string>> = {
	waiting: "Waiting",
	reading: "Reading",
	done: "Done",
	not_found: "Not found",
	failed: "Failed",
	not_run: "Not run",
};
const FINISHED: readonly StepStatus[] = ["done", "not_found", "failed"];

/**
 * The four collection steps, moved only by the collector's events (4.1 to 4.5).
 * Nothing moves: the list is the progress.
 */
export function Steps({
	steps,
}: {
	steps: Readonly<Record<StepId, StepStatus>>;
}) {
	const announce = useAnnounce();
	const seen = useRef<Partial<Record<StepId, StepStatus>>>({});
	useEffect(() => {
		for (const [step, status] of Object.entries(steps) as [
			StepId,
			StepStatus,
		][]) {
			if (FINISHED.includes(status) && seen.current[step] !== status)
				announce(`${STEP_LABELS[step]}: ${STATUS_WORDS[status]}`);
			seen.current[step] = status;
		}
	}, [steps, announce]);
	return (
		<ol
			aria-label="Collection steps"
			data-steps
			className="flex flex-col gap-1"
		>
			{(Object.keys(STEP_LABELS) as StepId[]).map((step) => (
				<li
					key={step}
					data-step={step}
					data-status={steps[step]}
					className="flex min-h-touch items-center justify-between gap-4 text-sys-body"
				>
					<span>{STEP_LABELS[step]}</span>
					<span
						className={
							steps[step] === "failed"
								? "font-semibold text-denied"
								: "text-text-soft"
						}
					>
						{STATUS_WORDS[steps[step]]}
					</span>
				</li>
			))}
		</ol>
	);
}
