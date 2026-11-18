import { describe, expect, it } from "vitest";
import { config } from "./config";
import { clauseFor, formatFor, labelFor, ruleExpression } from "./kb";
import { isKnowledgeBase } from "./kbShape";
import { realKb } from "./testing/realKb";

describe("the knowledge-base guard", () => {
	it("accepts the real compiled knowledge base", () => {
		expect(isKnowledgeBase(realKb())).toBe(true);
	});

	it("rejects an object with no goals", () => {
		const { goals: _, ...noGoals } = realKb();
		expect(isKnowledgeBase(noGoals)).toBe(false);
	});

	it("rejects non-objects and a fact with an unknown type", () => {
		expect(isKnowledgeBase(null)).toBe(false);
		expect(isKnowledgeBase([])).toBe(false);
		const kb = realKb();
		const bad = { ...kb, facts: { ...kb.facts, x: { type: "text" } } };
		expect(isKnowledgeBase(bad)).toBe(false);
	});
});

describe("the knowledge-base helpers", () => {
	const kb = realKb();

	it("finds every name config.ts relies on", () => {
		expect(kb.goals).toEqual(
			expect.arrayContaining([config.amountGoal, config.stateGoal]),
		);
		expect(kb.facts[config.stateGoal]?.options).toEqual([
			"paid",
			"reduced",
			"denied",
		]);
		expect(kb.facts[config.claimedFact]?.type).toBe("money");
	});

	it("labels a fact from the knowledge base and falls back to humanize", () => {
		expect(labelFor(kb, config.amountGoal)).toBe("Amount payable");
		expect(labelFor(kb, "no_such_fact")).toBe("No such fact");
	});

	it("reads clauses, the currency and rule expressions", () => {
		expect(clauseFor(kb, "4.2")?.id).toBe("4.2");
		expect(clauseFor(kb, "99.9")).toBeUndefined();
		expect(formatFor(kb)).toEqual({ currency: "INR" });
		const withWhen = kb.rules.find((r) => r.when !== undefined);
		expect(withWhen && ruleExpression(kb, withWhen.id)).toContain(" when ");
		expect(ruleExpression(kb, "NO-SUCH-RULE")).toBe("");
	});
});
