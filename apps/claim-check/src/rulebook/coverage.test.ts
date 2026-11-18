import type { KnowledgeBase } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { realKb } from "../testing/realKb";
import { toyKb } from "../testing/toyKb";
import { byClauseId, coverage } from "./coverage";

describe("coverage", () => {
	it("lists every clause and rule of the real knowledge base, with nothing missing", () => {
		const kb = realKb();
		const c = coverage(kb);
		expect(Object.keys(c.byClause).sort()).toEqual(
			Object.keys(kb.clauses).sort(),
		);
		expect(c.byRule.map((r) => r.rule.id)).toEqual(kb.rules.map((r) => r.id));
		expect(c.missing).toEqual([]);
		expect(c.byClause["4.2"]?.length).toBeGreaterThan(0);
	});

	it("keeps an uncited clause and reports a rule whose cite is missing", () => {
		const toy = toyKb();
		const [r1, r2] = toy.rules;
		if (r1 === undefined || r2 === undefined) throw new Error("toy rules");
		const kb: KnowledgeBase = {
			...toy,
			rules: [r1, { ...r2, cite: "9.9" }],
			clauses: {
				...toy.clauses,
				"2": { id: "2", title: "Unused", text: "Nothing cites this." },
			},
		};
		const c = coverage(kb);
		expect(c.byClause["2"]).toEqual([]);
		expect(c.byClause["1"]?.map((r) => r.id)).toEqual(["R-1"]);
		expect(c.missing.map((r) => r.id)).toEqual(["R-2"]);
		expect(c.byRule[1]?.clause).toBeUndefined();
	});

	it("sorts clause ids in natural order, so 4.10 follows 4.9", () => {
		expect(["4.10", "10.1", "4.9", "4.2"].sort(byClauseId)).toEqual([
			"4.2",
			"4.9",
			"4.10",
			"10.1",
		]);
	});

	it("does not treat an inherited property as a clause", () => {
		const toy = toyKb();
		const kb = {
			...toy,
			rules: toy.rules.map((r) => ({ ...r, cite: "toString" })),
		};
		expect(coverage(kb).missing).toHaveLength(toy.rules.length);
	});
});
