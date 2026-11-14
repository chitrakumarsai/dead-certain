import { describe, expect, it } from "vitest";
import { explain } from "./api";
import { parse } from "./lang/parse";
import type { Expr, FactValue, KnowledgeBase, Rule } from "./types";

function expr(src: string): Expr {
	const r = parse(src);
	if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
	return r.expr;
}

function kbWith(because: string): KnowledgeBase {
	const rule: Rule = {
		id: "r-out",
		cite: "c-out",
		set: "out",
		to: expr("amount + 1"),
		because,
	};
	return {
		id: "because",
		goals: ["out"],
		facts: {
			amount: { type: "number", ask: "amount?" },
			tag: { type: "enum", options: ["{amount}", "plain"], ask: "tag?" },
			out: { type: "number", derived: true },
		},
		rules: [rule],
		clauses: { "c-out": { id: "c-out", title: "Out", text: "out" } },
	};
}

function becauseOf(
	text: string,
	answers: Record<string, FactValue>,
): string | undefined {
	return explain({ kb: kbWith(text), answers }, "out").because;
}

describe("because placeholder fill", () => {
	it("replaces a placeholder with the String of a known value", () => {
		expect(becauseOf("amount is {amount}.", { amount: 41 })).toBe(
			"amount is 41.",
		);
	});

	it("replaces every occurrence of a placeholder", () => {
		expect(becauseOf("{amount} and {amount}", { amount: 7 })).toBe("7 and 7");
	});

	it("writes unknown for a fact with no value", () => {
		expect(becauseOf("amount is {amount}.", {})).toBe("amount is unknown.");
	});

	it("leaves a placeholder that is not a fact unchanged", () => {
		expect(becauseOf("see {nothing} and {amount}", { amount: 2 })).toBe(
			"see {nothing} and 2",
		);
	});

	it("does not expand braces inside substituted text again", () => {
		expect(
			becauseOf("tag is {tag}; amount {amount}", {
				tag: "{amount}",
				amount: 5,
			}),
		).toBe("tag is {amount}; amount 5");
	});
});
