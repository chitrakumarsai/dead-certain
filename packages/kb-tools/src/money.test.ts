import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./index";
import { validateText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";

const FACTS = `  sum_insured:
    type: money
    ask: What is the sum insured?
  other:
    type: money
    ask: What is the other amount?
  payable:
    type: money
    derived: true
  ok:
    type: boolean
    ask: Is it ok?
  rate:
    type: number
    ask: What is the rate?
  note:
    type: number
    derived: true
`;

/** One rule setting `set` (default `payable`) from `to`. */
function kb(to: string, set = "payable"): string {
	return [
		"id: demo",
		"goals: [payable]",
		"facts:",
		FACTS,
		"rules:",
		"  - id: R-1",
		'    cite: "4.2"',
		`    set: ${set}`,
		`    to: ${JSON.stringify(to)}`,
		"    because: Because.",
		"clauses:",
		'  "4.2":',
		"    title: Room",
		"    text: Room rent.",
	].join("\n");
}

function moneyDiags(text: string): Diagnostic[] {
	return validateText(text, FILE).diagnostics.filter(
		(d) => d.code === "MONEY_NOT_ROUNDED",
	);
}

describe("MONEY_NOT_ROUNDED", () => {
	it("flags sum_insured * 0.01, naming rule, fact and expression, and says round(", () => {
		const found = moneyDiags(kb("sum_insured * 0.01"));
		expect(found).toHaveLength(1);
		const d = found[0];
		expect(d?.severity).toBe("error");
		expect(d?.id).toBe("R-1");
		expect(d?.field).toBe("to");
		expect(d?.message).toContain("R-1");
		expect(d?.message).toContain("payable");
		expect(d?.message).toContain("sum_insured * 0.01");
		expect(d?.message).toContain("round(");
	});

	it("accepts round(sum_insured * 0.01)", () => {
		expect(moneyDiags(kb("round(sum_insured * 0.01)"))).toEqual([]);
	});

	describe("accepts each Rounded_Money_Expression form", () => {
		const accepted: ReadonlyArray<readonly [string, string]> = [
			["round call", "round(sum_insured / 3)"],
			["integer literal", "500"],
			["money fact reference", "sum_insured"],
			["min of rounded", "min(sum_insured, 500)"],
			["max of rounded", "max(sum_insured, other)"],
			["if with rounded branches", "if(ok, sum_insured, 0)"],
			["sum of rounded", "sum_insured + other"],
			["difference of rounded", "sum_insured - 100"],
			["unary minus of rounded", "-sum_insured"],
			["rounded times integer literal", "sum_insured * 2"],
			["integer literal times rounded", "2 * sum_insured"],
		];
		for (const [name, to] of accepted) {
			it(`${name}: ${to}`, () => {
				expect(moneyDiags(kb(to))).toEqual([]);
			});
		}
	});

	describe("rejects expressions that can produce a fraction", () => {
		const rejected: ReadonlyArray<readonly [string, string]> = [
			["fractional literal", "0.5"],
			["division", "sum_insured / 2"],
			["multiplication of two non-literals", "sum_insured * other"],
			["multiplication by a non-money number fact", "sum_insured * rate"],
			["multiplication by a fractional literal", "sum_insured * 1.5"],
			["min with an unrounded argument", "min(sum_insured, sum_insured * 0.5)"],
			["if with an unrounded branch", "if(ok, sum_insured, sum_insured / 2)"],
			["sum with an unrounded operand", "sum_insured + sum_insured * 0.5"],
			["unary minus of unrounded", "-(sum_insured / 2)"],
		];
		for (const [name, to] of rejected) {
			it(`${name}: ${to}`, () => {
				expect(moneyDiags(kb(to))).toHaveLength(1);
			});
		}
	});

	it("does not check a rule whose set fact is not money", () => {
		expect(moneyDiags(kb("rate * 0.5", "note"))).toEqual([]);
	});
});
