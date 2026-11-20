import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { GEN_REF, kbCaseArb } from "./testkit/arbs";
import { bodyOf } from "./testkit/body";
import { consult } from "./tools/consult";
import { explainFact } from "./tools/explain";

describe("mcp-server explain", () => {
	// Feature: mcp-server, Property 4: explain agrees with consult
	// **Validates: Requirements 4.2, 4.3, 8.4**
	it("the proof root has the value consult reports for each goal, and value equals the root", () => {
		let checked = 0;
		let goalsChecked = 0;
		fc.assert(
			fc.property(kbCaseArb, (sample) => {
				fc.pre(sample !== undefined);
				if (sample === undefined) return;
				checked++;
				const { ws } = sample.workspace;
				const args = { kb: GEN_REF, answers: sample.answers };
				const verdict = consult(ws, args);
				if (verdict.isError || bodyOf(verdict).status !== "verdict") return;
				for (const goal of sample.kb.goals) {
					const explained = explainFact(ws, { ...args, fact: goal });
					expect(explained.isError).toBeUndefined();
					const body = bodyOf(explained);
					goalsChecked++;
					expect(body.proof.value).toEqual(bodyOf(verdict).goals[goal]);
					expect(body.value).toEqual(body.proof.value);
					expect(body.proof.fact).toBe(goal);
				}
			}),
			{ numRuns: 150 },
		);
		expect(checked).toBeGreaterThan(100);
		expect(goalsChecked).toBeGreaterThan(20);
	});
});
