import { humanize, WhatIfList, type WhatIfListProps } from "@dead-certain/ui";
import {
	alternativesFixture,
	alternativesNoMoneyFixture,
	claimVerdictFixture,
	factDefFixtures,
	preFlightAllPassFixture,
} from "@dead-certain/ui/fixtures";
import { Specimen } from "./Specimen";

const format = { currency: "INR" } as const;
const defFor = (fact: string) => factDefFixtures[fact];
const labelFor = (fact: string) =>
	factDefFixtures[fact]?.label ?? humanize(fact);

type Alternatives = WhatIfListProps["alternatives"];

/** A licence fact with acronym options, only for the edge specimen. */
const edgeDefFor = (fact: string) =>
	fact === "licence"
		? ({ type: "enum", options: ["MIT", "Apache-2.0"] } as const)
		: defFor(fact);
const edgeLabelFor = (fact: string) =>
	fact === "licence" ? "MIT licence type" : labelFor(fact);
const withGoals = (
	payable: number | undefined,
	verdict: string | undefined,
): Alternatives[number]["verdict"] => ({
	...claimVerdictFixture,
	goals: { payable_amount: payable, verdict },
	// An undecided verdict still has a question to ask.
	needed:
		verdict === undefined
			? [{ kind: "question", fact: "age", text: "How old is the patient?" }]
			: [],
});

const EDGE_ALTERNATIVES: Alternatives = [
	{
		fact: "is_emergency",
		value: false,
		verdict: withGoals(172_000_00, "reduced"),
	},
	{ fact: "licence", value: "MIT", verdict: withGoals(142_500_00, "reduced") },
	{
		fact: "room_rent_per_day",
		value: 6_000_00,
		verdict: withGoals(undefined, undefined),
	},
];

export const WHAT_IF_LIST_SPECIMENS = [
	{ id: "whatiflist-money", title: "Money" },
	{ id: "whatiflist-no-money", title: "No money" },
	{ id: "whatiflist-edges", title: "Value and change edge cases" },
	{ id: "whatiflist-empty", title: "Empty" },
];

export function WhatIfListSection() {
	return (
		<section aria-labelledby="whatiflist-heading" className="pt-16">
			<h2
				id="whatiflist-heading"
				className="font-doc text-verdict font-semibold"
			>
				WhatIfList
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				The single answers that would change the outcome, in plain text. There
				are no actions in this version.
			</p>

			<Specimen
				id="whatiflist-money"
				title="Money"
				note="Claim Check: each row shows the signed change in the amount payable."
			>
				<WhatIfList
					current={claimVerdictFixture}
					alternatives={alternativesFixture}
					labelFor={labelFor}
					defFor={defFor}
					amountGoal="payable_amount"
					stateGoal="verdict"
					format={format}
				/>
			</Specimen>
			<Specimen
				id="whatiflist-no-money"
				title="No money"
				note="Pre-Flight: with no amount, each row names the new verdict."
			>
				<WhatIfList
					current={preFlightAllPassFixture}
					alternatives={alternativesNoMoneyFixture}
					labelFor={labelFor}
					defFor={defFor}
					stateGoal="verdict"
					format={format}
				/>
			</Specimen>
			<Specimen
				id="whatiflist-edges"
				title="Value and change edge cases"
				note="Yes/no reads lower case; enums like MIT and money stay verbatim. No change in amount or state gives the generic line; an unknown amount is said."
			>
				<WhatIfList
					current={claimVerdictFixture}
					alternatives={EDGE_ALTERNATIVES}
					labelFor={edgeLabelFor}
					defFor={edgeDefFor}
					amountGoal="payable_amount"
					stateGoal="verdict"
					format={format}
				/>
			</Specimen>
			<Specimen
				id="whatiflist-empty"
				title="Empty"
				note="When no single answer changes the outcome, the list and its heading are left out."
			>
				<div data-whatif-host>
					<WhatIfList
						current={claimVerdictFixture}
						alternatives={[]}
						labelFor={labelFor}
						defFor={defFor}
						amountGoal="payable_amount"
						format={format}
					/>
				</div>
			</Specimen>
		</section>
	);
}
