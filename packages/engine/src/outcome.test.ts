import { describe, expect, it } from "vitest";
import { parse } from "./lang/parse";
import { buildQuestion, buildVerdict, evaluateSession } from "./outcome";
import type { Expr, FactValue, KnowledgeBase, Rule } from "./types";

function expr(src: string): Expr {
	const r = parse(src);
	if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
	return r.expr;
}

function rule(id: string, set: string, to: string, when?: string): Rule {
	return {
		id,
		cite: `c-${id}`,
		set,
		to: expr(to),
		...(when === undefined ? {} : { when: expr(when) }),
		because: "because",
	};
}

const kb: KnowledgeBase = {
	id: "outcome-kb",
	goals: ["payable"],
	facts: {
		covered: { type: "boolean", ask: "Covered?", why: "Policy scope" },
		bill: { type: "money", ask: "Bill?" },
		payable: { type: "money", derived: true },
		copay: { type: "money", derived: true, role: "deduction" },
		waived: {
			type: "money",
			derived: true,
			role: "deduction",
			label: "Waiver",
		},
		orphan: { type: "money", derived: true, role: "check" },
	},
	rules: [
		rule("r-copay", "copay", "round(bill / 10)", "covered"),
		rule("r-waived", "waived", "1", "not covered"),
		rule("r-pay", "payable", "bill - copay"),
	],
	clauses: {},
};

function verdict(answers: Record<string, FactValue>) {
	return buildVerdict(kb, evaluateSession(kb, answers));
}

describe("buildQuestion", () => {
	it("omits why and clause when absent and keeps key order", () => {
		const q = buildQuestion(kb, { fact: "bill", clause: undefined });
		expect(Object.keys(q)).toEqual(["kind", "fact", "text"]);
		const q2 = buildQuestion(kb, { fact: "covered", clause: "c-r-copay" });
		expect(Object.keys(q2)).toEqual(["kind", "fact", "text", "why", "clause"]);
		expect(q2.text).toBe("Covered?");
	});
});

describe("buildVerdict", () => {
	it("lists needed questions and undefined goals while undecided", () => {
		const v = verdict({});
		expect(Object.keys(v.goals)).toEqual(["payable"]);
		expect(v.goals.payable).toBeUndefined();
		expect(v.needed.map((q) => q.fact)).toEqual(["bill", "covered"]);
	});

	it("keeps needed empty and fills goals once decided", () => {
		const v = verdict({ covered: true, bill: 1000 });
		expect(v.goals.payable).toBe(900);
		expect(v.needed).toEqual([]);
		expect(v.lineItems.find((i) => i.fact === "copay")).toEqual({
			fact: "copay",
			role: "deduction",
			label: "Copay",
			value: 100,
			rule: "r-copay",
			clause: "c-r-copay",
		});
	});

	it("handles inapplicable, unknown and rule-less line items in facts order", () => {
		const v = verdict({ covered: true, bill: 1000 });
		expect(v.lineItems.map((i) => i.fact)).toEqual([
			"copay",
			"waived",
			"orphan",
		]);
		const waived = v.lineItems[1];
		expect(waived).toEqual({
			fact: "waived",
			role: "deduction",
			label: "Waiver",
			value: undefined,
			rule: "",
			clause: "",
		});
		expect(v.lineItems[2]).toMatchObject({
			value: undefined,
			rule: "",
			clause: "",
		});
	});

	it("uses the first rule not ruled out while a line item is unknown", () => {
		const v = verdict({});
		expect(v.lineItems[0]).toMatchObject({
			value: undefined,
			rule: "r-copay",
			clause: "c-r-copay",
		});
	});

	it("is not decided-by-default for a goal with no rules (inapplicable)", () => {
		const k: KnowledgeBase = {
			...kb,
			goals: ["orphan"],
		};
		const v = buildVerdict(k, evaluateSession(k, {}));
		expect(v.goals).toHaveProperty("orphan", undefined);
		expect(v.needed).toEqual([]);
	});
});
