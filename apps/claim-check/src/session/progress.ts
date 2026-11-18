import type { FactValue, KnowledgeBase } from "@dead-certain/engine";
import { questionPath } from "./path";

export interface Progress {
	/** 1-based position of the current fact in the question path. */
	index: number;
	/** An upper bound on the questions after this one; 0 means "Last question." */
	moreAtMost: number;
}

export function progress(
	kb: KnowledgeBase,
	answers: Readonly<Record<string, FactValue>>,
	currentFact: string,
): Progress {
	const path = questionPath(kb, answers);
	const at = path.indexOf(currentFact);
	const unanswered = Object.entries(kb.facts).filter(
		([fact, def]) =>
			!def.derived &&
			def.ask !== undefined &&
			answers[fact] === undefined &&
			fact !== currentFact,
	).length;
	return {
		index: at === -1 ? path.length + 1 : at + 1,
		moreAtMost: unanswered,
	};
}
