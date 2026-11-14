import { Button, QuestionCard, type QuestionCardProps } from "@dead-certain/ui";
import {
	clauseFixtures,
	factDefFixtures,
	questionFixtures,
} from "@dead-certain/ui/fixtures";
import { useState } from "react";
import { Specimen } from "./Specimen";

const FORMAT = { currency: "INR" };

type Value = QuestionCardProps["value"];
type Question = QuestionCardProps["question"];

const questionFor = (fact: string) => questionFixtures[fact] as Question;
const defFor = (fact: string) =>
	factDefFixtures[fact] as QuestionCardProps["def"];
const clauseFor = (question: Question) =>
	question.clause ? clauseFixtures[question.clause] : undefined;
const UNITS: Readonly<Record<string, string>> = { stay_days: "days" };

/** A card that records what it submits, so a reader can see `onSubmit` fire once. */
function Card({
	question,
	withClause = true,
	progress = { index: 3, moreAtMost: 6 },
	canGoBack = true,
	externalError,
}: {
	question: Question;
	withClause?: boolean;
	progress?: QuestionCardProps["progress"];
	canGoBack?: boolean;
	externalError?: string;
}) {
	const [value, setValue] = useState<Value>();
	const [submitted, setSubmitted] = useState<string[]>([]);
	return (
		<div className="space-y-4">
			<QuestionCard
				question={question}
				def={defFor(question.fact)}
				clause={withClause ? clauseFor(question) : undefined}
				value={value}
				onChange={setValue}
				onSubmit={(fact, v) =>
					setSubmitted((all) => [...all, `${fact} = ${v}`])
				}
				onBack={canGoBack ? () => {} : undefined}
				progress={progress}
				externalError={externalError}
				unit={UNITS[question.fact]}
				format={FORMAT}
			/>
			<p className="text-sys-small text-text-soft">
				Submitted:{" "}
				<span data-submitted className="font-mono text-mono">
					{submitted.at(-1) ?? "nothing yet"}
				</span>
				. Times:{" "}
				<span data-submits className="font-mono text-mono">
					{submitted.length}
				</span>
			</p>
		</div>
	);
}

const FLOW = [
	"is_emergency",
	"room_type",
	"room_rent_per_day",
	"stay_days",
	"admission_date",
];

/** Five questions in a row: Continue moves on, Back goes back, answers are kept. */
function Flow() {
	const [step, setStep] = useState<number | null>(null);
	const [answers, setAnswers] = useState<Readonly<Record<string, Value>>>({});
	if (step === null) {
		return (
			<Button variant="primary" onClick={() => setStep(0)}>
				Start the questions
			</Button>
		);
	}
	const fact = FLOW[step];
	if (fact === undefined) {
		return (
			<div className="space-y-3">
				<p>All five questions are answered.</p>
				<Button onClick={() => setStep(0)}>Start again</Button>
			</div>
		);
	}
	const question = questionFor(fact);
	return (
		<QuestionCard
			question={question}
			def={defFor(fact)}
			clause={clauseFor(question)}
			value={answers[fact]}
			onChange={(next) => setAnswers((all) => ({ ...all, [fact]: next }))}
			onSubmit={() => setStep(step + 1)}
			onBack={step > 0 ? () => setStep(step - 1) : undefined}
			progress={{ index: step + 1, moreAtMost: FLOW.length - step - 1 }}
			unit={UNITS[fact]}
			format={FORMAT}
		/>
	);
}

const { why: _noWhy, ...ageWithoutWhy } = questionFor("age");

export const QUESTION_CARD_SPECIMENS = [
	{ id: "questioncard-boolean", title: "Yes or no" },
	{ id: "questioncard-enum", title: "Choice" },
	{ id: "questioncard-money", title: "Money, with why and clause" },
	{ id: "questioncard-number", title: "Number with a unit" },
	{ id: "questioncard-date", title: "Date" },
	{ id: "questioncard-why-only", title: "Why without a clause" },
	{ id: "questioncard-clause-only", title: "Clause without a why" },
	{ id: "questioncard-no-why", title: "No why and no clause" },
	{ id: "questioncard-invalid", title: "Invalid" },
	{ id: "questioncard-first", title: "First question" },
	{ id: "questioncard-last", title: "Last question" },
	{ id: "questioncard-flow", title: "Moving between questions" },
];

export function QuestionCardSection() {
	return (
		<section aria-labelledby="questioncard-heading" className="pt-16">
			<h2
				id="questioncard-heading"
				className="font-doc text-verdict font-semibold"
			>
				QuestionCard
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				One question at a time, with its reason. Each specimen shows what it
				last submitted.
			</p>

			<Specimen
				id="questioncard-boolean"
				title="Yes or no"
				note="Enter on the heading or Continue checks the answer. With none chosen, the message appears and focus moves to Yes."
			>
				<Card question={questionFor("is_emergency")} />
			</Specimen>
			<Specimen
				id="questioncard-enum"
				title="Choice"
				note="Digit keys pick a card while focus is in the group."
			>
				<Card question={questionFor("room_type")} />
			</Specimen>
			<Specimen
				id="questioncard-money"
				title="Money, with why and clause"
				note="The screen from the plan. Continue is never disabled: on an empty field it explains what is needed."
			>
				<Card question={questionFor("room_rent_per_day")} />
			</Specimen>
			<Specimen
				id="questioncard-number"
				title="Number with a unit"
				note="Enter in the field submits a number, or says why the text is not one."
			>
				<Card question={questionFor("stay_days")} />
			</Specimen>
			<Specimen
				id="questioncard-date"
				title="Date"
				note="The browser's own date picker."
			>
				<Card question={questionFor("admission_date")} />
			</Specimen>
			<Specimen
				id="questioncard-why-only"
				title="Why without a clause"
				note="The panel holds only the reason."
			>
				<Card question={questionFor("is_emergency")} />
			</Specimen>
			<Specimen
				id="questioncard-clause-only"
				title="Clause without a why"
				note="The panel holds only the clause."
			>
				<Card question={ageWithoutWhy} />
			</Specimen>
			<Specimen
				id="questioncard-no-why"
				title="No why and no clause"
				note="With nothing to explain, there is no panel."
			>
				<Card question={questionFor("demo_video_short")} />
			</Specimen>
			<Specimen
				id="questioncard-invalid"
				title="Invalid"
				note="An error from the app, such as the engine rejecting the answer. Editing the field clears it."
			>
				<Card
					question={questionFor("room_rent_per_day")}
					externalError="Enter an amount above zero."
				/>
			</Specimen>
			<Specimen
				id="questioncard-first"
				title="First question"
				note="There is nothing to go back to, so there is no Back button."
			>
				<Card
					question={questionFor("is_emergency")}
					progress={{ index: 1, moreAtMost: 6 }}
					canGoBack={false}
				/>
			</Specimen>
			<Specimen
				id="questioncard-last"
				title="Last question"
				note="When nothing more can follow, the progress line says so."
			>
				<Card
					question={questionFor("admission_date")}
					progress={{ index: 5, moreAtMost: 0 }}
				/>
			</Specimen>
			<Specimen
				id="questioncard-flow"
				title="Moving between questions"
				note="Each new question takes focus at its heading, and the live region reads the progress line."
			>
				<Flow />
			</Specimen>
		</section>
	);
}
