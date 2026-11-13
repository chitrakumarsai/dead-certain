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
import { checkDeadGuards, isDead } from "./checks/dead-guards";
import type { ParsedFact, ParsedKb } from "./model";
import { exprArb, type ScopeFact } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

const SCOPE: readonly ScopeFact[] = [
	{ name: "a", type: "boolean" },
	{ name: "b", type: "boolean" },
	{ name: "c", type: "boolean" },
	{ name: "n", type: "number" },
	{ name: "m", type: "number" },
];

const and = (left: Expr, right: Expr): Expr => ({
	kind: "binary",
	op: "and",
	left,
	right,
});
const not = (operand: Expr): Expr => ({ kind: "unary", op: "not", operand });
const FALSE: Expr = { kind: "literal", type: "boolean", value: false };

function kbWith(when: Expr): ParsedKb {
	const facts = new Map<string, ParsedFact>();
	const add = (name: string, def: FactDef) =>
		facts.set(name, { name, index: facts.size, def });
	for (const f of SCOPE)
		add(f.name, { type: f.type, ask: `What is ${f.name}?` });
	add("out", { type: "number", derived: true });
	return {
		id: "demo",
		goals: ["out"],
		facts,
		rules: [
			{
				id: "R-1",
				index: 0,
				cite: "1",
				set: "out",
				because: "Because.",
				toText: "1",
				toExpr: { kind: "literal", type: "number", value: 1 },
				whenText: print(when),
				whenExpr: when,
			},
		],
		clauses: new Map(),
	};
}

function reported(when: Expr): boolean {
	return checkDeadGuards(kbWith(when), FILE).some(
		(d) => d.code === "DEAD_GUARD",
	);
}

const anyBool = exprArb("boolean", SCOPE, 2);

/** A dead operand: `false`, `x and not x` or `not x and x`. */
const deadArb: fc.Arbitrary<Expr> = fc.oneof(
	fc.constant(FALSE),
	anyBool.map((x) => and(x, not(x))),
	anyBool.map((x) => and(not(x), x)),
);

/** Join operands into an `and` chain, nested left (as parsed) or right. */
function chain(operands: readonly Expr[], leftNested: boolean): Expr {
	const items = [...operands];
	if (leftNested) {
		return items.slice(1).reduce((acc, e) => and(acc, e), items[0] as Expr);
	}
	return items
		.slice(0, -1)
		.reduceRight((acc, e) => and(e, acc), items[items.length - 1] as Expr);
}

/** Environment over the scope: every fact known or unknown. */
const envArb: fc.Arbitrary<Env> = fc
	.record({
		a: fc.option(fc.boolean(), { nil: UNKNOWN }),
		b: fc.option(fc.boolean(), { nil: UNKNOWN }),
		c: fc.option(fc.boolean(), { nil: UNKNOWN }),
		n: fc.option(fc.integer({ min: -50, max: 50 }), { nil: UNKNOWN }),
		m: fc.option(fc.integer({ min: -50, max: 50 }), { nil: UNKNOWN }),
	})
	.map((r) => r as Env);

describe("Property 17: A reported dead guard is never true, and nested dead operands are found", () => {
	// Feature: kb-tools, Property 17: A reported dead guard is never true, and nested dead operands are found
	// **Validates: Requirements 14.1, 14.2, 14.3, 14.4**
	it("reports `x and not x` and `not x and x` for any generated x", () => {
		fc.assert(
			fc.property(anyBool, (x) => {
				expect(reported(and(x, not(x)))).toBe(true);
				expect(reported(and(not(x), x))).toBe(true);
			}),
			{ numRuns: 200 },
		);
	});

	it("reports an and chain of any length with a dead operand at any position", () => {
		fc.assert(
			fc.property(
				fc.array(anyBool, { minLength: 0, maxLength: 12 }),
				fc.array(anyBool, { minLength: 0, maxLength: 12 }),
				deadArb,
				fc.boolean(),
				(before, after, dead, leftNested) => {
					const guard = chain([...before, dead, ...after], leftNested);
					expect(isDead(guard)).toBe(true);
					expect(reported(guard)).toBe(true);
				},
			),
			{ numRuns: 300 },
		);
	});

	it("never evaluates to true for a reported guard, in any environment", () => {
		const operand = fc.oneof(anyBool, deadArb);
		fc.assert(
			fc.property(
				fc.array(operand, { minLength: 1, maxLength: 6 }),
				fc.boolean(),
				envArb,
				(operands, leftNested, env) => {
					const guard = chain(operands, leftNested);
					fc.pre(reported(guard));
					const result = evaluate(guard, env);
					expect(result.ok && result.value === true).toBe(false);
				},
			),
			{ numRuns: 400 },
		);
	});
});
