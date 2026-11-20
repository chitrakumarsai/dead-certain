import { answer, EngineError, next, start } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { GEN_REF, kbCaseArb } from "./testkit/arbs";
import { bodyOf } from "./testkit/body";
import { consult } from "./tools/consult";

describe("mcp-server consult", () => {
	// Feature: mcp-server, Property 1: consult relays the engine
	// **Validates: Requirements 3.2, 3.4, 3.5, 8.1**
	it("carries the engine's question, or its goals and line items, or its error", () => {
		let checked = 0;
		const seen = { question: 0, verdict: 0, error: 0 };
		fc.assert(
			fc.property(kbCaseArb, (sample) => {
				fc.pre(sample !== undefined);
				if (sample === undefined) return;
				checked++;
				const { kb, answers, workspace } = sample;
				const result = consult(workspace.ws, { kb: GEN_REF, answers });
				const body = bodyOf(result);

				let expected: ReturnType<typeof next> | undefined;
				try {
					let session = start(kb);
					for (const [fact, value] of Object.entries(answers)) {
						session = answer(session, fact, value);
					}
					expected = next(session);
				} catch (error) {
					expect(error).toBeInstanceOf(EngineError);
					expect(result.isError).toBe(true);
					seen.error++;
					expect(body.error.code).toBe((error as EngineError).code);
					expect(body.error.message).toBe((error as EngineError).message);
					return;
				}

				expect(result.isError).toBeUndefined();
				if (expected.kind === "question") {
					seen.question++;
					expect(body.status).toBe("question");
					expect(body.question.fact).toBe(expected.fact);
					expect(body.question.text).toBe(expected.text);
					expect(body.question.why).toBe(expected.why);
					expect(body.question.clause).toBe(expected.clause);
					expect(body.question.type).toBe(kb.facts[expected.fact]?.type);
				} else {
					seen.verdict++;
					expect(body.status).toBe("verdict");
					expect(Object.keys(body.goals)).toEqual([...kb.goals]);
					for (const goal of kb.goals) {
						expect(body.goals[goal]).toBe(expected.goals[goal] ?? null);
					}
					expect(body.line_items).toEqual(
						expected.lineItems.map((item) => ({
							fact: item.fact,
							label: item.label,
							role: item.role,
							value: item.value ?? null,
							rule: item.rule,
							clause: item.clause,
						})),
					);
					expect(body.needed.map((q) => q.fact)).toEqual(
						expected.needed.map((q) => q.fact),
					);
				}
			}),
			{ numRuns: 150 },
		);
		expect(checked).toBeGreaterThan(100);
		// Not vacuous: both outcomes occur.
		expect(seen.question).toBeGreaterThan(0);
		expect(seen.verdict).toBeGreaterThan(0);
	});
});
