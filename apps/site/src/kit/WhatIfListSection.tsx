import { humanize, WhatIfList } from "@dead-certain/ui";
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

export const WHAT_IF_LIST_SPECIMENS = [
	{ id: "whatiflist-money", title: "Money" },
	{ id: "whatiflist-no-money", title: "No money" },
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
