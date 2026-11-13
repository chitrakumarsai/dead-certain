import type { KnowledgeBase } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateText } from "./index";
import { cyclicKbArb, kbArb, renderYaml } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

function cyclesOf(kb: KnowledgeBase) {
	return validateText(renderYaml(kb), FILE)
		.diagnostics.filter((d) => d.code === "CYCLE")
		.map((d) => ({ code: d.code, id: d.id, message: d.message }));
}

/** A knowledge base paired with the same base whose rules are in another order. */
const permutedArb = fc.oneof(kbArb, cyclicKbArb).chain((kb) =>
	fc
		.shuffledSubarray([...kb.rules], {
			minLength: kb.rules.length,
			maxLength: kb.rules.length,
		})
		.map((rules) => ({ kb, permuted: { ...kb, rules } as KnowledgeBase })),
);

describe("Property 8: The CYCLE diagnostics do not depend on rule order", () => {
	// Feature: kb-tools, Property 8: The CYCLE diagnostics do not depend on rule order
	// **Validates: Requirements 8.4**
	it("gives identical CYCLE code, id and message for any permutation of the rules", () => {
		fc.assert(
			fc.property(permutedArb, ({ kb, permuted }) => {
				expect(cyclesOf(permuted)).toEqual(cyclesOf(kb));
			}),
			{ numRuns: 200 },
		);
	});
});
