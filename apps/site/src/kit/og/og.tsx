import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@dead-certain/ui/styles.css";
import {
	CheckRow,
	Ledger,
	LiveRegion,
	ProofTree,
	ProportionBar,
	Sheet,
	VerdictHeadline,
} from "@dead-certain/ui";
import compiledChecklist from "../../../../pre-flight/kb/dist/checklist.json";
import { compiledKb } from "../../landing/config";
import { printValue } from "../../landing/hero/because";
import { formatFor, labelFor } from "../../landing/kb";
import { isKnowledgeBase } from "../../landing/kbShape";
import {
	type OgKey,
	type OgScenes,
	ogScenes,
	PREFLIGHT_TITLE,
} from "./ogScenes";

// kit/og.html?image=<home|claimCheck|preFlight> draws one 1200 by 630 OG image;
// ?image=icon&size=<px> draws the icon. scripts/og.ts screenshots [data-og-frame].
const WIDTH = 1200;
const HEIGHT = 630;
const none = () => undefined;

function Home({ s }: { s: OgScenes }) {
	const kb = s.model.session.kb;
	return (
		<div
			// The room's grid without its glow, which keeps the PNG under 200 kB (owner, 2026-11-27).
			style={{ background: "var(--grid-calibration)" }}
			className="flex h-full items-center pl-16"
		>
			<div className="flex-1">
				<p
					className="font-doc font-semibold text-text"
					style={{ fontSize: 64, lineHeight: 1.1 }}
				>
					Dead Certain
				</p>
				<p
					className="pt-6 font-doc font-semibold text-hero-fill"
					style={{ fontSize: 48, lineHeight: 1.15 }}
				>
					{s.entries.home.text[1]}
				</p>
			</div>
			<div className="relative" style={{ width: 600, height: 580 }}>
				{/* The paper lies over the film's top edge, so the bar overlaps the strip. */}
				<div className="relative z-10" style={{ width: 540 }}>
					<Sheet>
						<VerdictHeadline
							state={s.model.state}
							statement={s.model.statement}
							headingLevel={2}
						/>
						<div className="pt-6">
							<ProportionBar
								total={s.model.ledger.claimed.value}
								parts={s.model.parts}
								format={formatFor(kb)}
							/>
						</div>
					</Sheet>
				</div>
				<div
					data-surface="film"
					className="absolute bottom-0 rounded-film border border-border-strong bg-surface film-grain p-4 text-text"
					style={{ width: 540, right: 40, paddingTop: 72 }}
				>
					<ProofTree
						root={s.proof}
						labelFor={(f) => labelFor(kb, f)}
						formatValue={(f, v) =>
							v === undefined
								? "Not known yet"
								: printValue(s.model.session, f, v)
						}
						onEscape={none}
					/>
				</div>
			</div>
		</div>
	);
}

function ClaimCheck({ s }: { s: OgScenes }) {
	const kb = s.model.session.kb;
	return (
		<div className="flex h-full items-center gap-12 px-16">
			<p
				className="flex-1 font-doc font-semibold text-text"
				style={{ fontSize: 48, lineHeight: 1.15 }}
			>
				{s.model.statement}
			</p>
			<div style={{ width: 560 }}>
				<Sheet>
					<Ledger
						claimed={s.model.ledger.claimed}
						items={s.model.ledger.items}
						payable={s.model.ledger.payable}
						format={formatFor(kb)}
						selectedFact={s.highlight.fact}
						onOpen={none}
					/>
				</Sheet>
			</div>
		</div>
	);
}

function PreFlight({ s }: { s: OgScenes }) {
	return (
		<div className="flex h-full items-center gap-12 px-16">
			<p
				className="flex-1 font-doc font-semibold text-text"
				style={{ fontSize: 48, lineHeight: 1.15 }}
			>
				{PREFLIGHT_TITLE}
			</p>
			<div style={{ width: 520 }}>
				<Sheet>
					<ul className="divide-y divide-divider">
						{s.checks.map((item) => (
							<CheckRow key={item.fact} item={item} onOpen={none} format={{}} />
						))}
					</ul>
				</Sheet>
			</div>
		</div>
	);
}

/** The square mark: the wordmark's initials in the wordmark's face. */
function Icon({ size }: { size: number }) {
	return (
		<div
			data-og-frame
			className="flex items-center justify-center bg-bg-base font-doc font-semibold text-text"
			style={{ width: size, height: size, fontSize: size * 0.5, lineHeight: 1 }}
		>
			DC
		</div>
	);
}

const SCENES: Record<OgKey, (props: { s: OgScenes }) => React.JSX.Element> = {
	home: Home,
	claimCheck: ClaimCheck,
	preFlight: PreFlight,
};

function Page() {
	const params = new URLSearchParams(location.search);
	const image = params.get("image");
	if (image === "icon")
		return <Icon size={Number(params.get("size")) || 512} />;
	const claim = compiledKb;
	if (!isKnowledgeBase(claim) || !isKnowledgeBase(compiledChecklist))
		return <p>A compiled knowledge base is missing. Run pnpm build first.</p>;
	const scenes = ogScenes(claim, compiledChecklist);
	const key = (Object.hasOwn(SCENES, image ?? "") ? image : "home") as OgKey;
	const Scene = SCENES[key];
	// The script reads the entries from here, and checks each string is in the frame.
	(window as unknown as { ogEntries: OgScenes["entries"] }).ogEntries =
		scenes.entries;
	return (
		<main
			data-og-frame
			className="overflow-hidden bg-bg-base"
			style={{ width: WIDTH, height: HEIGHT }}
		>
			<h1 className="sr-only">{`OG image: ${key}`}</h1>
			<Scene s={scenes} />
		</main>
	);
}

const root = document.getElementById("root");
if (root)
	createRoot(root).render(
		<StrictMode>
			<LiveRegion>
				<Page />
			</LiveRegion>
		</StrictMode>,
	);
