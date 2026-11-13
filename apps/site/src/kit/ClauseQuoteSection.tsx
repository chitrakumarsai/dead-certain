import {
	ClauseQuote,
	type ClauseQuoteProps,
	ClauseRef,
} from "@dead-certain/ui";
import { clauseFixtures } from "@dead-certain/ui/fixtures";
import { OnFilm } from "./OnFilm";
import { Specimen } from "./Specimen";

const ROOM_RENT = clauseFixtures["4.2"] as ClauseQuoteProps["clause"];

const LONG_CLAUSE: ClauseQuoteProps["clause"] = {
	id: "4.2",
	title: "Room rent limit",
	text: "Room rent is limited to 1% of the sum insured per day. Where the rent is higher, other charges reduce in the same ratio, including the surgeon's fee, the anaesthetist's fee, nursing, investigations and the operating theatre, but not medicines, implants or consumables billed at cost. The limit applies to each day of the stay, and a part day counts as a full day.",
};

const STATES: {
	state: string;
	title: string;
	note: string;
	props: ClauseQuoteProps;
}[] = [
	{
		state: "plain",
		title: "Plain",
		note: "A clause shown for context, with a divider rule.",
		props: { clause: ROOM_RENT },
	},
	{
		state: "deciding",
		title: "Deciding, no mark",
		note: "The clause that decided the outcome gets the wax rule.",
		props: { clause: ROOM_RENT, variant: "deciding" },
	},
	{
		state: "deciding-mark",
		title: "Deciding, with a mark",
		note: "The sentence the rule depends on is marked in wax.",
		props: {
			clause: ROOM_RENT,
			variant: "deciding",
			mark: "1% of the sum insured per day",
		},
	},
	{
		state: "mark-not-found",
		title: "Mark not found",
		note: "When the mark is not in the text, nothing is highlighted and nothing is guessed.",
		props: { clause: ROOM_RENT, variant: "deciding", mark: "2% of the bill" },
	},
	{
		state: "long",
		title: "Long text",
		note: "Long clauses wrap inside the 680 px column.",
		props: { clause: LONG_CLAUSE },
	},
];

const SURFACES = ["paper", "film"] as const;

export const CLAUSE_QUOTE_SPECIMENS = [
	...STATES.flatMap(({ state, title }) =>
		SURFACES.map((surface) => ({
			id: `clausequote-${state}-${surface}`,
			title: `${title} on ${surface}`,
		})),
	),
	{ id: "clausequote-id-only", title: "Clause id only" },
];

export function ClauseQuoteSection() {
	return (
		<section aria-labelledby="clausequote-heading" className="pt-16">
			<h2
				id="clausequote-heading"
				className="font-doc text-verdict font-semibold"
			>
				ClauseQuote
			</h2>
			<div className="grid md:grid-cols-2 md:gap-x-8">
				{STATES.flatMap(({ state, title, note, props }) =>
					SURFACES.map((surface) => (
						<Specimen
							key={`${state}-${surface}`}
							id={`clausequote-${state}-${surface}`}
							title={`${title}, on ${surface}`}
							note={note}
						>
							{surface === "film" ? (
								<OnFilm>
									<ClauseQuote {...props} />
								</OnFilm>
							) : (
								<ClauseQuote {...props} />
							)}
						</Specimen>
					)),
				)}
			</div>
			<Specimen
				id="clausequote-id-only"
				title="Clause id only"
				note="When the app has no text for a cited clause, the id is printed as plain text, with no quote."
			>
				<ClauseRef id="9.9" />
			</Specimen>
		</section>
	);
}
