import { Button, Sheet } from "@dead-certain/ui";
import { type FormEvent, useId, useState } from "react";
import { parseTarget } from "../../collectors/target";
import { SAMPLES } from "../run/samples";

const EMPTY = "Enter a repository as owner/name or a GitHub URL.";
const NOT_GITHUB =
	"This is not a GitHub repository. Use owner/name or a github.com URL.";

const FEATURES = [
	[
		"Facts from GitHub",
		"Licence, the .kiro folder, the README and more, read from the public API.",
	],
	[
		"Only what it cannot see",
		"A question is asked only when the API has no answer.",
	],
	[
		"Rule and evidence",
		"Every pass or fail shows the rule and what it was checked against.",
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

export const reportHref = (owner: string, name: string) =>
	`#/report?repo=${encodeURIComponent(`${owner}/${name}`)}`;

/** Screen 1: name a repository, or try a sample (requirement 2). */
export function Start() {
	const fieldId = useId();
	const errorId = useId();
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const parsed = parseTarget(text);
		if (!parsed.ok) {
			setError(parsed.reason === "empty" ? EMPTY : NOT_GITHUB);
			return;
		}
		location.hash = reportHref(parsed.target.owner, parsed.target.name);
	};

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
					Check a repository before you submit it
				</h1>
				<p className="max-w-column pt-6 text-sys-body text-text-secondary">
					Pre-Flight reads a public repository and returns a pass or fail for
					each checklist item, with the rule and the evidence behind it.
				</p>
				<p className="max-w-column pt-2 text-sys-small text-text-tertiary">
					Pre-Flight reads public repositories only. Nothing you enter leaves
					your browser except requests to GitHub.
				</p>
			</section>
			<div className="mx-auto w-full max-w-column pt-10 text-left">
				<Sheet>
					<form className="flex flex-col gap-2" onSubmit={submit} noValidate>
						<label htmlFor={fieldId} className="text-sys-body font-semibold">
							Repository
						</label>
						<input
							id={fieldId}
							type="text"
							autoComplete="off"
							spellCheck={false}
							value={text}
							placeholder="owner/name"
							aria-invalid={error ? true : undefined}
							aria-describedby={error ? errorId : undefined}
							onChange={(event) => {
								setText(event.target.value);
								setError(null);
							}}
							className="min-h-touch rounded-control border border-control-border bg-surface px-3 font-mono text-mono text-text aria-invalid:border-denied"
						/>
						{error && (
							<p
								id={errorId}
								className="text-sys-body font-semibold text-denied"
							>
								{error}
							</p>
						)}
						<div className="pt-2">
							<Button variant="wax" type="submit">
								Run the checks
							</Button>
						</div>
					</form>
					<section aria-labelledby="samples-heading" className="pt-8">
						<h2 id="samples-heading" className="text-sys-body font-semibold">
							Try a sample
						</h2>
						<ul className="flex flex-wrap gap-3 pt-3">
							{SAMPLES.map((s) => (
								<li key={s.id}>
									<Button
										variant="secondary"
										onClick={() => {
											location.hash = `#/report?sample=${s.id}`;
										}}
									>
										{`${s.target.owner}/${s.target.name}`}
									</Button>
								</li>
							))}
						</ul>
					</section>
				</Sheet>
			</div>
			<Tiles items={FEATURES} />
		</div>
	);
}
