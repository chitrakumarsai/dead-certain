import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText } from "./index";
import { kbArb, renderYaml } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

describe("Property 4: compiling the rendering of a knowledge base gives that knowledge base", () => {
	/** **Validates: Requirements 2.1, 3.2, 4.1, 4.3, 4.6, 15.1, 15.2, 15.3, 15.4, 15.5** */
	it("compileText(renderYaml(k)).kb deep-equals k", () => {
		fc.assert(
			fc.property(kbArb, (k) => {
				const result = compileText(renderYaml(k), FILE);
				expect(result.ok).toBe(true);
				if (!result.ok) return;
				expect(result.kb).toEqual(k);
				// Rules and goals keep order; each clause id equals its key; no label added.
				expect(result.kb.goals).toEqual(k.goals);
				expect(result.kb.rules.map((r) => r.id)).toEqual(
					k.rules.map((r) => r.id),
				);
				// Integer-like keys ("10", "3") are reordered by JS itself, identically for
				// the generated record and the compiled one, so compare the JS key order.
				expect(Object.keys(result.kb.clauses)).toEqual(Object.keys(k.clauses));
				expect(Object.keys(result.kb.facts)).toEqual(Object.keys(k.facts));
				for (const [key, clause] of Object.entries(result.kb.clauses)) {
					expect(clause.id).toBe(key);
				}
				for (const [name, def] of Object.entries(result.kb.facts)) {
					expect("label" in def).toBe("label" in (k.facts[name] ?? {}));
				}
				expect("currency" in result.kb).toBe("currency" in k);
			}),
			{ numRuns: 200 },
		);
	});
});
