import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { GEN_REF, kbCaseArb, permuted } from "./testkit/arbs";
import { consult } from "./tools/consult";
import { explainFact } from "./tools/explain";

describe("mcp-server order", () => {
	// Feature: mcp-server, Property 2: Answer order does not show
	// **Validates: Requirements 3.7, 8.2**
	it("consult and explain return equal Payloads for any permutation of the answers", () => {
		let checked = 0;
		let multi = 0;
		fc.assert(
			fc.property(
				kbCaseArb.chain((sample) =>
					sample === undefined
						? fc.constant(undefined)
						: permuted(sample.answers).map((other) => ({ sample, other })),
				),
				(both) => {
					fc.pre(both !== undefined);
					if (both === undefined) return;
					const { sample, other } = both;
					checked++;
					if (Object.keys(sample.answers).length > 1) multi++;
					const { ws } = sample.workspace;
					const first = consult(ws, { kb: GEN_REF, answers: sample.answers });
					const second = consult(ws, { kb: GEN_REF, answers: other });
					expect(second.content).toEqual(first.content);
					expect(second.isError).toBe(first.isError);
					for (const fact of Object.keys(sample.kb.facts)) {
						const a = explainFact(ws, {
							kb: GEN_REF,
							fact,
							answers: sample.answers,
						});
						const b = explainFact(ws, { kb: GEN_REF, fact, answers: other });
						expect(b.content).toEqual(a.content);
					}
				},
			),
			{ numRuns: 120 },
		);
		expect(checked).toBeGreaterThan(100);
		expect(multi).toBeGreaterThan(20);
	});
});
