import type { KnowledgeBase } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText } from "../compile";
import { answersArb, kbArb, recordScenario, renderYaml } from "../testkit";
import { checkGolden } from "./check";
import { runScenario } from "./run";

const FILE = "apps/demo/kb/demo.yaml";

/** A generated knowledge base that passes validation, with partial type-valid answers. */
const passingKbAndFactsArb = kbArb.chain((generated) => {
	const compiled = compileText(renderYaml(generated), FILE);
	if (!compiled.ok) return fc.constant(undefined);
	const kb: KnowledgeBase = compiled.kb;
	return answersArb(kb, { partial: true }).map((facts) => ({ kb, facts }));
});

describe("Property 1: Record and replay", () => {
	// Feature: kb-golden, Property 1: Record and replay
	/** **Validates: Requirements 5.1, 5.2, 5.3, 4.2, 4.3, 4.4, 4.5, 11.1** */
	it.each(["consult", "audit"] as const)(
		"a scenario recorded from the engine's own %s result passes, and fits its knowledge base",
		(mode) => {
			let recorded = 0;
			fc.assert(
				fc.property(passingKbAndFactsArb, (sample) => {
					if (sample === undefined) return;
					const scenario = recordScenario(sample.kb, sample.facts, mode);
					if (scenario === undefined) return;
					recorded += 1;

					const checked = checkGolden(
						{ kb: sample.kb.id, scenarios: [scenario] },
						sample.kb,
						"apps/demo/golden/main.yaml",
					);
					expect(checked.diagnostics).toEqual([]);
					const result = runScenario(sample.kb, scenario);
					expect(result.differences).toEqual([]);
					expect(result.status).toBe("passed");
				}),
				{ numRuns: 300 },
			);
			// The premise must not be vacuous.
			expect(recorded).toBeGreaterThan(30);
		},
	);
});
