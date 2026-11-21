import type { KnowledgeBase } from "@dead-certain/engine";
import { Button, lowerFirst, Sheet } from "@dead-certain/ui";
import { config } from "../config";
import { labelFor } from "../kb";
import { useTitle } from "../useTitle";

const HEADING = "__APP_TITLE__";
const CODE = "font-mono text-mono";

/** What the app decides, the way in, and where its rules live (requirement 5.12). */
export function Start({
	kb,
	onStart,
}: {
	kb: KnowledgeBase;
	onStart: () => void;
}) {
	useTitle("Start");
	const decides = lowerFirst(labelFor(kb, config.verdictGoal));
	return (
		<Sheet as="section" aria-labelledby="start-heading">
			<h1 id="start-heading" className="font-doc text-verdict font-semibold">
				{HEADING}
			</h1>
			<p className="max-w-column pt-4 text-sys-body">
				Answer a few questions. You get the {decides}, every line behind it, and
				the clause each rule cites.
			</p>
			<div className="pt-6">
				<Button variant="primary" onClick={onStart}>
					Start
				</Button>
			</div>
			<div className="pt-6 text-sys-small text-text-soft">
				<p>Your answers stay in your browser.</p>
				<p>
					To change the rules, edit <code className={CODE}>rulebook/</code> and{" "}
					<code className={CODE}>kb/</code> as the README section "Add a third
					app" explains.
				</p>
			</div>
		</Sheet>
	);
}
