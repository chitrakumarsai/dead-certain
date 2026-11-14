import {
	checkValue,
	normaliseValue,
	validateAnswers,
	validateKb,
} from "./check";
import { decode, encode } from "./codec/encode";
import { EngineError } from "./errors";
import { explainFact } from "./explain";
import { buildQuestion, buildVerdict, evaluateSession } from "./outcome";
import type {
	Alternative,
	EngineApi,
	FactValue,
	KnowledgeBase,
	ProofNode,
	Question,
	Session,
	Verdict,
} from "./types";
import { computeWhatIf } from "./what-if";

/** Starts a consultation: the same `kb` and a fresh, empty `answers` object. */
export function start(kb: KnowledgeBase): Session {
	validateKb(kb);
	return { kb, answers: {} };
}

/** Returns a new Session with one more answer; the input Session is untouched. */
export function answer(s: Session, fact: string, value: FactValue): Session {
	validateKb(s.kb);
	checkValue(s.kb, fact, value);
	// fromEntries defines own properties, so `__proto__` is a safe fact name.
	const entries: [string, FactValue][] = Object.entries(s.answers).filter(
		([name]) => name !== fact,
	);
	entries.push([fact, normaliseValue(value)]);
	entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	return { kb: s.kb, answers: Object.fromEntries(entries) };
}

/** Consultation mode: the next Question, or a Verdict once nothing more can matter. */
export function next(s: Session): Question | Verdict {
	validateKb(s.kb);
	validateAnswers(s.kb, s.answers);
	const outcome = evaluateSession(s.kb, s.answers);
	const first = outcome.relevant[0];
	if (outcome.undecidedGoals.length > 0 && first !== undefined) {
		return buildQuestion(s.kb, first);
	}
	return buildVerdict(s.kb, outcome);
}

/** Audit mode: a Verdict whose `needed` lists every relevant unanswered fact. */
export function audit(
	kb: KnowledgeBase,
	facts: Readonly<Record<string, FactValue>>,
): Verdict {
	validateKb(kb);
	validateAnswers(kb, facts);
	return buildVerdict(kb, evaluateSession(kb, facts));
}

/** Proof tree of one fact; throws only where `next` throws the same code. */
export function explain(s: Session, fact: string): ProofNode {
	validateKb(s.kb);
	if (!Object.hasOwn(s.kb.facts, fact)) {
		throw new EngineError(
			"UNKNOWN_FACT",
			`Fact "${fact}" is not in the knowledge base.`,
		);
	}
	validateAnswers(s.kb, s.answers);
	return explainFact(s, fact);
}

/** Single-answer changes that alter the Verdict, with threshold probing. */
export function whatIf(s: Session): Alternative[] {
	validateKb(s.kb);
	validateAnswers(s.kb, s.answers);
	return computeWhatIf(s);
}

export { decode, encode };

/** Compile-time check that the eight functions satisfy `EngineApi`. */
const _contract = {
	start,
	next,
	answer,
	audit,
	explain,
	whatIf,
	encode,
	decode,
} satisfies EngineApi;
