import {
	explain,
	type KnowledgeBase,
	type Verdict,
} from "@dead-certain/engine";
import {
	ClauseRef,
	ProofTree,
	XrayStage,
	type XrayTarget,
} from "@dead-certain/ui";
import type { ReactNode } from "react";
import { config } from "../config";
import { clauseFor, labelFor, ruleExpression } from "../kb";
import { printValue } from "../session/relevance";
import type { Action, ViewState } from "../session/store";
import { withPrintedBecause } from "../xray/because";
import { VerdictScreen } from "./Verdict";

const keyOf = (t: XrayTarget) => (t.kind === "verdict" ? "verdict" : t.fact);

/** The proof of one target: the tree, then the clause that decided it (8.1 to 8.7). */
function FilmBody({
	kb,
	view,
	target,
	dispatch,
}: {
	kb: KnowledgeBase;
	view: ViewState;
	target: XrayTarget;
	dispatch: (action: Action) => void;
}) {
	const fact = target.kind === "verdict" ? config.stateGoal : target.fact;
	const root = withPrintedBecause(explain(view.session, fact), view.session);
	const close = () => dispatch({ type: "close" });
	return (
		<div className="space-y-6">
			<ProofTree
				key={keyOf(target)}
				root={root}
				labelFor={(f) => labelFor(kb, f)}
				formatValue={(f, value) =>
					value === undefined
						? "Not known yet"
						: printValue(view.session, f, value)
				}
				ruleExpression={(id) => ruleExpression(kb, id) || undefined}
				clauseFor={(id) => clauseFor(kb, id)}
				{...(root.clause === undefined ? {} : { decidingClause: root.clause })}
				// Edit closes the panel and shows the question filled in (8.12).
				onChangeAnswer={(f) => dispatch({ type: "edit", fact: f })}
				onEscape={close}
			/>
			{root.clause !== undefined && (
				<ClauseRef
					id={root.clause}
					{...(clauseFor(kb, root.clause) === undefined
						? {}
						: { clause: clauseFor(kb, root.clause) })}
					variant="deciding"
					surface="film"
				/>
			)}
		</div>
	);
}

/** The verdict on paper, and its proof on film when one is open. */
export function XrayVerdict({
	kb,
	view,
	verdict,
	dispatch,
	rail,
}: {
	kb: KnowledgeBase;
	view: ViewState;
	verdict: Verdict;
	dispatch: (action: Action) => void;
	rail: ReactNode;
}) {
	return (
		<XrayStage
			target={view.open}
			title={(t) =>
				t.kind === "verdict" ? "Why" : `Why: ${labelFor(kb, t.fact)}`
			}
			onClose={() => dispatch({ type: "close" })}
			rail={rail}
			sheet={
				<VerdictScreen
					kb={kb}
					view={view}
					verdict={verdict}
					dispatch={dispatch}
				/>
			}
			film={(t) => (
				<FilmBody kb={kb} view={view} target={t} dispatch={dispatch} />
			)}
		/>
	);
}
