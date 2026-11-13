import { CheckRow, type CheckRowProps } from "@dead-certain/ui";
import {
	factDefFixtures,
	preFlightAllPassFixture,
	preFlightUnknownFixture,
	preFlightVerdictFixture,
} from "@dead-certain/ui/fixtures";
import { useState } from "react";
import { Specimen } from "./Specimen";

type Item = CheckRowProps["item"];

const format = { currency: "INR" } as const;
const itemOf = (
	verdict: typeof preFlightVerdictFixture,
	fact: string,
): Item => {
	const item = verdict.lineItems.find((line) => line.fact === fact);
	if (!item) throw new Error(`no line item for ${fact}`);
	return item;
};

/** A row in a list, showing what it last opened and every answer it emitted. */
function Sample(props: Omit<CheckRowProps, "onOpen" | "format">) {
	const [opened, setOpened] = useState<string>();
	const [answers, setAnswers] = useState<string[]>([]);
	const [value, setValue] = useState(props.answerValue);
	return (
		<div className="max-w-column space-y-3">
			<ul>
				<CheckRow
					{...props}
					answerValue={value}
					onAnswer={(fact, next) => {
						setValue(next);
						setAnswers((prev) => [...prev, `${fact} = ${String(next)}`]);
					}}
					onOpen={(item, opener) =>
						setOpened(`${item.fact} from ${opener.tagName}`)
					}
					format={format}
				/>
			</ul>
			<p className="text-sys-small text-text-soft">
				Opened:{" "}
				<span data-opened className="font-mono text-mono">
					{opened ?? "nothing yet"}
				</span>
				{props.question && (
					<>
						{" "}
						Answered:{" "}
						<span data-answered className="font-mono text-mono">
							{answers.length === 0
								? "nothing yet"
								: `${answers.at(-1)} (${answers.length})`}
						</span>
					</>
				)}
			</p>
		</div>
	);
}

const ROWS: readonly {
	id: string;
	title: string;
	note: string;
	row: Omit<CheckRowProps, "onOpen" | "format">;
}[] = [
	{
		id: "checkrow-pass",
		title: "Pass",
		note: "A green check and the word Passed.",
		row: { item: itemOf(preFlightAllPassFixture, "is_public") },
	},
	{
		id: "checkrow-fail",
		title: "Fail",
		note: "A cross and the word Failed. The rule id opens the proof.",
		row: { item: itemOf(preFlightVerdictFixture, "has_detectable_license") },
	},
	{
		id: "checkrow-unknown",
		title: "Unknown, with inline question",
		note: "What the collector cannot see is asked in place. Answering emits once.",
		row: {
			item: itemOf(preFlightUnknownFixture, "video_under_3_minutes"),
			question: preFlightUnknownFixture.needed[0],
			def: factDefFixtures.video_under_3_minutes,
		},
	},
	{
		id: "checkrow-evidence",
		title: "With evidence",
		note: "The evidence line is in the Machine voice and wraps on phones.",
		row: {
			item: itemOf(preFlightVerdictFixture, "kiro_not_ignored"),
			detail: ".gitignore line 12: .kiro/",
		},
	},
	{
		id: "checkrow-non-boolean",
		title: "Non-boolean value",
		note: "A malformed value shows as unknown, so the check stays visible.",
		row: {
			item: { ...itemOf(preFlightAllPassFixture, "is_public"), value: "yes" },
		},
	},
];

export const CHECK_ROW_SPECIMENS = ROWS.map(({ id, title }) => ({ id, title }));

export function CheckRowSection() {
	return (
		<section aria-labelledby="checkrow-heading" className="pt-16">
			<h2 id="checkrow-heading" className="font-doc text-verdict font-semibold">
				CheckRow
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				One Pre-Flight checklist item: passed, failed or needing your answer,
				always in a word beside its icon, with the rule that decided it.
			</p>

			{ROWS.map(({ id, title, note, row }) => (
				<Specimen key={id} id={id} title={title} note={note}>
					<Sample {...row} />
				</Specimen>
			))}
		</section>
	);
}
