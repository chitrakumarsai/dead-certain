import type { Expr, KnowledgeBase, Rule } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateText } from "./index";
import { kbArb, renderYaml } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";
const MISSING = "missing_fact";

/** The number of nodes in an expression. */
function size(expr: Expr): number {
	switch (expr.kind) {
		case "unary":
			return 1 + size(expr.operand);
		case "binary":
			return 1 + size(expr.left) + size(expr.right);
		case "call":
			return 1 + expr.args.reduce((n, a) => n + size(a), 0);
		default:
			return 1;
	}
}

/** Replaces the node at pre-order index `index` with a reference to an undefined fact. */
function replaceAt(expr: Expr, index: number): Expr {
	if (index === 0) return { kind: "fact", name: MISSING };
	let rest = index - 1;
	switch (expr.kind) {
		case "unary":
			return { ...expr, operand: replaceAt(expr.operand, rest) };
		case "binary": {
			const leftSize = size(expr.left);
			return rest < leftSize
				? { ...expr, left: replaceAt(expr.left, rest) }
				: { ...expr, right: replaceAt(expr.right, rest - leftSize) };
		}
		case "call": {
			const args = expr.args.map((arg) => {
				const n = size(arg);
				const out = rest >= 0 && rest < n ? replaceAt(arg, rest) : arg;
				rest -= n;
				return out;
			});
			return { ...expr, args };
		}
		default:
			return expr;
	}
}

interface Mutation {
	readonly kb: KnowledgeBase;
	readonly rule: Rule;
	readonly field: "to" | "when";
}

/** A generated base in which one sub-expression of one rule becomes an undefined reference. */
const mutationArb: fc.Arbitrary<Mutation> = kbArb
	.filter((kb) => kb.rules.length > 0 && !(MISSING in kb.facts))
	.chain((kb) =>
		fc
			.tuple(fc.integer({ min: 0, max: kb.rules.length - 1 }), fc.boolean())
			.chain(([ruleIndex, useWhen]) => {
				const original = kb.rules[ruleIndex] as Rule;
				const field = useWhen && original.when !== undefined ? "when" : "to";
				const target = (field === "when" ? original.when : original.to) as Expr;
				return fc
					.integer({ min: 0, max: size(target) - 1 })
					.map((index): Mutation => {
						const replaced = replaceAt(target, index);
						const rule: Rule = { ...original, [field]: replaced };
						const rules = kb.rules.map((r, i) => (i === ruleIndex ? rule : r));
						return { kb: { ...kb, rules }, rule, field };
					});
			}),
	);

describe("Property 10: One mistake does not cascade", () => {
	// Feature: kb-tools, Property 10: One mistake does not cascade
	// **Validates: Requirements 10.11**
	it("reports exactly one UNKNOWN_FACT for the undefined reference and no dependent type diagnostic", () => {
		fc.assert(
			fc.property(mutationArb, ({ kb, rule, field }) => {
				const diagnostics = validateText(renderYaml(kb), FILE).diagnostics;
				const unknown = diagnostics.filter((d) => d.code === "UNKNOWN_FACT");
				expect(unknown).toHaveLength(1);
				expect(unknown[0]?.id).toBe(rule.id);
				expect(unknown[0]?.field).toBe(field);
				expect(unknown[0]?.message).toContain(MISSING);
				expect(
					diagnostics.filter(
						(d) => d.code === "TYPE_MISMATCH" || d.code === "NOT_BOOLEAN",
					),
				).toEqual([]);
			}),
			{ numRuns: 300 },
		);
	});
});
