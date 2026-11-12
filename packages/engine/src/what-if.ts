import { EngineError } from "./errors";
import { buildVerdict, evaluateSession } from "./outcome";
import { Resolver } from "./resolve";
import { thresholdCandidates } from "./thresholds";
import type { Alternative, FactValue, Session } from "./types";
import { deepEqual, hasOwn } from "./util";

/** Candidate values for an answered Askable_Fact, current answer removed. */
function candidatesFor(
	s: Session,
	name: string,
	current: FactValue,
): FactValue[] {
	const def = s.kb.facts[name];
	if (def === undefined) return [];
	let list: FactValue[];
	switch (def.type) {
		case "boolean":
			list = [false, true];
			break;
		case "enum":
			list = [...(def.options ?? [])];
			break;
		default:
			list = thresholdCandidates(
				s.kb,
				new Resolver(s.kb, s.answers),
				s.answers,
				name,
			);
	}
	return list.filter((v) => v !== current);
}

/**
 * Single-answer changes that alter the Verdict. The caller has validated the
 * knowledge base and answers. A throw while computing the base Verdict
 * propagates; a throw for a candidate drops that candidate.
 */
export function computeWhatIf(s: Session): Alternative[] {
	if (Object.keys(s.answers).length === 0) return [];
	const base = buildVerdict(s.kb, evaluateSession(s.kb, s.answers));
	const out: Alternative[] = [];
	for (const [name, def] of Object.entries(s.kb.facts)) {
		if (def.derived === true || def.ask === undefined) continue;
		if (!hasOwn(s.answers, name)) continue;
		const current = s.answers[name] as FactValue;
		for (const value of candidatesFor(s, name, current)) {
			const changed = Object.fromEntries([
				...Object.entries(s.answers).filter(([k]) => k !== name),
				[name, value],
			]) as Record<string, FactValue>;
			try {
				const verdict = buildVerdict(s.kb, evaluateSession(s.kb, changed));
				if (!deepEqual(verdict, base)) out.push({ fact: name, value, verdict });
			} catch (e) {
				if (e instanceof EngineError) continue;
				throw e;
			}
		}
	}
	return out;
}
