import { describe, expect, it } from "vitest";
import { fixtureKb } from "../testkit/goldenFixture";
import type { Scenario } from "./model";
import { runScenario } from "./run";

const kb = fixtureKb();

const FULL = {
	claimed: 21000000,
	sum_insured: 500000,
	room_rent_per_day: 600000,
	age: 65,
	tier: "gold",
	policy_start: "2024-01-01",
	admission_date: "2024-06-01",
} as const;

const REDUCED = { payable_amount: 17293500, verdict: "reduced" } as const;

function scenario(over: Partial<Scenario> = {}): Scenario {
	return {
		id: "G-01",
		title: "t",
		mode: "consult",
		facts: FULL,
		expect: { goals: REDUCED },
		...over,
	};
}

describe("runScenario: passing", () => {
	it("passes a consult scenario and records the rules that fired, in rule order", () => {
		const result = runScenario(kb, scenario());

		expect(result).toEqual({
			id: "G-01",
			status: "passed",
			fired: ["CAP-01", "ROOM-01", "COPAY-01", "WAIT-01", "PAY-02", "VER-02"],
			differences: [],
		});
	});

	it("passes line items, fires and the empty needed list", () => {
		const result = runScenario(
			kb,
			scenario({
				expect: {
					goals: REDUCED,
					lineItems: {
						room_rent_deduction: 1785000,
						copay_deduction: 1921500,
						in_waiting_period: false,
					},
					needed: [],
					fires: ["ROOM-01", "VER-02"],
				},
			}),
		);

		expect(result.status).toBe("passed");
	});

	it("passes an audit scenario with unknown goals and the questions still needed", () => {
		const result = runScenario(
			kb,
			scenario({
				mode: "audit",
				facts: { claimed: 100 },
				expect: {
					goals: { payable_amount: null, verdict: null },
					lineItems: {
						room_rent_deduction: null,
						copay_deduction: null,
						in_waiting_period: null,
					},
					needed: ["policy_start", "admission_date"],
				},
			}),
		);

		expect(result.status).toBe("passed");
		expect(result.differences).toEqual([]);
	});

	it("passes a decided audit scenario", () => {
		const result = runScenario(
			kb,
			scenario({
				mode: "audit",
				facts: {
					claimed: 100,
					sum_insured: 500000,
					room_rent_per_day: 1000,
					age: 30,
					policy_start: "2024-01-01",
					admission_date: "2024-06-01",
				},
				expect: { goals: { payable_amount: 100, verdict: "paid" } },
			}),
		);

		expect(result.status).toBe("passed");
		expect(result.fired).toContain("ROOM-02");
	});

	it("passes a consult scenario that stops at the question the knowledge base asks", () => {
		const result = runScenario(
			kb,
			scenario({
				facts: { claimed: 100 },
				expect: { ask: "policy_start" },
			}),
		);

		expect(result).toEqual({
			id: "G-01",
			status: "passed",
			fired: [],
			differences: [],
		});
	});

	it("takes -0 and 0 as the same value", () => {
		const result = runScenario(
			kb,
			scenario({
				facts: { ...FULL, claimed: 0, room_rent_per_day: 0 },
				expect: { goals: { payable_amount: -0, verdict: "paid" } },
			}),
		);

		expect(result.status).toBe("passed");
	});
});

