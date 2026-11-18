import { describe, expect, it } from "vitest";
import { fixtureKb } from "../testkit/goldenFixture";
import { checkGolden, duplicateIds } from "./check";
import type { Expectation, GoldenSet, Scenario } from "./model";

const FILE = "apps/fixture/golden/main.yaml";
const kb = fixtureKb();

const GOALS = { payable_amount: 100, verdict: "paid" } as const;

function scenario(over: Partial<Scenario> & { id?: string } = {}): Scenario {
	return {
		id: "G-01",
		title: "t",
		mode: "audit",
		facts: { claimed: 100 },
		expect: { goals: GOALS },
		...over,
	};
}
const set = (...scenarios: Scenario[]): GoldenSet => ({
	kb: "fixture",
	scenarios,
});

/** [code, id, field, message] of every diagnostic for one scenario. */
function check(over: Partial<Scenario> = {}) {
	const { diagnostics, runnable } = checkGolden(set(scenario(over)), kb, FILE);
	return {
		runnable,
		found: diagnostics.map((d) => [d.code, d.id, d.field, d.message]),
	};
}

describe("checkGolden", () => {
	it("accepts a scenario that fits and returns it as runnable", () => {
		const { runnable, found } = check({
			expect: {
				goals: GOALS,
				lineItems: { room_rent_deduction: 0, in_waiting_period: false },
				needed: ["age"],
				fires: ["PAY-02"],
			},
		});

		expect(found).toEqual([]);
		expect(runnable).toHaveLength(1);
	});

	it("accepts null for an unknown goal and an unknown line item", () => {
		expect(
			check({
				expect: {
					goals: { payable_amount: null, verdict: null },
					lineItems: { copay_deduction: null },
				},
			}).found,
		).toEqual([]);
	});

	it("accepts an ask expectation for an askable fact", () => {
		expect(
			check({ mode: "consult", expect: { ask: "claimed" } }).found,
		).toEqual([]);
	});

	describe("facts", () => {
		it("UNKNOWN_FACT for a name that is not a fact", () => {
			expect(check({ facts: { nope: 1 } }).found).toEqual([
				[
					"UNKNOWN_FACT",
					"G-01",
					"facts",
					"Fact 'nope' is not in the knowledge base 'fixture'.",
				],
			]);
		});

		it("does not take an inherited name such as constructor for a fact", () => {
			expect(check({ facts: { constructor: 1 } }).found[0]?.[0]).toBe(
				"UNKNOWN_FACT",
			);
		});

		it("NOT_ASKABLE for a derived fact", () => {
			expect(check({ facts: { rent_cap: 5 } }).found).toEqual([
				[
					"NOT_ASKABLE",
					"G-01",
					"facts",
					"Fact 'rent_cap' is worked out by rules, so a scenario cannot give it. Give the facts it depends on.",
				],
			]);
		});

		it.each([
			["claimed", "100", "a whole number of minor units", 10.5],
			["age", "old", "a number", "old"],
			["tier", "bronze", "one of gold, silver", "bronze"],
			["policy_start", "2023-02-29", "a date written YYYY-MM-DD", "2023-02-29"],
		])("BAD_VALUE for %s", (name, _label, phrase, value) => {
			expect(check({ facts: { [name]: value } }).found).toEqual([
				[
					"BAD_VALUE",
					"G-01",
					"facts",
					`Value ${value} for fact '${name}' is not ${phrase}.`,
				],
			]);
		});

		it("BAD_VALUE for a null in facts", () => {
			expect(check({ facts: { claimed: null } }).found).toEqual([
				[
					"BAD_VALUE",
					"G-01",
					"facts",
					"Value null for fact 'claimed' is not allowed in facts; null means unknown only in expect.",
				],
			]);
		});
	});

	describe("expect.goals", () => {
		it("SCHEMA_INVALID when a goal is missing", () => {
			expect(check({ expect: { goals: { verdict: "paid" } } }).found).toEqual([
				[
					"SCHEMA_INVALID",
					"G-01",
					"expect.goals",
					"expect.goals must list exactly the goals of the knowledge base. Missing: payable_amount.",
				],
			]);
		});

		it("SCHEMA_INVALID naming the missing and the extra goals, once", () => {
			expect(
				check({ expect: { goals: { verdict: "paid", claimed: 1 } } }).found,
			).toEqual([
				[
					"SCHEMA_INVALID",
					"G-01",
					"expect.goals",
					"expect.goals must list exactly the goals of the knowledge base. Missing: payable_amount. Not a goal: claimed.",
				],
			]);
		});

		it("UNKNOWN_FACT for a name that is no fact, and no second diagnostic for it", () => {
			expect(
				check({ expect: { goals: { ...GOALS, ghost: 1 } } }).found,
			).toEqual([
				[
					"UNKNOWN_FACT",
					"G-01",
					"expect.goals",
					"Fact 'ghost' is not in the knowledge base 'fixture'.",
				],
			]);
		});

		it("BAD_VALUE for a goal of the wrong type", () => {
			expect(
				check({ expect: { goals: { payable_amount: 1.5, verdict: "paid" } } })
					.found,
			).toEqual([
				[
					"BAD_VALUE",
					"G-01",
					"expect.goals",
					"Value 1.5 for fact 'payable_amount' is not a whole number of minor units.",
				],
			]);
			expect(
				check({ expect: { goals: { payable_amount: 1, verdict: "late" } } })
					.found[0]?.[3],
			).toBe(
				"Value late for fact 'verdict' is not one of paid, reduced, denied.",
			);
		});
	});

	describe("expect.line_items", () => {
		const items = (lineItems: Record<string, number | boolean | null>) =>
			({ goals: GOALS, lineItems }) satisfies Expectation;

		it("UNKNOWN_FACT for a name that is no fact", () => {
			expect(check({ expect: items({ ghost: 1 }) }).found).toEqual([
				[
					"UNKNOWN_FACT",
					"G-01",
					"expect.line_items",
					"Fact 'ghost' is not in the knowledge base 'fixture'.",
				],
			]);
		});

		it("UNKNOWN_FACT for a fact that has no role", () => {
			expect(check({ expect: items({ rent_cap: 1 }) }).found).toEqual([
				[
					"UNKNOWN_FACT",
					"G-01",
					"expect.line_items",
					"Fact 'rent_cap' is not a line item of the knowledge base 'fixture': it has no role.",
				],
			]);
		});

		it("BAD_VALUE for a value of the wrong type", () => {
			expect(check({ expect: items({ in_waiting_period: 1 }) }).found).toEqual([
				[
					"BAD_VALUE",
					"G-01",
					"expect.line_items",
					"Value 1 for fact 'in_waiting_period' is not a boolean.",
				],
			]);
		});
	});

	describe("ask, needed and fires", () => {
		it("UNKNOWN_FACT and NOT_ASKABLE for ask", () => {
			expect(
				check({ mode: "consult", expect: { ask: "ghost" } }).found[0],
			).toEqual([
				"UNKNOWN_FACT",
				"G-01",
				"expect.ask",
				"Fact 'ghost' is not in the knowledge base 'fixture'.",
			]);
			expect(
				check({ mode: "consult", expect: { ask: "rent_cap" } }).found[0],
			).toEqual([
				"NOT_ASKABLE",
				"G-01",
				"expect.ask",
				"Fact 'rent_cap' is worked out by rules, so a scenario cannot give it. Give the facts it depends on.",
			]);
		});

		it("UNKNOWN_FACT and NOT_ASKABLE for each name in needed", () => {
			const { found } = check({
				expect: { goals: GOALS, needed: ["ghost", "rent_cap", "age"] },
			});

			expect(found.map((d) => [d[0], d[2]])).toEqual([
				["UNKNOWN_FACT", "expect.needed"],
				["NOT_ASKABLE", "expect.needed"],
			]);
		});

		it("UNKNOWN_RULE for a rule id that is not a rule", () => {
			expect(
				check({ expect: { goals: GOALS, fires: ["PAY-02", "R-9"] } }).found,
			).toEqual([
				[
					"UNKNOWN_RULE",
					"G-01",
					"expect.fires",
					"Rule 'R-9' is not in the knowledge base.",
				],
			]);
		});
	});

	it("reports two errors of one scenario as two diagnostics and still runs the other scenario", () => {
		const { diagnostics, runnable } = checkGolden(
			set(
				scenario({ id: "bad", facts: { ghost: 1, rent_cap: 2 } }),
				scenario({ id: "good" }),
			),
			kb,
			FILE,
		);

		expect(diagnostics.map((d) => [d.id, d.code])).toEqual([
			["bad", "UNKNOWN_FACT"],
			["bad", "NOT_ASKABLE"],
		]);
		expect(runnable.map((s) => s.id)).toEqual(["good"]);
	});

	it("never throws on a bigint, a cycle or a symbol where a value belongs", () => {
		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		const result = checkGolden(
			set(
				scenario({
					facts: {
						claimed: 0n as never,
						age: cycle as never,
						tier: Symbol("s") as never,
					},
				}),
			),
			kb,
			FILE,
		);

		expect(result.diagnostics.map((d) => d.code)).toEqual([
			"BAD_VALUE",
			"BAD_VALUE",
			"BAD_VALUE",
		]);
		expect(result.diagnostics[0]?.message).toBe(
			"Value 0n for fact 'claimed' is not a whole number of minor units.",
		);
	});
});

