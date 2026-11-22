import { describe, expect, it } from "vitest";
import { claimKb } from "../testing/claimKb";
import { CLAIMED_FACT, HERO_FACTS, STATE_GOAL } from "./config";
import { heroModel } from "./model";

const kb = claimKb();

describe("heroModel", () => {
	it("gives the G-01 verdict: statement, state and four deduction rows", () => {
		const model = heroModel(kb);
		if ("kind" in model) throw new Error(model.reason);
		expect(model.statement).toBe("₹1,32,000 of ₹2,10,000 will be paid");
		expect(model.state).toBe("reduced");
		expect(model.ledger.items).toHaveLength(4);
		expect(model.ledger.items.every((i) => i.value !== 0)).toBe(true);
		expect(model.parts[0]).toEqual({
			kind: "paid",
			value: 13_200_000,
			label: "Paid",
		});
		expect(model.answers).toHaveLength(Object.keys(HERO_FACTS).length);
	});

	it("gives engine_error when a fact it names is gone from the knowledge base", () => {
		const { [CLAIMED_FACT]: _, ...facts } = kb.facts;
		expect(heroModel({ ...kb, facts })).toEqual({
			kind: "failed",
			reason: "engine_error",
		});
	});

	it("gives kb_mismatch when the state goal no longer decides", () => {
		const goals = kb.goals.filter((g) => g !== STATE_GOAL);
		const rules = kb.rules.filter((r) => r.set !== STATE_GOAL);
		expect(heroModel({ ...kb, goals, rules })).toEqual({
			kind: "failed",
			reason: "kb_mismatch",
		});
	});

	it("gives ledger_mismatch when the deductions do not add up to the bill", () => {
		// A bill smaller than the deductions: payable stops at zero, the rows do not.
		expect(heroModel(kb, { ...HERO_FACTS, [CLAIMED_FACT]: 100 })).toEqual({
			kind: "failed",
			reason: "ledger_mismatch",
		});
	});

	it("computes in under 10 ms (requirement 9.3)", () => {
		heroModel(kb);
		const runs = 50;
		const t0 = performance.now();
		for (let i = 0; i < runs; i++) heroModel(kb);
		const ms = (performance.now() - t0) / runs;
		expect(ms).toBeLessThan(10);
	});
});
