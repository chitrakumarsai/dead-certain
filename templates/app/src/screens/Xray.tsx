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
import { config } from "../config";
import { clauseFor, labelFor, printValue, ruleExpression } from "../kb";
import type { Action, ViewState } from "../session/store";
import { VerdictScreen } from "./Verdict";

const keyOf = (t: XrayTarget) => (t.kind === "verdict" ? "verdict" : t.fact);

/** The proof of one target: the tree, then the clause that decided it. */
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
	const fact = target.kind === "verdict" ? config.verdictGoal : target.fact;
	const root = explain(view.session, fact);
	const close = () => dispatch({ type: "close" });
	return (
		<div className="space-y-6">
			<ProofTree
				key={keyOf(target)}
				root={root}
				labelFor={(f) => labelFor(kb, f)}
				formatValue={(f, value) =>
					value === undefined ? "Not known yet" : printValue(kb, f, value)
				}
				ruleExpression={(id) => ruleExpression(kb, id) || undefined}
				clauseFor={(id) => clauseFor(kb, id)}
				{...(root.clause === undefined ? {} : { decidingClause: root.clause })}
				onChangeAnswer={(f) => dispatch({ type: "edit", fact: f })}
				onEscape={close}
			/>
			{/* ProofTree quotes the deciding clause; only a missing one is named here, by id. */}
			{root.clause !== undefined &&
				clauseFor(kb, root.clause) === undefined && (
					<ClauseRef id={root.clause} variant="deciding" surface="film" />
				)}
		</div>
	);
}

/** The verdict on paper, and its proof on film when one is open (requirement 5.5). */
export function XrayVerdict({
	kb,
	view,
	verdict,
	dispatch,
}: {
	kb: KnowledgeBase;
	view: ViewState;
	verdict: Verdict;
	dispatch: (action: Action) => void;
}) {
	return (
		<XrayStage
			target={view.open}
			title={(t) =>
				t.kind === "verdict" ? "Why" : `Why: ${labelFor(kb, t.fact)}`
			}
			onClose={() => dispatch({ type: "close" })}
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
