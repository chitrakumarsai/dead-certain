import type { FactDef, KnowledgeBase } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText } from "../compile";
import { answersArb, kbArb, recordScenario, renderYaml } from "../testkit";
import type { GoldenValue, Scenario } from "./model";
import { runScenario } from "./run";

const FILE = "apps/demo/kb/demo.yaml";

const passingKbAndFactsArb = kbArb.chain((generated) => {
	const compiled = compileText(renderYaml(generated), FILE);
	if (!compiled.ok) return fc.constant(undefined);
	const kb: KnowledgeBase = compiled.kb;
	return answersArb(kb, { partial: true }).map((facts) => ({ kb, facts }));
});

/** A value of the fact's type that differs from `value`. */
function different(def: FactDef, value: GoldenValue): GoldenValue {
	if (value === null) {
		switch (def.type) {
			case "boolean":
				return true;
			case "number":
			case "money":
				return 1;
			case "date":
				return "2000-01-01";
			default:
				return def.options?.[0] ?? "red";
		}
	}
	switch (def.type) {
		case "boolean":
			return !value;
		case "number":
		case "money":
			return (value as number) + 1;
		case "date":
			return value === "2000-01-01" ? "2000-01-02" : "2000-01-01";
		default: {
			const other = (def.options ?? []).find((option) => option !== value);
			return other ?? null;
		}
	}
}

describe("Property 2: Mutation is caught", () => {
	// Feature: kb-golden, Property 2: Mutation is caught
	/** **Validates: Requirements 5.4, 4.8, 11.2** */
	it("changing one expected goal to a different value fails with a difference on that goal alone", () => {
		let mutated = 0;
		fc.assert(
			fc.property(
				passingKbAndFactsArb,
				fc.constantFrom("consult", "audit" as const),
				(sample, mode) => {
					if (sample === undefined) return;
					const scenario = recordScenario(sample.kb, sample.facts, mode);
					if (scenario === undefined || "ask" in scenario.expect) return;
					const goals = scenario.expect.goals;
					for (const goal of sample.kb.goals) {
						const def = sample.kb.facts[goal];
						if (def === undefined) continue;
						const changed = different(def, goals[goal] ?? null);
						const mutant: Scenario = {
							...scenario,
							expect: {
								...scenario.expect,
								goals: { ...goals, [goal]: changed },
							},
						};
						const result = runScenario(sample.kb, mutant);
						mutated += 1;

						expect(result.status).toBe("failed");
						expect(result.differences.map((d) => d.field)).toEqual([
							`goals.${goal}`,
						]);
					}
				},
			),
			{ numRuns: 300 },
		);
		expect(mutated).toBeGreaterThan(30);
	});
});
