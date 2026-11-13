import {
	CheckCircle,
	Chevron,
	Close,
	CrossCircle,
	InfoCircle,
	Menu,
	MinusCircle,
	QuestionCircle,
	useAnnounce,
	useFocusOnMount,
} from "@dead-certain/ui";
import { type ReactNode, useRef, useState } from "react";
import { Specimen } from "./Specimen";

const ICONS: [string, ReactNode][] = [
	["CheckCircle", <CheckCircle key="check" />],
	["MinusCircle", <MinusCircle key="minus" />],
	["CrossCircle", <CrossCircle key="cross" />],
	["QuestionCircle", <QuestionCircle key="question" />],
	["InfoCircle", <InfoCircle key="info" />],
	["Chevron", <Chevron key="chevron" />],
	["Close", <Close key="close" />],
	["Menu", <Menu key="menu" />],
];

function IconGrid() {
	return (
		<ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
			{ICONS.map(([name, icon]) => (
				<li key={name} className="flex items-center gap-3">
					{icon}
					<span className="font-mono text-mono">{name}</span>
				</li>
			))}
		</ul>
	);
}

// Native buttons until Button lands in task 5.2.
const DEMO_BUTTON =
	"min-h-touch rounded-control border border-control-border bg-paper px-4 text-sys-small font-semibold";

function AnnounceDemo() {
	const announce = useAnnounce();
	return (
		<button
			type="button"
			className={DEMO_BUTTON}
			onClick={() => announce("Question 3. Up to 6 more.")}
		>
			Announce a sample message
		</button>
	);
}

const QUESTIONS = [
	"What was the room rent per day?",
	"What is the sum insured on the policy?",
];

function FocusDemo() {
	const [index, setIndex] = useState<number | null>(null);
	return (
		<div className="space-y-4">
			<button
				type="button"
				className={DEMO_BUTTON}
				onClick={() =>
					setIndex((i) => (i === null ? 0 : (i + 1) % QUESTIONS.length))
				}
			>
				Show the next question
			</button>
			{index !== null && (
				<FocusedHeading key="heading" text={QUESTIONS[index] as string} />
			)}
		</div>
	);
}

function FocusedHeading({ text }: { text: string }) {
	const ref = useRef<HTMLHeadingElement>(null);
	useFocusOnMount(ref, text);
	return (
		<h4 ref={ref} tabIndex={-1} className="text-question font-semibold">
			{text}
		</h4>
	);
}

export const PRIMITIVE_SPECIMENS = [
	{ id: "icons-paper", title: "Icons on paper" },
	{ id: "icons-film", title: "Icons on film" },
	{ id: "a11y-announce", title: "Live region" },
	{ id: "a11y-focus", title: "Focus on mount" },
];

export function PrimitivesSection() {
	return (
		<section aria-labelledby="primitives-heading" className="pt-16">
			<h2
				id="primitives-heading"
				className="font-doc text-verdict font-semibold"
			>
				Icons and accessibility helpers
			</h2>

			<Specimen
				id="icons-paper"
				title="Icons on paper"
				note="Inline SVG on a 24 px grid with a 2 px stroke in the text colour. Each is hidden from assistive technology; a word always carries the meaning."
			>
				<div className="max-w-column rounded-paper border border-divider bg-paper p-6">
					<IconGrid />
				</div>
			</Specimen>

			<Specimen
				id="icons-film"
				title="Icons on film"
				note="The same icons inside the X-ray take the film text colour."
			>
				<div
					data-surface="film"
					className="max-w-column rounded-film bg-surface p-6 text-text"
				>
					<IconGrid />
				</div>
			</Specimen>

			<Specimen
				id="a11y-announce"
				title="Live region"
				note="One polite region per page. Announcing the same message twice reads it twice."
			>
				<AnnounceDemo />
			</Specimen>

			<Specimen
				id="a11y-focus"
				title="Focus on mount"
				note="A new question heading takes focus when it appears, so a screen reader starts there."
			>
				<FocusDemo />
			</Specimen>
		</section>
	);
}
