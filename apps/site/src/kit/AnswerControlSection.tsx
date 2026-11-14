import {
	ANSWER_MESSAGES,
	AnswerControl,
	type AnswerControlProps,
	decimalsMessage,
	emptyAnswerMessage,
	formatDate,
} from "@dead-certain/ui";
import { factDefFixtures, questionFixtures } from "@dead-certain/ui/fixtures";
import { useId, useState } from "react";
import { Specimen } from "./Specimen";

const FORMAT = { currency: "INR" };

type Value = AnswerControlProps["value"];

/**
 * A question heading and a live control. It shows the last emitted value and
 * how many times Enter was pressed, and on Enter it shows the field's problem,
 * the way a question card does.
 */
function Live({
	fact,
	start,
	error,
	disabled,
	min,
	unit,
}: {
	fact: string;
	start?: Value;
	error?: string;
	disabled?: boolean;
	min?: number;
	unit?: string;
}) {
	const headingId = useId();
	const [value, setValue] = useState<Value>(start);
	const [problem, setProblem] = useState<string | undefined>();
	const [shown, setShown] = useState<string | undefined>(error);
	const [enters, setEnters] = useState(0);
	const def = factDefFixtures[fact] as AnswerControlProps["def"];
	const question = questionFixtures[fact];
	return (
		<div className="max-w-column space-y-4">
			<p id={headingId} className="text-question font-semibold">
				{question?.text ?? def.ask}
			</p>
			<AnswerControl
				fact={fact}
				def={def}
				value={value}
				onChange={(next, why) => {
					setValue(next);
					setProblem(why);
					setShown(undefined);
				}}
				onEnter={() => {
					setEnters((n) => n + 1);
					// An untouched empty field has reported nothing yet.
					setShown(
						problem ??
							(value === undefined ? emptyAnswerMessage(def.type) : undefined),
					);
				}}
				labelledBy={headingId}
				error={shown}
				disabled={disabled}
				min={min}
				unit={unit}
				format={FORMAT}
			/>
			<p className="text-sys-small text-text-soft">
				Emitted value:{" "}
				<span data-emitted className="font-mono text-mono">
					{value === undefined ? "nothing yet" : String(value)}
				</span>
				. Enter pressed:{" "}
				<span data-enters className="font-mono text-mono">
					{enters}
				</span>
				{def.type === "date" && typeof value === "string" && (
					<>
						. Reads as <span data-reads-as>{formatDate(value)}</span>
					</>
				)}
			</p>
		</div>
	);
}

export const ANSWER_CONTROL_SPECIMENS = [
	{ id: "answercontrol-boolean-empty", title: "Yes or no, empty" },
	{ id: "answercontrol-boolean-filled", title: "Yes or no, filled" },
	{ id: "answercontrol-boolean-invalid", title: "Yes or no, invalid" },
	{ id: "answercontrol-boolean-disabled", title: "Yes or no, disabled" },
	{ id: "answercontrol-enum-2", title: "Choice of 2" },
	{ id: "answercontrol-enum-6", title: "Choice of 6" },
	{ id: "answercontrol-enum-10", title: "Choice of 10" },
	{ id: "answercontrol-enum-filled", title: "Choice, filled" },
	{ id: "answercontrol-enum-invalid", title: "Choice, invalid" },
	{ id: "answercontrol-enum-disabled", title: "Choice, disabled" },
	...[
		["empty", "Money, empty"],
		["typing", "Money, typing"],
		["filled", "Money, filled"],
		["zero", "Money, zero"],
		["invalid-empty", "Money, no amount"],
		["invalid-format", "Money, not a number"],
		["invalid-decimals", "Money, too many decimals"],
		["below-min-one", "Money, below a minimum of one paisa"],
		["below-min-amount", "Money, below a minimum of ₹500"],
		["disabled", "Money, disabled"],
	].map(([state, title]) => ({
		id: `answercontrol-money-${state}`,
		title: title as string,
	})),
	...[
		["unit", "Number with a unit"],
		["plain", "Number without a unit"],
		["typing", "Number, typing"],
		["invalid", "Number, invalid"],
		["disabled", "Number, disabled"],
	].map(([state, title]) => ({
		id: `answercontrol-number-${state}`,
		title: title as string,
	})),
	...[
		["empty", "Date, empty"],
		["filled", "Date, filled"],
		["invalid", "Date, invalid"],
		["disabled", "Date, disabled"],
	].map(([state, title]) => ({
		id: `answercontrol-date-${state}`,
		title: title as string,
	})),
];