describe("duplicateIds", () => {
	const a = scenario({ id: "G-01" });
	const b = scenario({ id: "G-02" });
	const c = scenario({ id: "G-01" });
	const d = scenario({ id: "G-01" });

	it("finds no duplicate among distinct ids", () => {
		const result = duplicateIds([{ file: "a.yaml", set: set(a, b) }]);

		expect(result.diagnostics).toEqual([]);
		expect(result.drop.size).toBe(0);
	});

	it("reports a later use in the same file, naming the earlier position", () => {
		const result = duplicateIds([{ file: "a.yaml", set: set(a, b, c) }]);

		expect(result.diagnostics).toEqual([
			{
				severity: "error",
				code: "DUPLICATE_SCENARIO",
				file: "a.yaml",
				message: "Scenario id 'G-01' is already used by scenario 1 of a.yaml.",
				id: "G-01",
				field: "id",
			},
		]);
		expect([...result.drop]).toEqual([c]);
	});

	it("reports a use in a second file, and every later use of a triple", () => {
		const result = duplicateIds([
			{ file: "a.yaml", set: set(a, b) },
			{ file: "b.yaml", set: set(c, d) },
		]);

		expect(result.diagnostics.map((x) => [x.file, x.message])).toEqual([
			["b.yaml", "Scenario id 'G-01' is already used by scenario 1 of a.yaml."],
			["b.yaml", "Scenario id 'G-01' is already used by scenario 1 of a.yaml."],
		]);
		expect([...result.drop]).toEqual([c, d]);
	});
});
