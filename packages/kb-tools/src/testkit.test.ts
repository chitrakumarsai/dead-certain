import { parse, print, start } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { loadText, validateText } from "./index";
import {
	answersArb,
	exprArb,
	kbArb,
	moneyExprArb,
	renderYaml,
	type ScopeFact,
} from "./testkit";

const SCOPE: readonly ScopeFact[] = [
	{ name: "a", type: "number" },
	{ name: "m", type: "money" },
	{ name: "flag", type: "boolean" },
	{ name: "d", type: "date" },
	{ name: "tier", type: "enum", options: ["gold", "silver"] },
];

describe("testkit sanity", () => {
	it("kbArb renders to YAML that loadText accepts, with prototypes intact", () => {
		const kbs = fc.sample(kbArb, { numRuns: 200, seed: 1 });
		expect(kbs).toHaveLength(200);
		for (const kb of kbs) {
			const result = loadText(renderYaml(kb), "kb.yaml");
			expect(result.diagnostics).toEqual([]);
			if (!result.ok) continue;
			const facts = result.raw.facts as Record<string, unknown>;
			expect(Object.getPrototypeOf(facts)).toBe(Object.prototype);
			expect(Object.keys(facts)).toEqual(Object.keys(kb.facts));
			expect(Object.keys(result.raw.clauses as object).sort()).toEqual(
				Object.keys(kb.clauses).sort(),
			);
		}
	});

	it("kbArb renders to YAML that passes the full validator (at least 80 percent of draws)", () => {
		const kbs = fc.sample(kbArb, { numRuns: 200, seed: 1 });
		let clean = 0;
		for (const kb of kbs) {
			const result = validateText(renderYaml(kb), "kb.yaml");
			// Random guards may legitimately draw warnings (DEAD_GUARD); errors are not allowed.
			if (!result.diagnostics.some((d) => d.severity === "error")) clean++;
		}
		expect(clean).toBeGreaterThanOrEqual(160);
	});

	it("kbArb is acyclic and accepted by the engine", () => {
		for (const kb of fc.sample(kbArb, { numRuns: 200, seed: 2 })) {
			expect(() => start(kb)).not.toThrow();
		}
	});

	it("exprArb builds expressions that survive print and parse", () => {
		for (const sort of ["boolean", "number", "date", "enum"] as const) {
			for (const expr of fc.sample(exprArb(sort, SCOPE, 3), {
				numRuns: 100,
				seed: 3,
			})) {
				const parsed = parse(print(expr));
				expect(parsed.ok && parsed.expr).toEqual(expr);
			}
		}
	});

	it("moneyExprArb produces both tags", () => {
		const tags = new Set(
			fc
				.sample(moneyExprArb(SCOPE, 2), { numRuns: 100, seed: 4 })
				.map((t) => t.rounded),
		);
		expect(tags).toEqual(new Set([true, false]));
	});

	it("answersArb answers every askable fact within the stated bounds", () => {
		const arb = kbArb.chain((kb) =>
			answersArb(kb).map((answers) => ({ kb, answers })),
		);
		for (const { kb, answers } of fc.sample(arb, { numRuns: 100, seed: 5 })) {
			const askable = Object.entries(kb.facts).filter(
				([, d]) => d.derived !== true,
			);
			expect(Object.keys(answers).sort()).toEqual(
				askable.map(([n]) => n).sort(),
			);
			for (const [name, def] of askable) {
				const v = answers[name];
				if (def.type === "money") {
					expect(Number.isInteger(v) && Math.abs(v as number) <= 10000).toBe(
						true,
					);
				} else if (def.type === "number") {
					expect(Math.abs(v as number)).toBeLessThanOrEqual(1000);
				} else if (def.type === "enum") {
					expect(def.options).toContain(v);
				} else if (def.type === "date") {
					const t = new Date(`${v}T00:00:00Z`);
					expect(t.toISOString().slice(0, 10)).toBe(v);
				}
			}
		}
	});
});
