import { Button } from "@dead-certain/ui";
import { useBuiltTitle } from "../useTitle";

const HEADING = "Check a hospital claim before you file it";

const FEATURES = [
	[
		"One question at a time",
		"Only the questions that can change the amount are asked.",
	],
	[
		"Every deduction cited",
		"Each line shows the policy clause and the rule behind it.",
	],
	[
		"Stays in your browser",
		"The engine runs on this page. No account and no server.",
	],
] as const;

function Tiles({ items }: { items: readonly (readonly [string, string])[] }) {
	return (
		<ul className="grid gap-4 pt-16 md:grid-cols-3">
			{items.map(([title, body]) => (
				<li
					key={title}
					className="rounded-card border border-border-default bg-surface-2 p-6 highlight-inset"
				>
					<h2 className="text-sys-body font-semibold">{title}</h2>
					<p className="pt-2 text-sys-small text-text-secondary">{body}</p>
				</li>
			))}
		</ul>
	);
}

/** Screen 1: what the check does, and the way in (requirement 2). */
export function Start({ onStart }: { onStart: () => void }) {
	useBuiltTitle();
	return (
		<div className="mx-auto w-full max-w-page">
			<section
				aria-labelledby="start-heading"
				className="flex flex-col items-center pt-12 text-center md:pt-20"
			>
				<h1
					id="start-heading"
					className="max-w-3xl font-doc text-display font-semibold"
				>
					{HEADING}
				</h1>
				<p className="max-w-column pt-6 text-sys-body text-text-secondary">
					Answer a few questions. You get the amount the policy pays, each
					deduction, and the clause behind it.
				</p>
				<div className="flex flex-wrap items-center justify-center gap-4 pt-8">
					<Button variant="wax" onClick={onStart}>
						Start the check
					</Button>
					<a
						href="#/rulebook"
						className="inline-flex min-h-touch items-center rounded-control px-4 text-sys-body text-text underline underline-offset-4 hover:bg-surface-3"
					>
						Read the sample policy
					</a>
				</div>
				<p className="pt-6 text-sys-small text-text-tertiary">
					Uses a sample policy written for this demo. Your answers stay in your
					browser.
				</p>
			</section>
			<Tiles items={FEATURES} />
		</div>
	);
}
