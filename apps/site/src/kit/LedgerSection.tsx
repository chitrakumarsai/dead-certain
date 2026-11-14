import { Ledger } from "@dead-certain/ui";
import {
	CLAIMED_AMOUNT,
	claimVerdictFixture,
	manyDeductionsFixture,
	paidInFullVerdictFixture,
	unknownLineWithKnownPayableFixture,
	zeroDeductionFixture,
} from "@dead-certain/ui/fixtures";
import { useState } from "react";
import { Specimen } from "./Specimen";

type Verdict = typeof claimVerdictFixture;

const format = { currency: "INR" } as const;

/** A label long enough to wrap at 320 px. */
const longLabelVerdict: Verdict = {
	...claimVerdictFixture,
	lineItems: claimVerdictFixture.lineItems.map((item, i) =>
		i === 0
			? {
					...item,
					label:
						"Room rent above the limit, with other charges reduced in the same ratio",
				}
			: item,
	),
};

/** A ledger that shows which row was last opened, and from which element. */
function Sample({
	verdict,
	selectedFact,
}: {
	verdict: Verdict;
	selectedFact?: string;
}) {
	const [opened, setOpened] = useState<string>();
	return (
		<div className="space-y-3">
			<Ledger
				claimed={{ label: "Claimed", value: CLAIMED_AMOUNT }}
				items={verdict.lineItems}
				payable={{
					label: "Payable",
					value: Number(verdict.goals.payable_amount),
				}}
				format={format}
				selectedFact={selectedFact}
				onOpen={(item, opener) =>
					setOpened(`${item.fact} from ${opener.tagName}`)
				}
			/>
			<p className="text-sys-small text-text-soft">
				Opened:{" "}
				<span data-opened className="font-mono text-mono">
					{opened ?? "nothing yet"}
				</span>
			</p>
		</div>
	);
}

const LEDGERS = [
	{
		id: "ledger-normal",
		title: "Normal",
		note: "Each deduction opens its proof. The ledger prints amounts; it adds nothing up.",
		verdict: claimVerdictFixture,
	},
	{
		id: "ledger-no-deductions",
		title: "No deductions",
		note: "Only the claimed and payable rows.",
		verdict: paidInFullVerdictFixture,
	},
	{
		id: "ledger-zero",
		title: "Zero deduction",
		note: "A deduction that worked out to ₹0 is left out.",
		verdict: zeroDeductionFixture,
	},
	{
		id: "ledger-unknown",
		title: "Unknown value",
		note: "A deduction not known yet says so, and still opens its proof.",
		verdict: unknownLineWithKnownPayableFixture,
	},
	{
		id: "ledger-many",
		title: "30 rows",
		note: "A long ledger keeps its columns.",
		verdict: manyDeductionsFixture,
	},
	{
		id: "ledger-selected",
		title: "Selected row",
		note: "The row whose proof is open is marked as current and set in bold.",
		verdict: claimVerdictFixture,
		selectedFact: "copay_deduction",
	},
] as const;

export const LEDGER_SPECIMENS = [
	...LEDGERS.map(({ id, title }) => ({ id, title })),
	{ id: "ledger-wrap", title: "320 px wrap" },
];

export function LedgerSection() {
	return (
		<section aria-labelledby="ledger-heading" className="pt-16">
			<h2 id="ledger-heading" className="font-doc text-verdict font-semibold">
				Ledger
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				The claim, each deduction with the clause behind it, and the amount
				payable. Every deduction row opens its proof.
			</p>

			{LEDGERS.map((ledger) => (
				<Specimen
					key={ledger.id}
					id={ledger.id}
					title={ledger.title}
					note={ledger.note}
				>
					<Sample
						verdict={ledger.verdict}
						selectedFact={
							"selectedFact" in ledger ? ledger.selectedFact : undefined
						}
					/>
				</Specimen>
			))}
			<Specimen
				id="ledger-wrap"
				title="320 px wrap"
				note="A long label wraps; the amount never does."
			>
				{/* The narrowest supported screen, at any viewport. */}
				<div style={{ maxWidth: 320 }}>
					<Sample verdict={longLabelVerdict} />
				</div>
			</Specimen>
		</section>
	);
}
