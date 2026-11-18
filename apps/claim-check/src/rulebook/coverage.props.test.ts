import type { KnowledgeBase, Rule } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { toyKb } from "../testing/toyKb";
import { coverage } from "./coverage";

const base = toyKb();
const idArb = fc
	.tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 12 }))
	.map(([a, b]) => `${a}.${b}`);

/** A knowledge base whose clause ids and rule cites overlap only partly. */
const kbArb = fc
	.record({
		clauseIds: fc.uniqueArray(idArb, { maxLength: 15 }),
		cites: fc.array(idArb, { maxLength: 25 }),
	})
	.map(({ clauseIds, cites }): KnowledgeBase => {
		const template = base.rules[0] as Rule;
		return {
			...base,
			clauses: Object.fromEntries(
				clauseIds.map((id) => [id, { id, title: `T ${id}`, text: "Text." }]),
			),
			rules: cites.map((cite, i) => ({ ...template, id: `R-${i}`, cite })),
		};
	});

describe("Property 8: coverage is complete both ways", () => {
	it("holds every clause and every rule, and flags exactly the missing cites", () => {
		fc.assert(
			fc.property(kbArb, (kb) => {
				const c = coverage(kb);
				expect(Object.keys(c.byClause).sort()).toEqual(
					Object.keys(kb.clauses).sort(),
				);
				expect(c.byRule.map((r) => r.rule)).toEqual(kb.rules);
				for (const rule of kb.rules) {
					const known = rule.cite in kb.clauses;
					expect(c.missing.includes(rule)).toBe(!known);
					if (known) expect(c.byClause[rule.cite]).toContain(rule);
				}
			}),
			{ numRuns: 200 },
		);
	});
});
