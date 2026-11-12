import { describe, expect, it } from "vitest";
import {
	checkValue,
	normaliseValue,
	validateAnswers,
	validateKb,
} from "./check";
import { EngineError } from "./errors";
import { factRefs, findCycle } from "./graph";
import type { Expr, FactDef, KnowledgeBase, Rule } from "./types";
import { UNKNOWN } from "./types";

const ref = (name: string): Expr => ({ kind: "fact", name });
const lit = (value: boolean | number): Expr => ({
	kind: "literal",
	type: typeof value === "boolean" ? "boolean" : "number",
	value,
});
const rule = (id: string, set: string, to: Expr, when?: Expr): Rule => ({
	id,
	cite: "c1",
	set,
	to,
	...(when === undefined ? {} : { when }),
	because: "because",
});

function kbOf(
	facts: Record<string, FactDef>,
	rules: Rule[] = [],
	goals: string[] = [],
): KnowledgeBase {
	return { id: "t", goals, facts, rules, clauses: {} };
}

function codeOf(fn: () => unknown): string | undefined {
	try {
		fn();
	} catch (e) {
		if (e instanceof EngineError) return e.code;
		throw e;
	}
	return undefined;
}

function messageOf(fn: () => unknown): string {
	try {
		fn();
	} catch (e) {
		return (e as Error).message;
	}
	return "";
}

describe("factRefs", () => {
	it("lists distinct names in first-reference order, left to right", () => {
		const expr: Expr = {
			kind: "binary",
			op: "+",
			left: {
				kind: "call",
				fn: "min",
				args: [ref("b"), ref("a"), ref("b")],
			},
			right: { kind: "unary", op: "-", operand: ref("c") },
		};
		expect(factRefs(expr)).toEqual(["b", "a", "c"]);
		expect(factRefs(lit(1))).toEqual([]);
	});
});

describe("findCycle", () => {
	it("returns undefined for an acyclic graph", () => {
		const kb = kbOf({ a: { type: "boolean" }, b: { type: "boolean" } }, [
			rule("r1", "b", ref("a")),
		]);
		expect(findCycle(kb)).toBeUndefined();
	});

	it("detects a self-cycle", () => {
		const kb = kbOf({ a: { type: "boolean", derived: true } }, [
			rule("r1", "a", ref("a")),
		]);
		expect(findCycle(kb)).toEqual(["a"]);
	});

	it("detects a self-cycle through a guard", () => {
		const kb = kbOf({ a: { type: "boolean", derived: true } }, [
			rule("r1", "a", lit(true), ref("a")),
		]);
		expect(findCycle(kb)).toEqual(["a"]);
	});

	it("finds a cycle through two derived facts and names both", () => {
		const kb = kbOf(
			{
				x: { type: "boolean", derived: true },
				y: { type: "boolean", derived: true },
			},
			[rule("r1", "x", ref("y")), rule("r2", "y", ref("x"))],
		);
		expect([...(findCycle(kb) ?? [])].sort()).toEqual(["x", "y"]);
	});
});

describe("validateKb", () => {
	it("accepts a valid knowledge base", () => {
		const kb = kbOf(
			{ a: { type: "boolean" }, d: { type: "boolean", derived: true } },
			[rule("r1", "d", ref("a"))],
			["d"],
		);
		expect(() => validateKb(kb)).not.toThrow();
	});

	it("rejects a goal that is not a fact with INVALID_KB naming the goal", () => {
		const kb = kbOf({ a: { type: "boolean" } }, [], ["missing"]);
		expect(codeOf(() => validateKb(kb))).toBe("INVALID_KB");
		expect(messageOf(() => validateKb(kb))).toContain("missing");
	});

	it("rejects a rule setting an unknown fact with INVALID_KB naming the rule", () => {
		const kb = kbOf({ a: { type: "boolean" } }, [
			rule("rule_zz", "ghost", lit(true)),
		]);
		expect(codeOf(() => validateKb(kb))).toBe("INVALID_KB");
		expect(messageOf(() => validateKb(kb))).toContain("rule_zz");
	});

	it("rejects a cycle with CYCLE naming every fact on it", () => {
		const kb = kbOf(
			{
				x: { type: "boolean", derived: true },
				y: { type: "boolean", derived: true },
			},
			[rule("r1", "x", ref("y")), rule("r2", "y", ref("x"))],
		);
		expect(codeOf(() => validateKb(kb))).toBe("CYCLE");
		const msg = messageOf(() => validateKb(kb));
		expect(msg).toContain("x");
		expect(msg).toContain("y");
	});

	it("reports a self-cycle as CYCLE", () => {
		const kb = kbOf({ a: { type: "boolean", derived: true } }, [
			rule("r1", "a", ref("a")),
		]);
		expect(codeOf(() => validateKb(kb))).toBe("CYCLE");
	});

	it("checks goals before rule sets, and both before cycles", () => {
		const cyclic = [rule("r1", "a", ref("a"))];
		const facts = { a: { type: "boolean", derived: true } } as const;
		// Bad goal and bad rule set and cycle: goal wins.
		const all = kbOf(
			{ ...facts },
			[...cyclic, rule("r2", "ghost", lit(1))],
			["nogoal"],
		);
		expect(messageOf(() => validateKb(all))).toContain("nogoal");
		// Bad rule set and cycle: rule set wins.
		const ruleAndCycle = kbOf({ ...facts }, [
			...cyclic,
			rule("r2", "ghost", lit(1)),
		]);
		expect(codeOf(() => validateKb(ruleAndCycle))).toBe("INVALID_KB");
		expect(messageOf(() => validateKb(ruleAndCycle))).toContain("r2");
	});

	it("does not treat inherited names as declared facts", () => {
		const kb = kbOf({ a: { type: "boolean" } }, [], ["constructor"]);
		expect(codeOf(() => validateKb(kb))).toBe("INVALID_KB");
		const kb2 = kbOf({ a: { type: "boolean" } }, [
			rule("r1", "__proto__", lit(true)),
		]);
		expect(codeOf(() => validateKb(kb2))).toBe("INVALID_KB");
	});
});

