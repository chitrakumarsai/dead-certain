import {
	type Env,
	type Expr,
	evaluate,
	type FactDef,
	print,
	UNKNOWN,
} from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkMoney, isRoundedMoney } from "./checks/money";
import { clip } from "./diagnostics";
import type { ParsedFact, ParsedKb } from "./model";
import { moneyExprArb, type ScopeFact } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

/** Declared facts only: checkMoney skips rules that read an undeclared fact. */
const SCOPE: readonly ScopeFact[] = [
	{ name: "m1", type: "money" },
	{ name: "m2", type: "money" },
	{ name: "n1", type: "number" },
	{ name: "b1", type: "boolean" },
];

function factTable(): Map<string, ParsedFact> {
	const facts = new Map<string, ParsedFact>();
	const add = (name: string, def: FactDef) =>
		facts.set(name, { name, index: facts.size, def });
	for (const f of SCOPE) {
		add(f.name, { type: f.type, ask: `What is ${f.name}?` });
	}
	add("out", { type: "money", derived: true });
	return facts;
}

function kbWith(to: Expr): ParsedKb {
	return {
		id: "demo",
		goals: ["out"],
		facts: factTable(),
		rules: [
			{
				id: "R-1",
				index: 0,
				cite: "1",
				set: "out",
				because: "Because.",
				toText: print(to),
				toExpr: to,
			},
		],
		clauses: new Map(),
	};
}

const smallInt = fc.integer({ min: -1000, max: 1000 });

/** Every fact is a small integer, or left unknown. */
const envArb: fc.Arbitrary<Env> = fc
	.record({
		m1: fc.option(smallInt, { nil: UNKNOWN }),
		m2: fc.option(smallInt, { nil: UNKNOWN }),
		n1: fc.option(smallInt, { nil: UNKNOWN }),
		b1: fc.option(fc.boolean(), { nil: UNKNOWN }),
	})
	.map((r) => r as Env);

const taggedArb = moneyExprArb(SCOPE, 3);

describe("Property 11: Rounded money expressions evaluate to whole numbers", () => {
	// Feature: kb-tools, Property 11: Rounded money expressions evaluate to whole numbers
	// **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
	it("tags each generated expression consistently with isRoundedMoney", () => {
		const facts = factTable();
		fc.assert(
			fc.property(taggedArb, ({ expr, rounded }) => {
				expect(isRoundedMoney(expr, facts)).toBe(rounded);
			}),
			{ numRuns: 300 },
		);
	});

	it("evaluates accepted expressions to an integer or UNKNOWN", () => {
		const facts = factTable();
		fc.assert(
			fc.property(taggedArb, envArb, ({ expr }, env) => {
				fc.pre(isRoundedMoney(expr, facts));
				const result = evaluate(expr, env);
				if (!result.ok) {
					expect(["DIVISION_BY_ZERO", "NUMERIC_OVERFLOW"]).toContain(
						result.error.code,
					);
					return;
				}
				if (result.value !== UNKNOWN) {
					expect(Number.isInteger(result.value)).toBe(true);
				}
			}),
			{ numRuns: 300 },
		);
	});

	it("reports MONEY_NOT_ROUNDED if and only if isRoundedMoney rejects the to", () => {
		const facts = factTable();
		fc.assert(
			fc.property(taggedArb, ({ expr }) => {
				const found = checkMoney(kbWith(expr), FILE);
				const accepted = isRoundedMoney(expr, facts);
				expect(found.length).toBe(accepted ? 0 : 1);
				for (const d of found) {
					expect(d.code).toBe("MONEY_NOT_ROUNDED");
					expect(d.message).toContain("R-1");
					expect(d.message).toContain("out");
					expect(d.message).toContain(clip(print(expr)));
					expect(d.message).toContain("round(");
				}
			}),
			{ numRuns: 300 },
		);
	});

	it("does not report a rule that sets a non-money fact", () => {
		const kb = kbWith({ kind: "fact", name: "n1" });
		const rule = kb.rules[0];
		if (rule === undefined) throw new Error("no rule");
		const other: ParsedKb = { ...kb, rules: [{ ...rule, set: "n1" }] };
		expect(checkMoney(other, FILE)).toEqual([]);
	});
});
