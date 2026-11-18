import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkGolden } from "../golden/check";
import { runScenario } from "../golden/run";
import { goldenSetArb, recordScenario } from "./golden";
import { fixtureKb } from "./goldenFixture";

const kb = fixtureKb();
const FACTS = {
	claimed: 100,
	sum_insured: 500000,
	room_rent_per_day: 1000,
	age: 30,
	policy_start: "2024-01-01",
	admission_date: "2024-06-01",
} as const;

describe("recordScenario", () => {
	it("records an audit run with the audit's goals, line items and fired rules", () => {
		const scenario = recordScenario(kb, FACTS, "audit");

		expect(scenario?.expect).toMatchObject({
			goals: { payable_amount: 100, verdict: "paid" },
			needed: [],
		});
		expect(scenario?.expect).toHaveProperty("fires");
		expect(scenario).toBeDefined();
		if (scenario === undefined) return;
		expect(
			checkGolden({ kb: kb.id, scenarios: [scenario] }, kb, "f.yaml")
				.diagnostics,
		).toEqual([]);
		expect(runScenario(kb, scenario).status).toBe("passed");
	});

	it("records the question a consult run stops at", () => {
		const scenario = recordScenario(kb, { claimed: 100 }, "consult");

		expect(scenario?.expect).toEqual({ ask: "policy_start" });
	});

	it("records unknown goals as null and the questions still needed", () => {
		const scenario = recordScenario(kb, { claimed: 100 }, "audit");

		expect(scenario?.expect).toMatchObject({
			goals: { payable_amount: null, verdict: null },
			needed: ["policy_start", "admission_date"],
		});
	});

	it("returns nothing when the engine throws for the facts", () => {
		expect(
			recordScenario(kb, { age: "old" as never }, "consult"),
		).toBeUndefined();
	});
});

describe("goldenSetArb", () => {
	it("builds sets that checkGolden accepts and runScenario passes, with ids G-1, G-2, ...", () => {
		for (const set of fc.sample(goldenSetArb(kb), 50)) {
			expect(set.kb).toBe("fixture");
			expect(set.scenarios.map((s) => s.id)).toEqual(
				set.scenarios.map((_, i) => `G-${i + 1}`),
			);
			const checked = checkGolden(set, kb, "f.yaml");
			expect(checked.diagnostics).toEqual([]);
			for (const scenario of set.scenarios) {
				expect(runScenario(kb, scenario).status).toBe("passed");
			}
		}
	});
});
