import { Button, StaleLinkNotice } from "@dead-certain/ui";
import { useState } from "react";
import { Specimen } from "./Specimen";

/** The notice as a page shows it, with the start count visible. */
function Notice(props: Omit<Parameters<typeof StaleLinkNotice>[0], "onStart">) {
	const [starts, setStarts] = useState(0);
	return (
		<div className="space-y-3">
			<StaleLinkNotice {...props} onStart={() => setStarts((n) => n + 1)} />
			<p className="text-sys-small text-text-soft">
				Start the check pressed:{" "}
				<span data-started className="font-mono text-mono">
					{starts}
				</span>
			</p>
		</div>
	);
}

/** A notice that arrives after the page, as it does when a link fails to decode. */
function Appears() {
	const [isShown, setShown] = useState(false);
	return (
		<div className="space-y-4">
			<Button onClick={() => setShown(true)}>Show the notice</Button>
			{isShown && <Notice failure="MALFORMED_TOKEN" />}
		</div>
	);
}

export const STALE_LINK_SPECIMENS = [
	{ id: "stalelink-kb-mismatch", title: "Older rules, with the rulebook link" },
	{
		id: "stalelink-kb-mismatch-no-link",
		title: "Older rules, no rulebook link",
	},
	{ id: "stalelink-malformed", title: "Incomplete or damaged" },
	{ id: "stalelink-unsupported", title: "Different version" },
	{ id: "stalelink-appears", title: "Appears" },
];

export function StaleLinkSection() {
	return (
		<section aria-labelledby="stalelink-heading" className="pt-16">
			<h2
				id="stalelink-heading"
				className="font-doc text-verdict font-semibold"
			>
				StaleLinkNotice
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				What a verdict link that cannot be replayed shows instead of the
				verdict. Neutral, never the denial colour, and always a way forward.
			</p>

			<Specimen
				id="stalelink-kb-mismatch"
				title="Older rules, with the rulebook link"
				note="The rules changed since the link was made. Read the rules appears only here, when the app passes a link."
			>
				<Notice failure="KB_MISMATCH" rulebookHref="#rulebook" />
			</Specimen>
			<Specimen
				id="stalelink-kb-mismatch-no-link"
				title="Older rules, no rulebook link"
				note="Without a rulebook link the notice offers only Start the check."
			>
				<Notice failure="KB_MISMATCH" />
			</Specimen>
			<Specimen
				id="stalelink-malformed"
				title="Incomplete or damaged"
				note="A link cut short or mangled in copying."
			>
				<Notice failure="MALFORMED_TOKEN" />
			</Specimen>
			<Specimen
				id="stalelink-unsupported"
				title="Different version"
				note="A link from a version of the app that this one cannot read."
			>
				<Notice failure="UNSUPPORTED_VERSION" />
			</Specimen>
			<Specimen
				id="stalelink-appears"
				title="Appears"
				note="When the notice appears its heading takes focus and the live region reads it."
			>
				<Appears />
			</Specimen>
		</section>
	);
}
