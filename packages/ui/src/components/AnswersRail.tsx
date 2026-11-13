import { useEffect, useRef } from "react";
import { useAnnounce } from "../a11y/LiveRegion";
import type { AnswerEntry, SkippedNote } from "../types";
import { Disclosure } from "./Disclosure";

export interface AnswersRailProps {
	answers: readonly AnswerEntry[];
	/** "Change this answer": the app goes back to that question. */
	onChange: (fact: string) => void;
	/** Questions that no longer matter, each with one plain line. */
	skipped?: readonly SkippedNote[];
	/** The fact being asked now, marked `aria-current`. */
	current?: string;
}

const NO_NOTES: readonly SkippedNote[] = [];

/** Announces each skipped note once, the first time it appears. */
function useAnnounceNewNotes(skipped: readonly SkippedNote[]): void {
	const announce = useAnnounce();
	const announced = useRef(new Set<string>());
	useEffect(() => {
		for (const note of skipped) {
			if (announced.current.has(note.fact)) continue;
			announced.current.add(note.fact);
			announce(note.reason);
		}
	}, [skipped, announce]);
}

function Answers({ answers, onChange, skipped, current }: AnswersRailProps) {
	return (
		<div className="space-y-3">
			{answers.length === 0 ? (
				<p className="text-sys-small text-text-soft">No answers yet.</p>
			) : (
				<ul className="space-y-1">
					{answers.map((entry) => (
						<li key={entry.fact}>
							<button
								type="button"
								aria-label={`Change ${entry.label}, currently ${entry.display}`}
								aria-current={entry.fact === current ? "true" : undefined}
								onClick={() => onChange(entry.fact)}
								className="flex min-h-touch w-full flex-col items-start rounded-control px-2 py-2 text-left text-sys-small text-text transition-colors duration-(--dur-press) ease-kit hover:bg-text/10 aria-[current=true]:bg-text/10 aria-[current=true]:font-semibold"
							>
								<span>{entry.label}</span>{" "}
								{/* "currently" is visible so the name contains what is on screen. */}
								<span className="text-text-soft">
									currently{" "}
									<span className="figures font-semibold text-text">
										{entry.display}
									</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
			{skipped && skipped.length > 0 && (
				<ul className="space-y-2 border-t border-divider px-2 pt-3">
					{skipped.map((note) => (
						<li key={note.fact} className="text-sys-small text-text-soft">
							{note.reason}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/**
 * The answers so far, each a button that goes back to its question. From
 * 1024 px it is a 240 px aside; below that, and inside an element marked
 * `data-film="side"` (the film open beside the sheet), it is a disclosure.
 */
export function AnswersRail(props: AnswersRailProps) {
	useAnnounceNewNotes(props.skipped ?? NO_NOTES);
	return (
		<>
			<aside
				aria-label="Your answers"
				className="hidden w-rail shrink-0 lg:block lg:in-data-[film=side]:hidden"
			>
				<h2 className="px-2 pb-2 text-sys-body font-semibold text-text">
					Your answers
				</h2>
				<Answers {...props} />
			</aside>
			<div className="lg:hidden lg:in-data-[film=side]:block">
				<Disclosure title={`Your answers (${props.answers.length})`}>
					<Answers {...props} />
				</Disclosure>
			</div>
		</>
	);
}
