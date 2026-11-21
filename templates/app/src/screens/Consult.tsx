import type { FactValue, KnowledgeBase } from "@dead-certain/engine";
import { QuestionCard, Sheet } from "@dead-certain/ui";
import { useState } from "react";
import { clauseFor, formatFor } from "../kb";
import { progress } from "../session/progress";
import type { Action, Step, ViewState } from "../session/store";
import { useTitle } from "../useTitle";

type QuestionStep = Extract<Step, { kind: "question" }>;

/** One question at a time (requirement 5.4). Keyed by fact, so a new question starts fresh. */
export function Consult({
	kb,
	view,
	step,
	dispatch,
}: {
	kb: KnowledgeBase;
	view: ViewState;
	step: QuestionStep;
	dispatch: (action: Action) => void;
}) {
	const { question, def } = step;
	const [draft, setDraft] = useState<FactValue | undefined>(step.value);
	useTitle(question.text);

	const at = progress(kb, view.session.answers, question.fact);
	const clause =
		question.clause === undefined ? undefined : clauseFor(kb, question.clause);
	return (
		<>
			<h1 className="sr-only">__APP_TITLE__</h1>
			<Sheet>
				<QuestionCard
					question={question}
					def={def}
					{...(clause === undefined ? {} : { clause })}
					value={draft}
					onChange={setDraft}
					onSubmit={(fact, value) => dispatch({ type: "answer", fact, value })}
					{...(at.index > 1
						? { onBack: () => dispatch({ type: "back" }) }
						: {})}
					progress={at}
					{...(view.rejected === null ? {} : { externalError: view.rejected })}
					format={formatFor(kb)}
				/>
			</Sheet>
		</>
	);
}
