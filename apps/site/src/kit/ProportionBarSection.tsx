import { ProportionBar, type ProportionPart } from "@dead-certain/ui";
import {
	CLAIMED_AMOUNT,
	deniedVerdictFixture,
	paidInFullVerdictFixture,
} from "@dead-certain/ui/fixtures";
import { Specimen } from "./Specimen";

const format = { currency: "INR" } as const;

/** The paid part, then one cut per deduction, as an app builds them. */
function partsFrom(verdict: typeof paidInFullVerdictFixture): ProportionPart[] {
	return [
		{
			kind: "paid",
			value: Number(verdict.goals.payable_amount),
			label: "Paid",
		},
		...verdict.lineItems.map((item) => ({
			kind: "cut" as const,
			value: Number(item.value),
			label: item.label,
		})),
	];
}

const ROOM_RENT: ProportionPart = {
	kind: "cut",
	value: 38_000_00,
	label: "Room rent above the limit",
};

const BARS: readonly {
	id: string;
	title: string;
	note: string;
	parts: readonly ProportionPart[];
}[] = [
	{
		id: "proportionbar-all-paid",
		title: "All paid",
		note: "One solid part fills the bar.",
		parts: partsFrom(paidInFullVerdictFixture),
	},
	{
		id: "proportionbar-one-cut",
		title: "One cut",
		note: "The cut is hatched, so it differs from the paid part without colour.",
		parts: [{ kind: "paid", value: 172_000_00, label: "Paid" }, ROOM_RENT],
	},
	{
		id: "proportionbar-many-cuts",
		title: "Many cuts",
		note: "Each cut is its own segment, separated by a 2 px paper gap.",
		parts: [
			{ kind: "paid", value: 130_000_00, label: "Paid" },
			ROOM_RENT,
			{ kind: "cut", value: 29_500_00, label: "Co-payment at age 61 or over" },
			{
				kind: "cut",
				value: 12_500_00,
				label: "Consumables the policy does not cover",
			},
		],
	},
	{
		id: "proportionbar-all-cut",
		title: "All cut",
		note: "Nothing is paid. The ₹0 paid part is read but takes no room.",
		parts: partsFrom(deniedVerdictFixture),
	},
	{
		id: "proportionbar-zero-parts",
		title: "Zero parts",
		note: "Before a verdict: the empty track only.",
		parts: [],
	},
];

export const PROPORTION_BAR_SPECIMENS = BARS.map(({ id, title }) => ({
	id,
	title,
}));

export function ProportionBarSection() {
	return (
		<section aria-labelledby="proportionbar-heading" className="pt-16">
			<h2
				id="proportionbar-heading"
				className="font-doc text-verdict font-semibold"
			>
				ProportionBar
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				How much of the claim is paid and how much is cut. Each part grows by
				its amount, with no rounding. The bar reads every part aloud.
			</p>

			{BARS.map(({ id, title, note, parts }) => (
				<Specimen key={id} id={id} title={title} note={note}>
					<div className="max-w-column">
						<ProportionBar
							total={CLAIMED_AMOUNT}
							parts={parts}
							format={format}
						/>
					</div>
				</Specimen>
			))}
		</section>
	);
}
