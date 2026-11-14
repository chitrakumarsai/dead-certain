import { AnswersRail, type AnswersRailProps, Button } from "@dead-certain/ui";
import { answersFixture, skippedFixture } from "@dead-certain/ui/fixtures";
import { useState } from "react";
import { Specimen } from "./Specimen";

/**
 * A rail that shows which answer was last chosen for changing. A page holds
 * one margin rail, so every specimen but the Rail one shows the disclosure
 * (the form the rail takes while the film is open beside the sheet).
 */
function Rail({
	asMarginRail = false,
	...props
}: Omit<AnswersRailProps, "onChange"> & { asMarginRail?: boolean }) {
	const [changed, setChanged] = useState<string>();
	return (
		<div className="space-y-3" data-film={asMarginRail ? undefined : "side"}>
			<AnswersRail {...props} onChange={setChanged} />
			<p className="text-sys-small text-text-soft">
				Asked to change:{" "}
				<span data-changed className="font-mono text-mono">
					{changed ?? "nothing yet"}
				</span>
			</p>
		</div>
	);
}

/** Skipped notes that arrive after the rail is on the page, as they do in an app. */
function LateNotes() {
	const [hasNote, setHasNote] = useState(false);
	const [, setRenders] = useState(0);
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-3">
				<Button onClick={() => setHasNote(true)}>Add the skipped note</Button>
				<Button onClick={() => setRenders((n) => n + 1)}>
					Re-render the rail
				</Button>
			</div>
			<Rail
				answers={answersFixture}
				// A fresh array each render, so only the note's identity counts.
				skipped={hasNote ? [...skippedFixture] : []}
			/>
		</div>
	);
}

export const ANSWERS_RAIL_SPECIMENS = [
	{ id: "answersrail-empty", title: "Empty" },
	{ id: "answersrail-three", title: "Three answers" },
	{ id: "answersrail-current", title: "Current answer" },
	{ id: "answersrail-skipped", title: "With a skipped note" },
	{ id: "answersrail-collapsed", title: "Collapsed" },
	{ id: "answersrail-rail", title: "Rail" },
];

export function AnswersRailSection() {
	return (
		<section aria-labelledby="answersrail-heading" className="pt-16">
			<h2
				id="answersrail-heading"
				className="font-doc text-verdict font-semibold"
			>
				AnswersRail
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				The answers so far. From 1024 px it is a 240 px margin rail; below that,
				and while the film is open beside the sheet, it is a disclosure. A page
				holds one rail, so only the Rail specimen shows it.
			</p>

			<Specimen
				id="answersrail-empty"
				title="Empty"
				note="Before the first answer. There is no loading state."
			>
				<Rail answers={[]} />
			</Specimen>
			<Specimen
				id="answersrail-three"
				title="Three answers"
				note="Each answer is a button that goes back to its question."
			>
				<Rail answers={answersFixture} />
			</Specimen>
			<Specimen
				id="answersrail-current"
				title="Current answer"
				note="The answer being changed now is marked as current and set in bold."
			>
				<Rail answers={answersFixture} current="sum_insured" />
			</Specimen>
			<Specimen
				id="answersrail-skipped"
				title="With a skipped note"
				note="A question that stopped mattering gets one plain line, announced once when it appears."
			>
				<LateNotes />
			</Specimen>
			<Specimen
				id="answersrail-collapsed"
				title="Collapsed"
				note="On phones, and at any width while the film is open beside the sheet."
			>
				<Rail answers={answersFixture} />
			</Specimen>
			<Specimen
				id="answersrail-rail"
				title="Rail"
				note="The desktop margin rail. Below 1024 px this specimen shows the disclosure."
			>
				<Rail answers={answersFixture} asMarginRail />
			</Specimen>
		</section>
	);
}
