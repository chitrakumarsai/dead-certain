import {
	answer,
	type FactValue,
	type KnowledgeBase,
} from "@dead-certain/engine";
import { QuestionCard, Sheet } from "@dead-certain/ui";
import { useState } from "react";
import { config, units } from "../config";
import { clauseFor, formatFor } from "../kb";
import { progress } from "../session/progress";
import type { Action, Step, ViewState } from "../session/store";
import { useTitle } from "../useTitle";
import { deductedAboveBill } from "../verdict/parts";

type QuestionStep = Extract<Step, { kind: "question" }>;

export const ABOVE_BILL =
	"With this answer, the deductions would be more than the hospital bill. Check the amounts.";

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
	const clause =
		question.clause === undefined ? undefined : clauseFor(kb, question.clause);

	const submit = (fact: string, value: FactValue) => {
		let above = false;
		try {
			above = deductedAboveBill(answer(view.session, fact, value));
		} catch {
			// The reducer rejects an answer the engine refuses.
		}
		if (above) {
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
			<div className="mx-auto w-full max-w-column pt-4 md:pt-8">
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
						{...(question.fact === config.claimedFact ? { min: 1 } : {})}
						format={formatFor(kb)}
					/>
				</Sheet>
			</div>
		</>
	);
}
