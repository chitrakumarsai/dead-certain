import { Button, Disclosure } from "@dead-certain/ui";
import { useState } from "react";
import { OnFilm } from "./OnFilm";
import { Specimen } from "./Specimen";

function WhyPanel() {
	return (
		<div className="max-w-column space-y-2">
			<p>
				The policy caps room rent, and a higher rent reduces other charges too.
			</p>
			<Button variant="quiet">Read clause 4.2</Button>
		</div>
	);
}

function NestedOnFilm() {
	const [isOpen, setIsOpen] = useState(true);
	return (
		<OnFilm>
			<Disclosure title="Show the rule" open={isOpen} onOpenChange={setIsOpen}>
				<p className="font-mono text-mono">
					room_rent_per_day &gt; room_rent_cap
				</p>
				<Disclosure title="Why this question?">
					<WhyPanel />
				</Disclosure>
			</Disclosure>
			<div className="pt-4">
				<Button onClick={() => setIsOpen(!isOpen)}>
					{isOpen
						? "Close the rule from outside"
						: "Open the rule from outside"}
				</Button>
			</div>
		</OnFilm>
	);
}

export const DISCLOSURE_SPECIMENS = [
	{ id: "disclosure-closed", title: "Closed" },
	{ id: "disclosure-open", title: "Open" },
	{ id: "disclosure-nested-film", title: "Nested on film" },
];

export function DisclosureSection() {
	return (
		<section aria-labelledby="disclosure-heading" className="pt-16">
			<h2
				id="disclosure-heading"
				className="font-doc text-verdict font-semibold"
			>
				Disclosure
			</h2>

			<Specimen
				id="disclosure-closed"
				title="Closed"
				note="Click, Enter or Space opens it. The chevron swaps its glyph; it does not rotate."
			>
				<Disclosure title="Why this question?">
					<WhyPanel />
				</Disclosure>
			</Specimen>

			<Specimen
				id="disclosure-open"
				title="Open"
				note="Escape inside the panel closes it and puts focus back on the trigger."
			>
				<Disclosure title="Why this question?" defaultOpen>
					<WhyPanel />
				</Disclosure>
			</Specimen>

			<Specimen
				id="disclosure-nested-film"
				title="Nested on film"
				note="The outer panel is controlled by its owner. Escape closes only the innermost open panel."
			>
				<NestedOnFilm />
			</Specimen>
		</section>
	);
}
