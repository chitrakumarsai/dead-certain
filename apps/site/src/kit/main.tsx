import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@dead-certain/ui/styles.css";
import { LiveRegion } from "@dead-certain/ui";
import { BUTTON_SPECIMENS, ButtonsSection } from "./ButtonsSection";
import {
	CLAUSE_QUOTE_SPECIMENS,
	ClauseQuoteSection,
} from "./ClauseQuoteSection";
import { DISCLOSURE_SPECIMENS, DisclosureSection } from "./DisclosureSection";
import { PRIMITIVE_SPECIMENS, PrimitivesSection } from "./PrimitivesSection";
import { SHEET_FILM_SPECIMENS, SheetFilmSection } from "./SheetFilmSection";
import {
	SOURCE_BADGE_SPECIMENS,
	SourceBadgeSection,
} from "./SourceBadgeSection";
import { TOKEN_SPECIMENS, TokensSection } from "./TokensSection";

const SECTIONS = [
	{ title: "Tokens", specimens: TOKEN_SPECIMENS },
	{ title: "Icons and accessibility helpers", specimens: PRIMITIVE_SPECIMENS },
	{ title: "Button", specimens: BUTTON_SPECIMENS },
	{ title: "Disclosure", specimens: DISCLOSURE_SPECIMENS },
	{ title: "SourceBadge", specimens: SOURCE_BADGE_SPECIMENS },
	{ title: "ClauseQuote", specimens: CLAUSE_QUOTE_SPECIMENS },
	{ title: "Sheet and Film", specimens: SHEET_FILM_SPECIMENS },
];

function Gallery() {
	// The specimens render after the browser has handled the fragment.
	useEffect(() => {
		const id = decodeURIComponent(location.hash.slice(1));
		if (id) document.getElementById(id)?.scrollIntoView();
	}, []);

	return (
		<div className="p-4 md:p-6">
			<a href="#content" className="text-sys-small underline">
				Skip to the content
			</a>
			<header className="pt-4">
				<h1 className="text-question font-semibold">Component kit</h1>
				<p className="max-w-column pt-2 text-text-soft">
					Every Dead Certain component in every state, on sample data.
				</p>
			</header>
			<nav aria-label="Contents" className="pt-6">
				{SECTIONS.map((section) => (
					<div key={section.title}>
						<h2 className="text-sys-small font-semibold">{section.title}</h2>
						<ul className="flex flex-wrap gap-x-4">
							{section.specimens.map((specimen) => (
								<li key={specimen.id}>
									<a
										href={`#${specimen.id}`}
										className="inline-flex min-h-touch items-center underline"
									>
										{specimen.title}
									</a>
								</li>
							))}
						</ul>
					</div>
				))}
			</nav>
			<main id="content" tabIndex={-1} className="pt-12">
				<TokensSection />
				<PrimitivesSection />
				<ButtonsSection />
				<DisclosureSection />
				<SourceBadgeSection />
				<ClauseQuoteSection />
				<SheetFilmSection />
			</main>
		</div>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("kit/index.html has no #root element");
createRoot(root).render(
	<StrictMode>
		<LiveRegion>
			<Gallery />
		</LiveRegion>
	</StrictMode>,
);
