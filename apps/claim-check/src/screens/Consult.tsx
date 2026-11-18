import type { FactValue, KnowledgeBase } from "@dead-certain/engine";
import { QuestionCard, Sheet } from "@dead-certain/ui";
import { useState } from "react";
import { atMostClaimed, config, units } from "../config";
import { clauseFor, formatFor } from "../kb";
import { progress } from "../session/progress";
import type { Action, Step, ViewState } from "../session/store";
import { useTitle } from "../useTitle";

type QuestionStep = Extract<Step, { kind: "question" }>;

export const ABOVE_BILL = "This cannot be more than the hospital bill.";

/** One question at a time (requirement 3). Keyed by fact, so a new question starts fresh. */
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
	const [localError, setLocalError] = useState<string | null>(null);
	useTitle(question.text);

	const answers = view.session.answers;
	const at = progress(kb, answers, question.fact);
	const claimed = answers[config.claimedFact];
	const clause =
		question.clause === undefined ? undefined : clauseFor(kb, question.clause);

	const submit = (fact: string, value: FactValue) => {
		// shortcut: checked when answered only; a later, lower bill is not re-checked.
		if (
			atMostClaimed.includes(fact) &&
			typeof value === "number" &&
			typeof claimed === "number" &&
			value > claimed
		) {
			setLocalError(ABOVE_BILL);
			return;
		}
		setLocalError(null);
		dispatch({ type: "answer", fact, value });
	};

	const unit = units[question.fact];
	const error = localError ?? view.rejected ?? undefined;
	return (
		<>
			<h1 className="sr-only">Check a hospital claim</h1>
			<Sheet>
				<QuestionCard
					question={question}
					def={def}
					{...(clause === undefined ? {} : { clause })}
					value={draft}
					onChange={(next) => {
						setDraft(next);
						setLocalError(null);
					}}
					onSubmit={submit}
					{...(at.index > 1
						? { onBack: () => dispatch({ type: "back" }) }
						: {})}
					progress={at}
					{...(error === undefined ? {} : { externalError: error })}
					{...(unit === undefined ? {} : { unit })}
					format={formatFor(kb)}
				/>
			</Sheet>
		</>
	);
}
