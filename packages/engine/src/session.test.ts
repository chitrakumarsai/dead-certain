import { describe, expect, it } from "vitest";
import { answer, audit, next, start } from "./api";
import { parse } from "./lang/parse";
import type {
	Expr,
	FactDef,
	KnowledgeBase,
	Question,
	Rule,
	Verdict,
} from "./types";

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

// A small Claim Check style policy: a covered claim pays the bill less a copay.
const claimKb: KnowledgeBase = {
	id: "mini-claim",
	currency: "USD",
	goals: ["payable"],
	facts: {
		covered: { type: "boolean", ask: "Is the treatment covered?" },
		bill: { type: "money", ask: "What is the bill?" },
		copay: { type: "money", derived: true, role: "deduction" },
		payable: { type: "money", derived: true },
	},
	rules: [
		rule("r-copay", "copay", "round(bill / 10)"),
		rule("r-pay", "payable", "bill - copay", "covered"),
		rule("r-none", "payable", "0", "not covered"),
	],
	clauses: {},
};

describe("start", () => {
	it("returns the same kb reference and a separate answers object per call", () => {
		const a = start(claimKb);
		const b = start(claimKb);
		expect(a.kb).toBe(claimKb);
		expect(b.kb).toBe(claimKb);
		expect(a.answers).toEqual({});
		expect(a.answers).not.toBe(b.answers);
	});
});

describe("answer", () => {
	it("replaces an earlier answer and leaves its input untouched", () => {
		const s0 = start(claimKb);
		const s1 = answer(s0, "bill", 1000);
		const s2 = answer(s1, "bill", 2000);
		expect(s0.answers).toEqual({});
		expect(s1.answers).toEqual({ bill: 1000 });
		expect(s2.answers).toEqual({ bill: 2000 });
		expect(s2).not.toBe(s1);
	});

	it("keeps answers sorted by fact name", () => {
		const s = answer(answer(start(claimKb), "covered", true), "bill", 5);
		expect(Object.keys(s.answers)).toEqual(["bill", "covered"]);
	});

	it("rejects bad facts and values with typed errors", () => {
		const s = start(claimKb);
		expect(() => answer(s, "nope", 1)).toThrow(/not in the knowledge base/);
		expect(() => answer(s, "copay", 1)).toThrow(/derived/);
		expect(() => answer(s, "bill", 1.5)).toThrow(/not a valid money/);
	});

	it("works with __proto__ and constructor as fact names", () => {
		const kb: KnowledgeBase = {
			id: "odd-names",
			goals: ["both"],
			// fromEntries defines `__proto__` as an own property.
			facts: Object.fromEntries([
				["__proto__", { type: "boolean", ask: "Proto?" }],
				["constructor", { type: "boolean", ask: "Ctor?" }],
				["both", { type: "boolean", derived: true }],
			] satisfies [string, FactDef][]),
			rules: [rule("r-both", "both", "constructor")],
			clauses: {},
		};
		let s = start(kb);
		s = answer(s, "__proto__", true);
		s = answer(s, "constructor", false);
		expect(Object.keys(s.answers)).toEqual(["__proto__", "constructor"]);
		expect(Object.getPrototypeOf(s.answers)).toBe(Object.prototype);
		expect(Object.hasOwn(s.answers, "__proto__")).toBe(true);
		const v = next(s) as Verdict;
		expect(v.kind).toBe("verdict");
		expect(v.goals.both).toBe(false);
	});
});

describe("next", () => {
	it("walks a Claim Check style knowledge base to a verdict", () => {
		let s = start(claimKb);
		const asked: string[] = [];
		let out = next(s);
		while (out.kind === "question") {
			const q: Question = out;
			asked.push(q.fact);
			s = answer(s, q.fact, q.fact === "bill" ? 1000 : true);
			out = next(s);
		}
		expect(asked.sort()).toEqual(["bill", "covered"]);
		expect(out.goals.payable).toBe(900);
		expect(out.needed).toEqual([]);
		expect(out.lineItems.map((i) => [i.fact, i.value])).toEqual([
			["copay", 100],
		]);
	});

	it("skips questions that no longer matter", () => {
		// Not covered: payable is 0 whatever the bill is, so bill is never asked.
		const s = answer(start(claimKb), "covered", false);
		const out = next(s);
		expect(out.kind).toBe("verdict");
		if (out.kind === "verdict") expect(out.goals.payable).toBe(0);
	});

	it("asks a question first when nothing is answered", () => {
		const out = next(start(claimKb));
		expect(out.kind).toBe("question");
	});
});

describe("audit", () => {
	it("lists every relevant unanswered fact in needed", () => {
		const v = audit(claimKb, {});
		expect(v.goals.payable).toBeUndefined();
		expect(v.needed.map((q) => q.fact).sort()).toEqual(["bill", "covered"]);
	});

	it("decides the verdict from supplied facts", () => {
		const v = audit(claimKb, { covered: true, bill: 2000 });
		expect(v.goals.payable).toBe(1800);
		expect(v.needed).toEqual([]);
	});

	it("rejects unknown and derived names", () => {
		expect(() => audit(claimKb, { ghost: 1 })).toThrow(/not in the knowledge/);
		expect(() => audit(claimKb, { payable: 1 })).toThrow(/derived/);
	});
});