describe("runScenario: each kind of difference", () => {
	const diff = (over: Partial<Scenario>) => runScenario(kb, scenario(over));

	it("a wrong goal, with expected and observed", () => {
		const result = diff({
			expect: { goals: { payable_amount: 1, verdict: "reduced" } },
		});

		expect(result.status).toBe("failed");
		expect(result.differences).toEqual([
			{ field: "goals.payable_amount", expected: "1", observed: "17293500" },
		]);
	});

	it("an unknown goal where a value was expected, and the reverse", () => {
		const unknown = runScenario(
			kb,
			scenario({
				mode: "audit",
				facts: { claimed: 100 },
				expect: {
					goals: { payable_amount: 5, verdict: null },
					needed: ["policy_start", "admission_date"],
				},
			}),
		);
		expect(unknown.differences).toEqual([
			{ field: "goals.payable_amount", expected: "5", observed: "unknown" },
		]);

		const known = diff({
			expect: { goals: { payable_amount: null, verdict: "reduced" } },
		});
		expect(known.differences).toEqual([
			{
				field: "goals.payable_amount",
				expected: "unknown",
				observed: "17293500",
			},
		]);
	});

	it("a verdict where a question was expected", () => {
		expect(diff({ expect: { ask: "age" } }).differences).toEqual([
			{
				field: "outcome",
				expected: "a question for 'age'",
				observed: "a verdict",
			},
		]);
	});

	it("a question where a verdict was expected", () => {
		const result = diff({
			facts: { claimed: 100 },
			expect: { goals: REDUCED },
		});

		expect(result.differences).toEqual([
			{
				field: "outcome",
				expected: "a verdict",
				observed: "a question for 'policy_start'",
			},
		]);
	});

	it("a different question than the one expected", () => {
		expect(
			diff({ facts: { claimed: 100 }, expect: { ask: "age" } }).differences,
		).toEqual([{ field: "ask", expected: "age", observed: "policy_start" }]);
	});

	it("a wrong line-item value, a missing line item and an extra one", () => {
		const result = diff({
			expect: {
				goals: REDUCED,
				lineItems: {
					room_rent_deduction: 1,
					copay_deduction: 1921500,
					ghost: 7,
				},
			},
		});

		expect(result.differences).toEqual([
			{
				field: "line_items.room_rent_deduction",
				expected: "1",
				observed: "1785000",
			},
			{
				field: "line_items.in_waiting_period",
				expected: "no such line item",
				observed: "false",
			},
			{
				field: "line_items.ghost",
				expected: "7",
				observed: "no such line item",
			},
		]);
	});

	it("needed in the wrong order, and needed left out when questions remain", () => {
		const order = runScenario(
			kb,
			scenario({
				mode: "audit",
				facts: { claimed: 100 },
				expect: {
					goals: { payable_amount: null, verdict: null },
					needed: ["admission_date", "policy_start"],
				},
			}),
		);
		expect(order.differences).toEqual([
			{
				field: "needed",
				expected: "admission_date, policy_start",
				observed: "policy_start, admission_date",
			},
		]);

		const left = runScenario(
			kb,
			scenario({
				mode: "audit",
				facts: { claimed: 100 },
				expect: { goals: { payable_amount: null, verdict: null } },
			}),
		);
		expect(left.differences).toEqual([
			{
				field: "needed",
				expected: "none",
				observed: "policy_start, admission_date",
			},
		]);
	});

	it("a rule that did not fire", () => {
		const result = diff({
			expect: { goals: REDUCED, fires: ["ROOM-01", "VER-01"] },
		});

		expect(result.status).toBe("failed");
		expect(result.differences).toEqual([
			{
				field: "fires",
				expected: "ROOM-01, VER-01",
				observed: "CAP-01, ROOM-01, COPAY-01, WAIT-01, PAY-02, VER-02",
			},
		]);
	});

	it("lists several differences in the fixed order: goals, line items, needed, fires", () => {
		const result = diff({
			expect: {
				goals: { payable_amount: 1, verdict: "paid" },
				lineItems: { room_rent_deduction: 2 },
				fires: ["VER-03"],
			},
		});

		expect(result.differences.map((d) => d.field)).toEqual([
			"goals.payable_amount",
			"goals.verdict",
			"line_items.room_rent_deduction",
			"line_items.copay_deduction",
			"line_items.in_waiting_period",
			"fires",
		]);
	});
});

describe("runScenario: engine errors", () => {
	it("returns an error result with the engine's code and message, and does not throw", () => {
		const result = runScenario(
			kb,
			scenario({ facts: { age: "old" as never } }),
		);

		expect(result.status).toBe("error");
		expect(result.engineError?.code).toBe("INVALID_ANSWER");
		expect(result.engineError?.message).toContain("age");
		expect(result.fired).toEqual([]);
		expect(result.differences).toEqual([]);
	});

	it("reports a null fact as an engine error, not a throw", () => {
		const result = runScenario(kb, scenario({ facts: { claimed: null } }));

		expect(result.status).toBe("error");
		expect(result.engineError?.code).toBe("INVALID_ANSWER");
	});
});
