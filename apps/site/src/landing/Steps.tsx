import { ClauseQuote } from "@dead-certain/ui";
import type { MouseEvent } from "react";
import { links, REPO_URL } from "./config";
import { SEE_WHY_ID } from "./Hero";
import type { StepsData } from "./stepsData";

const LINK =
	"inline-flex min-h-touch items-center text-sys-body underline underline-offset-4";
const TITLE = "text-sys-body font-semibold";

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
		<section aria-labelledby="steps-heading" className="max-w-column pt-16">
			<h2 id="steps-heading" className="font-doc text-question font-semibold">
				From rulebook to verdict
			</h2>
			<ol className="list-decimal space-y-12 pt-6 pl-8 marker:font-mono marker:text-text-soft">
				<li className="space-y-4">
					<h3 className={TITLE}>The rulebook</h3>
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
				<li className="space-y-4">
					<h3 className={TITLE}>The rules</h3>
					<p className="text-sys-body">
						A model drafted each rule from its clause, once, at build time, and
						a person checked it against the clause.
					</p>
					{data && (
						<div className="space-y-2 rounded-control border border-divider p-4">
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
				<li className="space-y-4">
					<h3 className={TITLE}>The verdict</h3>
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
			<p className="pt-12 text-sys-body">
				The specs, the engine and the rules were written with Kiro. The
				interface was built with Claude Code.{" "}
				{/* Inline in a sentence, so the 44 px target rule's inline exception applies. */}
				<a
					href={`${REPO_URL}/tree/main/.kiro`}
					className="underline underline-offset-4"
				>
					The .kiro folder
				</a>
			</p>
		</section>
	);
}
