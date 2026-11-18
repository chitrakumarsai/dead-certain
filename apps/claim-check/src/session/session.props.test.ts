import {
	answer,
	type FactValue,
	next,
	type Session,
	start,
} from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { consultArb, valueArb } from "../testing/consultArb";
import { realKb } from "../testing/realKb";
import { questionPath } from "./path";
import { progress } from "./progress";
import { relevantFacts, updateSkipped } from "./relevance";

const kb = realKb();
const RUNS = { numRuns: 100 };

const askable = (fact: string) => {
	const def = kb.facts[fact];
	return def !== undefined && !def.derived && def.ask !== undefined;
};

const sorted = (set: Set<string>) => [...set].sort();

describe("session properties", () => {
	it("gives the same path for any order of the answers", () => {
		// Feature: claim-check-app, Property 1: The question path does not depend on answer order
		fc.assert(
			fc.property(
				consultArb(kb).chain((s) =>
					fc
						.shuffledSubarray(Object.entries(s.answers), {
							minLength: Object.keys(s.answers).length,
						})
						.map((entries) => [s, Object.fromEntries(entries)] as const),
				),
				([s, reordered]) => {
					expect(questionPath(kb, reordered)).toEqual(
						questionPath(kb, s.answers),
					);
				},
			),
			RUNS,
		);
	});

	it("ends, asks nothing twice and holds only facts the engine asks", () => {
		// Feature: claim-check-app, Property 2: The path ends and asks nothing twice
		fc.assert(
			fc.property(consultArb(kb, 6), (s) => {
				const path = questionPath(kb, s.answers);
				expect(new Set(path).size).toBe(path.length);
				expect(path.every(askable)).toBe(true);
				const step = next(s);
				if (step.kind === "question") expect(path.at(-1)).toBe(step.fact);
			}),
			RUNS,
		);
	});

	it("keeps relevance to answered facts and the current question", () => {
		// Feature: claim-check-app, Property 6: Relevance is stable
		fc.assert(
			fc.property(consultArb(kb, 8), (s) => {
				const step = next(s);
				const current = step.kind === "question" ? step.fact : undefined;
				const relevant = relevantFacts(s, current);
				for (const fact of relevant)
					expect(fact === current || s.answers[fact] !== undefined).toBe(true);
				const same: Session = {
					kb,
					answers: Object.fromEntries(Object.entries(s.answers).reverse()),
				};
				expect(sorted(relevantFacts(same, current))).toEqual(sorted(relevant));
			}),
			RUNS,
		);
	});

	it("restores the view when an answer is changed and changed back", () => {
		// Feature: claim-check-app, Property 7: Changing an answer and changing it back restores the view
		const arb = consultArb(kb).chain((s) => {
			const facts = [...relevantFacts(s)];
			if (facts.length === 0) return fc.constant(null);
			return fc.constantFrom(...facts).chain((fact) => {
				const def = kb.facts[fact];
				if (def === undefined) return fc.constant(null);
				return valueArb(def).map((value) => ({ s, fact, value }));
			});
		});
		fc.assert(
			fc.property(arb, (picked) => {
				if (picked === null) return;
				const { s, fact, value } = picked;
				const original = s.answers[fact] as FactValue;
				const changed = answer(s, fact, value);
				const back = answer(changed, fact, original);
				expect(next(back)).toEqual(next(s));
				expect(sorted(relevantFacts(back))).toEqual(sorted(relevantFacts(s)));
				const skipped = updateSkipped([], s, changed, fact);
				expect(updateSkipped(skipped, changed, back, fact)).toEqual([]);
			}),
			RUNS,
		);
	});

	it("never promises fewer questions than come", () => {
		// Feature: claim-check-app, Property 9: Progress never lies the unsafe way
		fc.assert(
			fc.property(consultArb(kb), (final) => {
				const path = questionPath(kb, final.answers);
				let s = start(kb);
				path.forEach((fact, i) => {
					const { moreAtMost, index } = progress(kb, s.answers, fact);
					expect(index).toBe(i + 1);
					expect(path.length - 1 - i).toBeLessThanOrEqual(moreAtMost);
					s = answer(s, fact, final.answers[fact] as FactValue);
					if (moreAtMost === 0) expect(next(s).kind).toBe("verdict");
				});
			}),
			RUNS,
		);
	});
});
