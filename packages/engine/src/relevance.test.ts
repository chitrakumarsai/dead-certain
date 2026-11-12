import { describe, expect, it } from "vitest";
import { parse } from "./lang/parse";
import { findRelevant } from "./relevance";
import { Resolver } from "./resolve";
import type { Expr, FactValue, KnowledgeBase, Rule } from "./types";

function expr(src: string): Expr {
	const r = parse(src);
	if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
	return r.expr;
}

function rule(
	id: string,
	set: string,
	to: string,
	when?: string,
	cite = `c-${id}`,
): Rule {
	return {
		id,
		cite,
		set,
		to: expr(to),
		...(when === undefined ? {} : { when: expr(when) }),
		because: "because",
	};
}

function kb(rules: Rule[], goals: string[]): KnowledgeBase {
	return {
		id: "rel-kb",
		goals,
		facts: {
			a: { type: "boolean", ask: "A?" },
			b: { type: "boolean", ask: "B?" },
			c: { type: "boolean", ask: "C?" },
			n: { type: "number", ask: "N?" },
			hidden: { type: "number" },
			d: { type: "number", derived: true },
			e: { type: "number", derived: true },
			out: { type: "number", derived: true },
		},
		rules,
		clauses: {},
	};
}

function run(
	rules: Rule[],
	answers: Record<string, FactValue> = {},
	goals = ["out"],
) {
	const k = kb(rules, goals);
	return findRelevant(new Resolver(k, answers), k, goals);
}

describe("findRelevant", () => {
	it("walks guard operands before to operands, left to right", () => {
		const res = run([rule("r1", "out", "n", "a and b")]);
		expect(res.map((x) => x.fact)).toEqual(["a", "b", "n"]);
	});

	it("does not descend into settled sub-expressions", () => {
		expect(run([rule("r1", "out", "1", "a and b")], { a: false })).toEqual([]);
		expect(
			run([rule("r1", "out", "1", "b or a")], { b: true }).map((x) => x.fact),
		).toEqual([]);
		expect(
			run([rule("r1", "out", "1", "a and b")], { b: false }).map((x) => x.fact),
		).toEqual([]);
	});

	it("visits only the selected branch of if", () => {
		const rules = [rule("r1", "out", "if(a, n, 2)")];
		expect(run(rules, { a: true }).map((x) => x.fact)).toEqual(["n"]);
		expect(run(rules, { a: false }).map((x) => x.fact)).toEqual([]);
		expect(run(rules).map((x) => x.fact)).toEqual(["a"]);
	});

	it("reports each fact once with the cite of the first rule reaching it", () => {
		const rules = [
			rule("r1", "d", "n", undefined, "first"),
			rule("r2", "out", "d + n", undefined, "second"),
		];
		expect(run(rules)).toEqual([{ fact: "n", clause: "first" }]);
	});

	it("omits the clause for a goal that is itself askable", () => {
		const k = { ...kb([], ["n"]) };
		const res = findRelevant(new Resolver(k, {}), k, ["n"]);
		expect(res).toEqual([{ fact: "n", clause: undefined }]);
	});

	it("skips rules with a false guard and later rules after the first live one", () => {
		const rules = [
			rule("r1", "out", "1", "a"),
			rule("r2", "out", "n", "b"),
			rule("r3", "out", "hidden"),
		];
		expect(run(rules, { a: false }).map((x) => x.fact)).toEqual(["b", "n"]);
	});

	it("ignores facts without ask, answered facts and undeclared names", () => {
		const rules = [rule("r1", "out", "hidden + n + ghost")];
		expect(run(rules, { n: 1 })).toEqual([]);
	});

	it("does not loop on a diamond of derived facts", () => {
		const rules = [
			rule("r1", "d", "n"),
			rule("r2", "e", "d + 1"),
			rule("r3", "out", "d + e"),
		];
		expect(run(rules).map((x) => x.fact)).toEqual(["n"]);
	});
});
