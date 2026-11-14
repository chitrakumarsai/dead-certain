import {
	Button,
	formatMoney,
	VerdictHeadline,
	type VerdictHeadlineProps,
	verdictStateFrom,
} from "@dead-certain/ui";
import {
	CLAIMED_AMOUNT,
	claimVerdictFixture,
	deniedVerdictFixture,
	paidInFullVerdictFixture,
	preFlightVerdictFixture,
	undecidedVerdictFixture,
} from "@dead-certain/ui/fixtures";
import { useState } from "react";
import { Specimen } from "./Specimen";

type Verdict = typeof claimVerdictFixture;

const money = (minor: number) => formatMoney(minor, "INR");

/** "₹1,42,500 of ₹2,10,000 will be paid", from a fixture's payable goal. */
const paidStatement = (verdict: Verdict) =>
	`${money(Number(verdict.goals.payable_amount))} of ${money(CLAIMED_AMOUNT)} will be paid`;

const stateOf = (verdict: Verdict) =>
	verdictStateFrom(verdict.goals.verdict, verdict.needed.length);

/** Each state from its fixture, so the state mapping is exercised too. */
const HEADLINES: readonly {
	slug: string;
	title: string;
	headline: Pick<VerdictHeadlineProps, "state" | "statement">;
}[] = [
	{
		slug: "paid",
		title: "Paid in full",
		headline: {
			state: stateOf(paidInFullVerdictFixture),
			statement: paidStatement(paidInFullVerdictFixture),
		},
	},
	{
		slug: "reduced",
		title: "Paid in part",
		headline: {
			state: stateOf(claimVerdictFixture),
			statement: paidStatement(claimVerdictFixture),
		},
	},
	{
		slug: "denied",
		title: "Not paid",
		headline: {
			state: stateOf(deniedVerdictFixture),
			statement: paidStatement(deniedVerdictFixture),
		},
	},
	{
		slug: "ready",
		title: "Ready",
		headline: {
			state: verdictStateFrom("ready", 0),
			statement: "Every check passes in owner/name",
		},
	},
	{
		slug: "not-ready",
		title: "Not ready",
		headline: {
			state: stateOf(preFlightVerdictFixture),
			statement: "2 blockers and 1 warning in owner/name",
		},
	},
	{
		slug: "undecided",
		title: "More answers needed",
		headline: {
			state: stateOf(undecidedVerdictFixture),
			statement: `${undecidedVerdictFixture.needed.length} more answers are needed to decide`,
		},
	},
];

const SIZES = [
	{ size: "verdict", title: "verdict size" },
	{ size: "summary", title: "summary size" },
] as const;

/** A verdict that arrives after the page, as it does when the last answer is given. */
function Appears() {
	const [isShown, setShown] = useState(false);
	return (
		<div className="space-y-4">
			<Button onClick={() => setShown(true)}>Show the verdict</Button>
			{isShown && (
				<VerdictHeadline
					state={stateOf(claimVerdictFixture)}
					statement={paidStatement(claimVerdictFixture)}
					headingLevel={2}
				/>
			)}
		</div>
	);
}

export const VERDICT_HEADLINE_SPECIMENS = [
	...HEADLINES.flatMap(({ slug, title }) =>
		SIZES.map(({ size, title: sizeTitle }) => ({
			id: `verdictheadline-${slug}-${size}`,
			title: `${title}, ${sizeTitle}`,
		})),
	),
	{ id: "verdictheadline-appears", title: "Appears" },
];

export function VerdictHeadlineSection() {
	return (
		<section aria-labelledby="verdictheadline-heading" className="pt-16">
			<h2
				id="verdictheadline-heading"
				className="font-doc text-verdict font-semibold"
			>
				VerdictHeadline
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				The verdict in one heading: a state word with its icon and colour, then
				the statement. Apps use a level 1 heading; the gallery uses level 2.
			</p>

			{HEADLINES.flatMap(({ slug, title, headline }) =>
				SIZES.map(({ size, title: sizeTitle }) => (
					<Specimen
						key={`${slug}-${size}`}
						id={`verdictheadline-${slug}-${size}`}
						title={`${title}, ${sizeTitle}`}
						note={
							size === "verdict"
								? "48/56 from 768 px, 36/44 on phones."
								: "The Pre-Flight summary: 36/44 at every width."
						}
					>
						<VerdictHeadline {...headline} size={size} headingLevel={2} />
					</Specimen>
				)),
			)}
			<Specimen
				id="verdictheadline-appears"
				title="Appears"
				note="When a verdict appears its heading takes focus and the live region reads it."
			>
				<Appears />
			</Specimen>
		</section>
	);
}
