import { describe, expect, it } from "vitest";
import { config } from "./config";
import { clauseFor, formatFor, labelFor, ruleExpression } from "./kb";
import { isKnowledgeBase } from "./kbShape";
import { realKb } from "./testing/realKb";

const kb = realKb();

describe("the knowledge-base guard", () => {
	it("accepts the real compiled knowledge base", () => {
		expect(isKnowledgeBase(kb, config.verdictGoal)).toBe(true);
	});

	it("rejects a knowledge base whose goals do not include the verdict goal", () => {
		expect(isKnowledgeBase(kb, "no_such_goal")).toBe(false);
		const { goals: _, ...noGoals } = kb;
		expect(isKnowledgeBase(noGoals, config.verdictGoal)).toBe(false);
	});

	it("rejects non-objects and a fact with an unknown type", () => {
		expect(isKnowledgeBase(null, config.verdictGoal)).toBe(false);
		expect(isKnowledgeBase([], config.verdictGoal)).toBe(false);
		const bad = { ...kb, facts: { ...kb.facts, x: { type: "text" } } };
		expect(isKnowledgeBase(bad, config.verdictGoal)).toBe(false);
	});
});

describe("the knowledge-base helpers", () => {
	it("labels a fact from the knowledge base and falls back to humanize", () => {
		for (const [fact, def] of Object.entries(kb.facts))
			if (def.label !== undefined) expect(labelFor(kb, fact)).toBe(def.label);
		expect(labelFor(kb, "no_such_fact")).toBe("No such fact");
	});

	it("reads clauses, the currency and rule expressions", () => {
		const id = Object.keys(kb.clauses)[0] ?? "";
		expect(clauseFor(kb, id)?.id).toBe(id);
		expect(clauseFor(kb, "no-such-clause")).toBeUndefined();
		expect(formatFor(kb)).toEqual({ currency: kb.currency });
		const withWhen = kb.rules.find((r) => r.when !== undefined);
		if (withWhen) expect(ruleExpression(kb, withWhen.id)).toContain(" when ");
		expect(ruleExpression(kb, "NO-SUCH-RULE")).toBe("");
	});
});
