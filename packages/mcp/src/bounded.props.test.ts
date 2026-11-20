import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_PAYLOAD } from "./limits";
import { GEN_REF, kbCaseArb } from "./testkit/arbs";
import { bodyOf } from "./testkit/body";
import { consult } from "./tools/consult";
import { explainFact } from "./tools/explain";
import { listKbs } from "./tools/list";
import { validateKbs } from "./tools/validate";

describe("mcp-server bounds", () => {
	// Feature: mcp-server, Property 8: Payloads are bounded and stable
	// **Validates: Requirements 3.7, 6.3, 6.4**
	it("every call is at most 200,000 characters or LIMIT_EXCEEDED, and repeats byte for byte", () => {
		let calls = 0;
		fc.assert(
			fc.property(kbCaseArb, (sample) => {
				fc.pre(sample !== undefined);
				if (sample === undefined) return;
				const { ws } = sample.workspace;
				const base = { kb: GEN_REF, answers: sample.answers };
				const runs = [
					() => listKbs(ws),
					() => consult(ws, base),
					() => validateKbs(ws, {}),
					...Object.keys(sample.kb.facts).map(
						(fact) => () => explainFact(ws, { ...base, fact }),
					),
				];
				for (const run of runs) {
					const first = run();
					const second = run();
					calls++;
					const text = first.content[0]?.text ?? "";
					expect(second.content[0]?.text).toBe(text);
					expect(second.isError).toBe(first.isError);
					if (text.length > MAX_PAYLOAD) {
						expect(first.isError).toBe(true);
						expect(bodyOf(first).error.code).toBe("LIMIT_EXCEEDED");
					}
					// An accepted Payload is within the cap; a LIMIT_EXCEEDED one is tiny.
					expect(text.length).toBeLessThanOrEqual(MAX_PAYLOAD);
				}
			}),
			{ numRuns: 100 },
		);
		expect(calls).toBeGreaterThan(300);
	});
});
