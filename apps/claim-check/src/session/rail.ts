import type { Session } from "@dead-certain/engine";
import type { AnswerEntry } from "@dead-certain/ui";
import { labelFor } from "../kb";
import { questionPath } from "./path";
import { printValue, relevantFacts } from "./relevance";

/** Relevant answers in question-path order (requirement 4.1). */
export function railEntries(s: Session): AnswerEntry[] {
	const relevant = relevantFacts(s);
	return questionPath(s.kb, s.answers).flatMap((fact) => {
		const value = s.answers[fact];
		if (value === undefined || !relevant.has(fact)) return [];
		return [
			{
				fact,
				label: labelFor(s.kb, fact),
				display: printValue(s, fact, value),
				value,
			},
		];
	});
}

/** One short sentence for the live region after an answer is changed (4.9). */
export function changeSentence(
	s: Session,
	fact: string,
	decided: boolean,
): string {
	const then = decided ? "The verdict updated." : "The next question is shown.";
	return `${labelFor(s.kb, fact)} changed. ${then}`;
}
