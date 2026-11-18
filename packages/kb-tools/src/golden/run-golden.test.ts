import { describe, expect, it } from "vitest";
import { fixtureKb } from "../testkit/goldenFixture";
import type { Scenario } from "./model";
import { runGolden } from "./run";

const kb = fixtureKb();
const FILE = "apps/fixture/golden/main.yaml";
const FULL = {
	claimed: 21000000,
	sum_insured: 500000,
	room_rent_per_day: 600000,
	age: 65,
	tier: "gold",
	policy_start: "2024-01-01",
	admission_date: "2024-06-01",
} as const;

const scenario = (over: Partial<Scenario> = {}): Scenario => ({
	id: "G-01",
	title: "Room rent over the limit",
	mode: "consult",
	facts: FULL,
	expect: { goals: { payable_amount: 17293500, verdict: "reduced" } },
	...over,
});

describe("runGolden", () => {
	it("adds no diagnostic for a passing scenario", () => {
		const run = runGolden(kb, [scenario()], FILE);

		expect(run.results.map((r) => r.status)).toEqual(["passed"]);
		expect(run.diagnostics).toEqual([]);
	});

	it("writes the failure line with expected and observed for each difference", () => {
		const run = runGolden(
			kb,
			[
				scenario({
					id: "G-03",
					expect: {
						goals: { payable_amount: 14250000, verdict: "reduced" },
						lineItems: { room_rent_deduction: 4000000 },
					},
				}),
			],
			FILE,
		);

		expect(run.diagnostics).toEqual([
			{
				severity: "error",
				code: "SCENARIO_FAILED",
				file: FILE,
				id: "G-03",
				message:
					"Scenario 'G-03' (Room rent over the limit) failed: goals.payable_amount expected 14250000, observed 17293500; line_items.room_rent_deduction expected 4000000, observed 1785000; line_items.copay_deduction expected no such line item, observed 1921500; line_items.in_waiting_period expected no such line item, observed false",
			},
		]);
	});

	it("keeps the differences in the order outcome or ask, goals, line items, needed, fires", () => {
		const run = runGolden(
			kb,
			[
				scenario({
					expect: {
						goals: { payable_amount: 1, verdict: "paid" },
						lineItems: { room_rent_deduction: 2 },
						needed: ["age"],
						fires: ["VER-01"],
					},
				}),
			],
			FILE,
		);
		const fields = (run.results[0]?.differences ?? []).map((d) => d.field);

		expect(fields).toEqual([
			"goals.payable_amount",
			"goals.verdict",
			"line_items.room_rent_deduction",
			"line_items.copay_deduction",
			"line_items.in_waiting_period",
			"needed",
			"fires",
		]);
	});

	it("reports an engine error and carries on with the next scenario", () => {
		const run = runGolden(
			kb,
			[
				scenario({ id: "bad", facts: { age: "old" as never } }),
				scenario({ id: "good" }),
			],
			FILE,
		);

		expect(run.results.map((r) => [r.id, r.status])).toEqual([
			["bad", "error"],
			["good", "passed"],
		]);
		expect(run.diagnostics).toHaveLength(1);
		expect(run.diagnostics[0]).toMatchObject({
			severity: "error",
			code: "ENGINE_ERROR",
			id: "bad",
		});
		expect(run.diagnostics[0]?.message).toMatch(
			/^Scenario 'bad' \(Room rent over the limit\) stopped: the engine threw INVALID_ANSWER: .+\.$/,
		);
	});

	it("reports a question where a verdict was expected as an outcome difference", () => {
		const run = runGolden(kb, [scenario({ facts: { claimed: 100 } })], FILE);

		expect(run.diagnostics[0]?.message).toBe(
			"Scenario 'G-01' (Room rent over the limit) failed: outcome expected a verdict, observed a question for 'policy_start'",
		);
	});

	it("runs each scenario on its own session: the same scenario twice gives the same result", () => {
		const run = runGolden(
			kb,
			[scenario({ id: "a" }), scenario({ id: "b" })],
			FILE,
		);

		expect(run.results[0]?.fired).toEqual(run.results[1]?.fired);
		expect(run.results.map((r) => r.status)).toEqual(["passed", "passed"]);
	});
});
