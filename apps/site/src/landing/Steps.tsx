import { ClauseQuote } from "@dead-certain/ui";
import type { MouseEvent } from "react";
import { links, REPO_URL } from "./config";
import { SEE_WHY_ID } from "./Hero";
import type { StepsData } from "./stepsData";

const LINK =
	"inline-flex min-h-touch items-center text-sys-body underline underline-offset-4";
const TITLE = "text-question font-semibold";
const CARD =
	"flex flex-col gap-4 rounded-card border border-border-default bg-surface-2 p-6 highlight-inset";
const STEP = "pr-2 font-mono text-mono text-text-tertiary";

/**
 * Rulebook, rules, verdict: the same claim's clause and rule, quoted from the
 * knowledge base (requirement 4). Without data each step keeps its words.
 */
export function Steps({
	data,
	onOpenProof,
}: {
	data: StepsData | null;
	/** Absent when the hero has no verdict to open. */
	onOpenProof?: () => void;
}) {
	const openProof = (event: MouseEvent<HTMLAnchorElement>) => {
		event.preventDefault();
		// Focus first, so the stage records See why as the opener and returns to it.
		document.getElementById(SEE_WHY_ID)?.focus();
		onOpenProof?.();
	};
	return (
		<section aria-labelledby="steps-heading" className="pt-24">
			<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
				<h2
					id="steps-heading"
					className="max-w-xl font-doc text-h2 font-semibold"
				>
					From rulebook to verdict
				</h2>
				<p className="max-w-md text-sys-body text-text-secondary">
					Three steps, and only the first uses a language model. A person checks
					its output before anything ships.
				</p>
			</div>
			<ol className="grid gap-4 pt-12 lg:grid-cols-3">
				<li className={CARD}>
					<h3 className={TITLE}>
						<span aria-hidden="true" className={STEP}>
							01
						</span>{" "}
						The rulebook
					</h3>
					<p className="text-sys-body">
						Each app starts from a rulebook written in plain words.
						{data &&
							` This is clause ${data.clause.id}, which the rule below cites.`}
					</p>
					{data && (
						<>
							<ClauseQuote clause={data.clause} />
							<a href={links.clause(data.clause.id)} className={LINK}>
								Read clause {data.clause.id} in the rulebook
							</a>
						</>
					)}
				</li>
				<li className={CARD}>
					<h3 className={TITLE}>
						<span aria-hidden="true" className={STEP}>
							02
						</span>{" "}
						The rules
					</h3>
					<p className="text-sys-body">
						A model drafted each rule from its clause, once, at build time, and
						a person checked it against the clause.
					</p>
					{data && (
						<div className="space-y-2 rounded-control border border-border-strong bg-bg-base p-4">
							<p className="font-mono text-mono text-text-soft">
								{data.rule.id}
							</p>
							<p className="text-sys-body">{data.rule.because}</p>
							<code className="block font-mono text-mono wrap-anywhere">
								{data.rule.expression}
							</code>
							<p className="text-sys-small text-text-soft">
								Cites clause {data.rule.cite}
							</p>
						</div>
					)}
				</li>
				<li className={CARD}>
					<h3 className={TITLE}>
						<span aria-hidden="true" className={STEP}>
							03
						</span>{" "}
						The verdict
					</h3>
					<p className="text-sys-body">
						The engine applies the rules to the answers and returns the verdict
						above, with its proof. Nothing in it is guessed.
					</p>
					{onOpenProof && (
						<a href={`#${SEE_WHY_ID}`} onClick={openProof} className={LINK}>
							Open the proof above
						</a>
					)}
				</li>
			</ol>
			<p className="pt-12 text-sys-body text-text-secondary">
				The specs, the engine and the rules were written with Kiro. The
				interface was built with Claude Code.
			</p>
			<p>
				<a href={`${REPO_URL}/tree/main/.kiro`} className={LINK}>
					The .kiro folder
				</a>
			</p>
		</section>
	);
}
