import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@dead-certain/ui/styles.css";
import { LiveRegion, useAnnounce } from "@dead-certain/ui";
import {
	ANSWER_CONTROL_SPECIMENS,
	AnswerControlSection,
} from "./AnswerControlSection";
import {
	ANSWERS_RAIL_SPECIMENS,
	AnswersRailSection,
} from "./AnswersRailSection";
import { BUTTON_SPECIMENS, ButtonsSection } from "./ButtonsSection";
import { CHECK_ROW_SPECIMENS, CheckRowSection } from "./CheckRowSection";
import {
	CLAUSE_QUOTE_SPECIMENS,
	ClauseQuoteSection,
} from "./ClauseQuoteSection";
import { DISCLOSURE_SPECIMENS, DisclosureSection } from "./DisclosureSection";
import { LEDGER_SPECIMENS, LedgerSection } from "./LedgerSection";
import { PRIMITIVE_SPECIMENS, PrimitivesSection } from "./PrimitivesSection";
import { PROOF_TREE_SPECIMENS, ProofTreeSection } from "./ProofTreeSection";
import {
	PROPORTION_BAR_SPECIMENS,
	ProportionBarSection,
} from "./ProportionBarSection";
import {
	QUESTION_CARD_SPECIMENS,
	QuestionCardSection,
} from "./QuestionCardSection";
import { SHEET_FILM_SPECIMENS, SheetFilmSection } from "./SheetFilmSection";
import {
	SOURCE_BADGE_SPECIMENS,
	SourceBadgeSection,
} from "./SourceBadgeSection";
import { TOKEN_SPECIMENS, TokensSection } from "./TokensSection";
import {
	VERDICT_HEADLINE_SPECIMENS,
	VerdictHeadlineSection,
} from "./VerdictHeadlineSection";
import { WHAT_IF_LIST_SPECIMENS, WhatIfListSection } from "./WhatIfListSection";

const SECTIONS = [
	{ title: "Tokens", specimens: TOKEN_SPECIMENS },
	{ title: "Icons and accessibility helpers", specimens: PRIMITIVE_SPECIMENS },
	{ title: "Button", specimens: BUTTON_SPECIMENS },
	{ title: "Disclosure", specimens: DISCLOSURE_SPECIMENS },
	{ title: "SourceBadge", specimens: SOURCE_BADGE_SPECIMENS },
	{ title: "ClauseQuote", specimens: CLAUSE_QUOTE_SPECIMENS },
	{ title: "Sheet and Film", specimens: SHEET_FILM_SPECIMENS },
	{ title: "AnswerControl", specimens: ANSWER_CONTROL_SPECIMENS },
	{ title: "QuestionCard", specimens: QUESTION_CARD_SPECIMENS },
	{ title: "AnswersRail", specimens: ANSWERS_RAIL_SPECIMENS },
	{ title: "VerdictHeadline", specimens: VERDICT_HEADLINE_SPECIMENS },
	{ title: "ProportionBar", specimens: PROPORTION_BAR_SPECIMENS },
	{ title: "Ledger", specimens: LEDGER_SPECIMENS },
	{ title: "CheckRow", specimens: CHECK_ROW_SPECIMENS },
	{ title: "WhatIfList", specimens: WHAT_IF_LIST_SPECIMENS },
	{ title: "ProofTree", specimens: PROOF_TREE_SPECIMENS },
];

function Gallery() {
	const announce = useAnnounce();
	// The specimens render after the browser has handled the fragment.
	useEffect(() => {
		// Every QuestionCard and VerdictHeadline focuses its heading and
		// announces on mount, and the gallery shows many at once. The page starts at the top,
		// with focus on the body and a quiet live region.
		document.body.tabIndex = -1;
		document.body.focus({ preventScroll: true });
		document.body.removeAttribute("tabindex");
		announce("");
		const id = decodeURIComponent(location.hash.slice(1));
		if (id) document.getElementById(id)?.scrollIntoView();
		else scrollTo(0, 0);
	}, [announce]);

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
				<AnswerControlSection />
				<QuestionCardSection />
				<AnswersRailSection />
				<VerdictHeadlineSection />
				<ProportionBarSection />
				<LedgerSection />
				<CheckRowSection />
				<WhatIfListSection />
				<ProofTreeSection />
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