describe("checkValue", () => {
	const kb = kbOf({
		flag: { type: "boolean" },
		n: { type: "number" },
		m: { type: "money" },
		d: { type: "date" },
		e: { type: "enum", options: ["single", "Double"] },
		der: { type: "number", derived: true },
	});
	const ok = (fact: string, value: unknown) =>
		expect(() => checkValue(kb, fact, value)).not.toThrow();
	const bad = (fact: string, value: unknown) =>
		expect(codeOf(() => checkValue(kb, fact, value))).toBe("INVALID_ANSWER");

	it("accepts valid values of each type", () => {
		ok("flag", true);
		ok("flag", false);
		ok("n", 1.5);
		ok("n", -0);
		ok("m", 500000);
		ok("m", 0);
		ok("d", "2024-02-29");
		ok("e", "Double");
	});

	it("rejects an impossible calendar date", () => {
		bad("d", "2025-02-30");
		bad("d", "2023-02-29");
		bad("d", "2025-13-01");
	});

	it("rejects NaN and infinities for number and money", () => {
		for (const v of [Number.NaN, Infinity, -Infinity]) {
			bad("n", v);
			bad("m", v);
		}
	});

	it("rejects unsafe and non-integer money", () => {
		bad("m", Number.MAX_SAFE_INTEGER + 1);
		bad("m", 2 ** 53);
		bad("m", 1.5);
		ok("m", Number.MAX_SAFE_INTEGER);
	});

	it("rejects a wrong-case or unlisted enum option", () => {
		bad("e", "SINGLE");
		bad("e", "double");
		bad("e", "triple");
	});

	it("rejects wrong types, undefined, null, symbols and UNKNOWN", () => {
		bad("flag", "true");
		bad("n", "1");
		bad("d", 20250101);
		bad("e", 1);
		for (const v of [undefined, null, Symbol("x"), UNKNOWN]) {
			bad("flag", v);
			bad("n", v);
			bad("e", v);
		}
	});

	it("throws UNKNOWN_FACT, then NOT_ANSWERABLE, then INVALID_ANSWER", () => {
		expect(codeOf(() => checkValue(kb, "nope", UNKNOWN))).toBe("UNKNOWN_FACT");
		expect(codeOf(() => checkValue(kb, "der", UNKNOWN))).toBe("NOT_ANSWERABLE");
		expect(codeOf(() => checkValue(kb, "n", UNKNOWN))).toBe("INVALID_ANSWER");
	});

	it("treats __proto__ and constructor as unknown unless declared", () => {
		expect(codeOf(() => checkValue(kb, "__proto__", true))).toBe(
			"UNKNOWN_FACT",
		);
		expect(codeOf(() => checkValue(kb, "constructor", true))).toBe(
			"UNKNOWN_FACT",
		);
		expect(codeOf(() => checkValue(kb, "toString", true))).toBe("UNKNOWN_FACT");
	});

	it("accepts __proto__ and constructor when they are declared facts", () => {
		const facts: Record<string, FactDef> = {};
		Object.defineProperty(facts, "__proto__", {
			value: { type: "boolean" },
			enumerable: true,
			configurable: true,
			writable: true,
		});
		Object.defineProperty(facts, "constructor", {
			value: { type: "number" },
			enumerable: true,
			configurable: true,
			writable: true,
		});
		const k = kbOf(facts);
		expect(() => checkValue(k, "__proto__", true)).not.toThrow();
		expect(() => checkValue(k, "constructor", 3)).not.toThrow();
		expect(codeOf(() => checkValue(k, "constructor", true))).toBe(
			"INVALID_ANSWER",
		);
	});
});

describe("validateAnswers", () => {
	const kb = kbOf({
		a: { type: "boolean" },
		b: { type: "number" },
		der: { type: "number", derived: true },
	});

	it("accepts an empty and a valid record", () => {
		expect(() => validateAnswers(kb, {})).not.toThrow();
		expect(() => validateAnswers(kb, { a: true, b: 2 })).not.toThrow();
	});

	it("runs the three passes: unknown, then derived, then bad value", () => {
		const all = { a: "bad", der: 1, zzz: 1 };
		expect(codeOf(() => validateAnswers(kb, all))).toBe("UNKNOWN_FACT");
		expect(codeOf(() => validateAnswers(kb, { a: "bad", der: 1 }))).toBe(
			"NOT_ANSWERABLE",
		);
		expect(codeOf(() => validateAnswers(kb, { a: "bad" }))).toBe(
			"INVALID_ANSWER",
		);
	});

	it("reports the first offender in code-unit order within a pass", () => {
		const msg = messageOf(() => validateAnswers(kb, { zz: 1, B: 1, aa: 1 }));
		expect(msg).toContain('"B"');
		const msg2 = messageOf(() => validateAnswers(kb, { b: "x", a: 1 }));
		expect(msg2).toContain('"a"');
	});
});

describe("normaliseValue", () => {
	it("stores -0 as 0 and leaves other values alone", () => {
		expect(Object.is(normaliseValue(-0), 0)).toBe(true);
		expect(normaliseValue(5)).toBe(5);
		expect(normaliseValue("x")).toBe("x");
		expect(normaliseValue(false)).toBe(false);
	});
});