export function AnswerControlSection() {
	return (
		<section aria-labelledby="answercontrol-heading" className="pt-16">
			<h2
				id="answercontrol-heading"
				className="font-doc text-verdict font-semibold"
			>
				AnswerControl
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				One field per fact type. Each specimen shows the value it last emitted.
			</p>

			<Specimen
				id="answercontrol-boolean-empty"
				title="Yes or no, empty"
				note="Arrow keys move between the two. With focus on the group, 1 picks Yes and 2 picks No."
			>
				<Live fact="is_emergency" />
			</Specimen>
			<Specimen
				id="answercontrol-boolean-filled"
				title="Yes or no, filled"
				note="The choice is filled and carries a check mark, so colour is not the only sign."
			>
				<Live fact="is_emergency" start={true} />
			</Specimen>
			<Specimen
				id="answercontrol-boolean-invalid"
				title="Yes or no, invalid"
				note="The message sits under the field and is read as the group's description."
			>
				<Live fact="is_emergency" error={ANSWER_MESSAGES.chooseOne} />
			</Specimen>
			<Specimen
				id="answercontrol-boolean-disabled"
				title="Yes or no, disabled"
				note="Disabled while the answer cannot change."
			>
				<Live fact="demo_video_short" start={true} disabled />
			</Specimen>

			<Specimen
				id="answercontrol-enum-2"
				title="Choice of 2"
				note="One card per option, labelled in words. The digit on each card is its shortcut."
			>
				<Live fact="claim_route" />
			</Specimen>
			<Specimen
				id="answercontrol-enum-6"
				title="Choice of 6"
				note="With focus on the group, 1 to 6 pick by position. Digits outside the group do nothing."
			>
				<Live fact="room_type" />
			</Specimen>
			<Specimen
				id="answercontrol-enum-10"
				title="Choice of 10"
				note="Only the first nine have a digit. The tenth is reached with arrow keys or a click."
			>
				<Live fact="treating_specialty" />
			</Specimen>
			<Specimen
				id="answercontrol-enum-filled"
				title="Choice, filled"
				note="The chosen card is filled and carries a check mark."
			>
				<Live fact="room_type" start="semi_private" />
			</Specimen>
			<Specimen
				id="answercontrol-enum-invalid"
				title="Choice, invalid"
				note="The message sits under the cards and is read as the group's description."
			>
				<Live fact="room_type" error={ANSWER_MESSAGES.chooseOne} />
			</Specimen>
			<Specimen
				id="answercontrol-enum-disabled"
				title="Choice, disabled"
				note="Disabled cards keep the chosen one marked, with a dashed border."
			>
				<Live fact="claim_route" start="cashless" disabled />
			</Specimen>

			<Specimen
				id="answercontrol-money-empty"
				title="Money, empty"
				note="The rupee sign is visible, and screen readers hear Indian rupees with the question."
			>
				<Live fact="room_rent_per_day" />
			</Specimen>
			<Specimen
				id="answercontrol-money-typing"
				title="Money, typing"
				note="Type here. Digits regroup as you type and the caret stays put. Enter shows any problem."
			>
				<Live fact="room_rent_per_day" start={1425} />
			</Specimen>
			<Specimen
				id="answercontrol-money-filled"
				title="Money, filled"
				note="The field holds ₹1,42,500 and emits 14250000 paise."
			>
				<Live fact="room_rent_per_day" start={14250000} />
			</Specimen>
			<Specimen
				id="answercontrol-money-zero"
				title="Money, zero"
				note="Without a minimum, zero is a valid answer."
			>
				<Live fact="room_rent_per_day" start={0} />
			</Specimen>
			<Specimen
				id="answercontrol-money-invalid-empty"
				title="Money, no amount"
				note="Shown when Enter is pressed on an empty field."
			>
				<Live fact="room_rent_per_day" error={ANSWER_MESSAGES.enterAmount} />
			</Specimen>
			<Specimen
				id="answercontrol-money-invalid-format"
				title="Money, not a number"
				note="Shown for text such as a lone decimal point."
			>
				<Live fact="room_rent_per_day" error={ANSWER_MESSAGES.moneyFormat} />
			</Specimen>
			<Specimen
				id="answercontrol-money-invalid-decimals"
				title="Money, too many decimals"
				note="The number of decimal places comes from the currency."
			>
				<Live fact="room_rent_per_day" error={decimalsMessage(2)} />
			</Specimen>
			<Specimen
				id="answercontrol-money-below-min-one"
				title="Money, below a minimum of one paisa"
				note="The app sets a minimum of 1. Type 0 and press Enter."
			>
				<Live fact="sum_insured" min={1} />
			</Specimen>
			<Specimen
				id="answercontrol-money-below-min-amount"
				title="Money, below a minimum of ₹500"
				note="The app sets a minimum of ₹500. Type 499 and press Enter."
			>
				<Live fact="sum_insured" min={50000} />
			</Specimen>
			<Specimen
				id="answercontrol-money-disabled"
				title="Money, disabled"
				note="Disabled while the answer cannot change."
			>
				<Live fact="room_rent_per_day" start={600000} disabled />
			</Specimen>

			<Specimen
				id="answercontrol-number-unit"
				title="Number with a unit"
				note="The unit sits after the field as visible text and is read with the question."
			>
				<Live fact="stay_days" unit="days" />
			</Specimen>
			<Specimen
				id="answercontrol-number-plain"
				title="Number without a unit"
				note="The field brings up the decimal keypad on phones."
			>
				<Live fact="age" />
			</Specimen>
			<Specimen
				id="answercontrol-number-typing"
				title="Number, typing"
				note="Type here. Enter shows a problem if the text is not a number."
			>
				<Live fact="stay_days" unit="days" start={4} />
			</Specimen>
			<Specimen
				id="answercontrol-number-invalid"
				title="Number, invalid"
				note="Shown for an empty field or text that is not a number."
			>
				<Live fact="age" error={ANSWER_MESSAGES.enterNumber} />
			</Specimen>
			<Specimen
				id="answercontrol-number-disabled"
				title="Number, disabled"
				note="Disabled while the answer cannot change."
			>
				<Live fact="stay_days" unit="days" start={4} disabled />
			</Specimen>

			<Specimen
				id="answercontrol-date-empty"
				title="Date, empty"
				note="The browser's own date picker. It emits an ISO date; text shown to people uses formatDate."
			>
				<Live fact="admission_date" />
			</Specimen>
			<Specimen
				id="answercontrol-date-filled"
				title="Date, filled"
				note="Holds 2026-11-10, which reads as 10 Nov 2026 in any time zone."
			>
				<Live fact="admission_date" start="2026-11-10" />
			</Specimen>
			<Specimen
				id="answercontrol-date-invalid"
				title="Date, invalid"
				note="Shown when Enter is pressed with no date picked."
			>
				<Live fact="admission_date" error={ANSWER_MESSAGES.pickDate} />
			</Specimen>
			<Specimen
				id="answercontrol-date-disabled"
				title="Date, disabled"
				note="Disabled while the answer cannot change."
			>
				<Live fact="admission_date" start="2026-11-10" disabled />
			</Specimen>
		</section>
	);
}
