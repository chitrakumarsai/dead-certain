import { Button, Sheet } from "@dead-certain/ui";
import { useTitle } from "../useTitle";

const HEADING = "Check a hospital claim before you file it";

/** Screen 1: what the check does, and the way in (requirement 2). */
export function Start({ onStart }: { onStart: () => void }) {
	useTitle(HEADING);
	return (
		<Sheet as="section" aria-labelledby="start-heading">
			<h1 id="start-heading" className="font-doc text-verdict font-semibold">
				{HEADING}
			</h1>
			<p className="max-w-column pt-4 text-sys-body">
				Answer a few questions. You get the amount the policy pays, each
				deduction, and the clause behind it.
			</p>
			<div className="flex flex-wrap items-center gap-4 pt-6">
				<Button variant="primary" onClick={onStart}>
					Start the check
				</Button>
				<a
					href="#/rulebook"
					className="inline-flex min-h-touch items-center text-sys-body underline underline-offset-4"
				>
					Read the sample policy
				</a>
			</div>
			<div className="pt-6 text-sys-small text-text-soft">
				<p>Uses a sample policy written for this demo.</p>
				<p>Your answers stay in your browser.</p>
			</div>
		</Sheet>
	);
}
