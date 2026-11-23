import {
	Button,
	Disclosure,
	Ledger,
	ProportionBar,
	Sheet,
	VerdictHeadline,
	XrayStage,
	type XrayTarget,
} from "@dead-certain/ui";
import { useEffect } from "react";
import { links } from "./config";
import { Film } from "./hero/Film";
import type { HeroFailure, HeroModel } from "./hero/model";
import { formatFor, labelFor } from "./kb";
import { SampleFailed } from "./SampleFailed";

export const HEADLINE = "LLMs guess. The dead are certain.";
export const SEE_WHY_ID = "see-why";

/** The landing's call to action: a wax fill, never wax text. */
const WAX_LINK =
	"inline-flex min-h-touch items-center justify-center rounded-control bg-wax px-6 text-sys-body font-semibold text-on-wax glow-wax-soft transition-colors duration-(--dur-hover) ease-kit hover:bg-wax-hover";
const GHOST_LINK =
	"inline-flex min-h-touch items-center justify-center rounded-control border border-control-border px-6 text-sys-body font-semibold text-text transition-colors duration-(--dur-hover) ease-kit hover:bg-surface-3";

/** The kit's secondary button, on a native anchor (requirement 2.8). */
const SECONDARY_LINK =
	"inline-flex min-h-touch min-w-touch items-center justify-center rounded-control border border-control-border px-4 text-sys-body font-semibold text-text transition-colors duration-(--dur-press) ease-kit hover:bg-text/10 active:bg-text/20";

function VerdictSheet({
	model,
	open,
	onOpen,
}: {
	model: HeroModel;
	open: XrayTarget | null;
	onOpen: (target: XrayTarget) => void;
}) {
	const kb = model.session.kb;
	const format = formatFor(kb);
	const selected = open?.kind === "line" ? open.fact : undefined;
	return (
		<Sheet as="section" aria-labelledby="hero-verdict">
			<div id="hero-verdict">
				<VerdictHeadline
					state={model.state}
					statement={model.statement}
					headingLevel={2}
				/>
			</div>
			<div className="space-y-8 pt-8">
				<ProportionBar
					total={model.ledger.claimed.value}
					parts={model.parts}
					format={format}
				/>
				<Ledger
					claimed={model.ledger.claimed}
					items={model.ledger.items}
					payable={model.ledger.payable}
					format={format}
					{...(selected === undefined ? {} : { selectedFact: selected })}
					onOpen={(item) => onOpen({ kind: "line", fact: item.fact })}
				/>
				<div data-print-hide className="flex flex-wrap items-center gap-4">
					<Button
						id={SEE_WHY_ID}
						variant="primary"
						onClick={() => onOpen({ kind: "verdict" })}
					>
						See why
					</Button>
					<a href={links.claimCheck} className={SECONDARY_LINK}>
						Check your own claim
					</a>
				</div>
				<p className="text-sys-small text-text-soft">
					A sample claim on a sample policy written for this project. The
					verdict was worked out in your browser.
				</p>
				<div data-print-hide>
					<Disclosure title="Answers used for this claim">
						<dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sys-body">
							{model.answers.map((entry) => (
								<div key={entry.fact} className="contents">
									<dt className="text-text-soft">{entry.label}</dt>
									<dd className="tabular-nums">{entry.display}</dd>
								</div>
							))}
						</dl>
					</Disclosure>
				</div>
			</div>
		</Sheet>
	);
}

/** The headline, the paragraph and the working verdict with its X-ray (requirements 2 and 3). */
export function Hero({
	model,
	open,
	onOpen,
	onClose,
}: {
	model: HeroModel | HeroFailure | null;
	open: XrayTarget | null;
	onOpen: (target: XrayTarget) => void;
	onClose: () => void;
}) {
	// VerdictHeadline takes focus when it mounts, which suits an app arriving at
	// a verdict. On a page that opens with it, focus starts at the top (3.6).
	// Parent effects run after the child's, so this one undoes it once.
	// shortcut: page-side undo of kit behaviour, until VerdictHeadline gets a focusOnMount option.
	useEffect(() => {
		const active = document.activeElement;
		if (!(active instanceof HTMLElement) || !active.closest("#hero-verdict"))
			return;
		// A blur alone leaves the Tab starting point on the headline; focusing the
		// body moves it back to the top of the page.
		document.body.tabIndex = -1;
		document.body.focus({ preventScroll: true });
		document.body.removeAttribute("tabindex");
	}, []);
	const intro = (
		<div className="bg-hero -mx-4 px-4 pt-16 pb-16 text-center md:-mx-6 md:px-6 md:pt-24">
			<h1 className="mx-auto max-w-3xl font-doc text-display font-semibold text-hero-fill">
				{HEADLINE}
			</h1>
			<p className="mx-auto max-w-column pt-6 text-sys-body text-text-secondary">
				A language model drafts the rules from a rulebook once, at build time.
				From then on a small engine decides, in your browser, and every verdict
				comes with its proof. Here is one, worked out as this page loaded.
			</p>
			<div data-print-hide className="flex flex-wrap justify-center gap-3 pt-8">
				<a href={links.claimCheck} className={WAX_LINK}>
					Check a hospital claim
				</a>
				<a href={links.preFlight} className={GHOST_LINK}>
					Audit a repository
				</a>
			</div>
		</div>
	);
	if (model === null || "kind" in model)
		return (
			<>
				{intro}
				<SampleFailed />
			</>
		);
	const kb = model.session.kb;
	return (
		<>
			{intro}
			<div className="pt-4">
				<XrayStage
					target={open}
					title={(t) =>
						t.kind === "verdict" ? "Why" : `Why: ${labelFor(kb, t.fact)}`
					}
					onClose={onClose}
					sheet={<VerdictSheet model={model} open={open} onOpen={onOpen} />}
					film={(t) => (
						<Film session={model.session} target={t} onClose={onClose} />
					)}
				/>
			</div>
		</>
	);
}
