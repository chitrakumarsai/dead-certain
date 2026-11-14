import { describe, expect, it, vi } from "vitest";
import { EngineError } from "./errors";
import * as evaluateModule from "./lang/evaluate";
import { parse } from "./lang/parse";
import { Resolver } from "./resolve";
import type { Expr, FactValue, KnowledgeBase, Rule } from "./types";
import { UNKNOWN } from "./types";

vi.mock("./lang/evaluate", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./lang/evaluate")>();
	return { ...actual, evaluate: vi.fn(actual.evaluate) };
});

function expr(src: string): Expr {
	const r = parse(src);
	if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
	return r.expr;
}

function rule(id: string, to: string, when?: string, set = "out"): Rule {
	return {
		id,
		cite: "c1",
		set,
		to: expr(to),
		...(when === undefined ? {} : { when: expr(when) }),
		because: "because",
	};
}

function kb(rules: Rule[]): KnowledgeBase {
	return {
		id: "resolve-kb",
		goals: ["out"],
		facts: {
			a: { type: "boolean", ask: "A?" },
			b: { type: "boolean", ask: "B?" },
			n: { type: "number", ask: "N?" },
			out: { type: "number", derived: true },
		},
		rules,
		clauses: { c1: { id: "c1", title: "Clause", text: "Text" } },
	};
}

function resolver(rules: Rule[], answers: Record<string, FactValue> = {}) {
	return new Resolver(kb(rules), answers);
}

function callsFor(e: Expr): number {
	return vi.mocked(evaluateModule.evaluate).mock.calls.filter((c) => c[0] === e)
		.length;
}

describe("Resolver guards (Kleene)", () => {
	it("false and Unknown is false", () => {
		const r = resolver([], { a: false });
		expect(r.guard(rule("g", "1", "a and b"))).toBe(false);
	});

	it("true or Unknown is true", () => {
		const r = resolver([], { a: true });
		expect(r.guard(rule("g", "1", "a or b"))).toBe(true);
	});

	it("true and Unknown is Unknown", () => {
		const r = resolver([], { a: true });
		expect(r.guard(rule("g", "1", "a and b"))).toBe(UNKNOWN);
	});

	it("a rule without `when` has a true guard", () => {
		expect(resolver([]).guard(rule("g", "1"))).toBe(true);
	});
});

describe("Resolver fact resolution", () => {
	it("the first rule with a true guard wins", () => {
		const res = resolver([rule("r1", "1", "a"), rule("r2", "2", "a")], {
			a: true,
		}).fact("out");
		expect(res.status).toBe("known");
		expect(res.value).toBe(1);
		expect(res.deciding?.id).toBe("r1");
		expect(res.tried.map((t) => t.id)).toEqual(["r1"]);
	});

	it("falls through false guards to a later rule", () => {
		const res = resolver([rule("r1", "1", "a"), rule("r2", "2", "b")], {
			a: false,
			b: true,
		}).fact("out");
		expect(res.value).toBe(2);
		expect(res.deciding?.id).toBe("r2");
		expect(res.tried.map((t) => t.id)).toEqual(["r1", "r2"]);
	});

	it("an Unknown guard stops later rules", () => {
		const res = resolver([rule("r1", "1", "a"), rule("r2", "2")], {}).fact(
			"out",
		);
		expect(res.status).toBe("unknown");
		expect(res.deciding).toBeUndefined();
		expect(res.tried.map((t) => t.id)).toEqual(["r1"]);
	});

	it("a deciding rule with an Unknown `to` is unknown and keeps the deciding rule", () => {
		const res = resolver([rule("r1", "n + 1", "a"), rule("r2", "2")], {
			a: true,
		}).fact("out");
		expect(res.status).toBe("unknown");
		expect(res.value).toBe(UNKNOWN);
		expect(res.deciding?.id).toBe("r1");
	});

	it("all guards false gives inapplicable", () => {
		const res = resolver([rule("r1", "1", "a"), rule("r2", "2", "b")], {
			a: false,
			b: false,
		}).fact("out");
		expect(res.status).toBe("inapplicable");
		expect(res.value).toBe(UNKNOWN);
		expect(res.deciding).toBeUndefined();
		expect(res.tried).toHaveLength(2);
	});

	it("an undeclared fact resolves as unknown with no rules", () => {
		const res = resolver([]).fact("nope");
		expect(res.status).toBe("unknown");
		expect(res.tried).toEqual([]);
	});

	it("tracks which facts were read", () => {
		const r = resolver([rule("r1", "1", "a")], { a: true });
		r.fact("out");
		expect(r.wasRead("a")).toBe(true);
		expect(r.wasRead("b")).toBe(false);
	});
});

describe("Resolver errors", () => {
	it("throws EVALUATION_ERROR naming the rule for an evaluated division by zero", () => {
		const r = resolver([rule("r_div", "10 / n")], { n: 0 });
		try {
			r.fact("out");
			expect.unreachable("should throw");
		} catch (e) {
			expect(e).toBeInstanceOf(EngineError);
			expect((e as EngineError).code).toBe("EVALUATION_ERROR");
			expect((e as EngineError).message).toContain("r_div");
			expect((e as EngineError).message).toContain("DIVISION_BY_ZERO");
		}
	});

	it("does not throw for a division that is Unknown", () => {
		expect(resolver([rule("r_div", "10 / n")]).fact("out").status).toBe(
			"unknown",
		);
	});
});

describe("Resolver evaluation counts", () => {
	it("evaluates each guard and each `to` at most once", () => {
		vi.mocked(evaluateModule.evaluate).mockClear();
		const r1 = rule("r1", "n + 1", "a and b");
		const r2 = rule("r2", "n + 2", "a");
		const res = resolver([r1, r2], { a: true, b: true, n: 1 });
		res.fact("out");
		res.fact("out");
		res.guard(r1);
		res.expr(r1.to, r1.id);
		expect(callsFor(r1.when as Expr)).toBe(1);
		expect(callsFor(r1.to)).toBe(1);
		expect(callsFor(r2.when as Expr)).toBe(0);
		expect(callsFor(r2.to)).toBe(0);
		res.guard(r2);
		res.guard(r2);
		expect(callsFor(r2.when as Expr)).toBe(1);
	});

	it("evaluates a skipped rule's guard once and never its `to`", () => {
		vi.mocked(evaluateModule.evaluate).mockClear();
		const r1 = rule("r1", "n + 1", "a");
		const r2 = rule("r2", "n + 2", "b");
		const res = resolver([r1, r2], { a: false, b: true, n: 1 });
		res.fact("out");
		res.fact("out");
		expect(callsFor(r1.when as Expr)).toBe(1);
		expect(callsFor(r1.to)).toBe(0);
		expect(callsFor(r2.when as Expr)).toBe(1);
		expect(callsFor(r2.to)).toBe(1);
	});
});
