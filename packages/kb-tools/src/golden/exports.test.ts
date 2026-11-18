import type { FactValue, KnowledgeBase } from "@dead-certain/engine";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
	Difference,
	Expectation,
	GoldenCode,
	GoldenDiagnostic,
	GoldenRun,
	GoldenSet,
	GoldenValue,
	LoadGoldenResult,
	Scenario,
	ScenarioResult,
} from "../index";
import * as kbTools from "../index";

describe("the golden API, exported from the package entry", () => {
	it("exports each function and constant by name", () => {
		for (const name of [
			"loadGolden",
			"loadGoldenRaw",
			"checkGolden",
			"duplicateIds",
			"runScenario",
			"runGolden",
			"coverage",
			"MINIMUM_SCENARIOS",
			"GOLDEN_ERROR_CODES",
			"GOLDEN_WARNING_CODES",
		] as const) {
			expect(kbTools, name).toHaveProperty(name);
		}
		expect(kbTools.MINIMUM_SCENARIOS).toBe(12);
	});

	it("has the signatures the design gives", () => {
		expectTypeOf(kbTools.loadGolden).parameters.toEqualTypeOf<
			[string, string]
		>();
		expectTypeOf(kbTools.loadGolden).returns.toEqualTypeOf<LoadGoldenResult>();
		expectTypeOf(kbTools.loadGoldenRaw).parameters.toEqualTypeOf<
			[unknown, string]
		>();
		expectTypeOf(kbTools.checkGolden).parameters.toEqualTypeOf<
			[GoldenSet, KnowledgeBase, string]
		>();
		expectTypeOf(kbTools.runScenario).parameters.toEqualTypeOf<
			[KnowledgeBase, Scenario]
		>();
		expectTypeOf(kbTools.runScenario).returns.toEqualTypeOf<ScenarioResult>();
		expectTypeOf(kbTools.runGolden).parameters.toEqualTypeOf<
			[KnowledgeBase, readonly Scenario[], string]
		>();
		expectTypeOf(kbTools.runGolden).returns.toEqualTypeOf<GoldenRun>();
		expectTypeOf(kbTools.coverage).parameters.toEqualTypeOf<
			[KnowledgeBase, string, readonly ScenarioResult[], number]
		>();
	});

	it("has the shapes the other lane reads", () => {
		expectTypeOf<GoldenValue>().toEqualTypeOf<FactValue | null>();
		expectTypeOf<Scenario["mode"]>().toEqualTypeOf<"consult" | "audit">();
		expectTypeOf<Scenario["id"]>().toBeString();
		expectTypeOf<GoldenSet["scenarios"]>().toEqualTypeOf<readonly Scenario[]>();
		expectTypeOf<ScenarioResult["status"]>().toEqualTypeOf<
			"passed" | "failed" | "error"
		>();
		expectTypeOf<Difference["field"]>().toBeString();
		expectTypeOf<Expectation>().toMatchTypeOf<
			{ readonly ask: string } | { readonly goals: object }
		>();
		expectTypeOf<GoldenDiagnostic["code"]>().toEqualTypeOf<GoldenCode>();
		expectTypeOf<GoldenDiagnostic["severity"]>().toEqualTypeOf<
			"error" | "warning"
		>();
	});

	it("returns values that serialise: results hold only strings, numbers and arrays", () => {
		const loaded = kbTools.loadGolden(
			"kb: k\nscenarios:\n  - id: a\n    title: t\n    facts: {}\n    expect: { goals: {} }\n",
			"f.yaml",
		);

		expect(JSON.parse(JSON.stringify(loaded))).toEqual(loaded);
	});
});
