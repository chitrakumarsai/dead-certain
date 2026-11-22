import { print } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { steps } from "./stepsData";
import { claimKb } from "./testing/claimKb";

const kb = claimKb();
const ids = kb.rules.map((r) => r.id);

describe("steps properties", () => {
	it("quotes the knowledge base's text for any rule, and nothing for an unknown id", () => {
		// Feature: landing-page, Property 4: Quoted text is the knowledge base's text
		fc.assert(
			fc.property(
				fc.oneof(
					fc.constantFrom(...ids),
					fc.string().filter((s) => !ids.includes(s)),
				),
				(id) => {
					const rule = kb.rules.find((r) => r.id === id);
					const data = steps(kb, id);
					if (rule === undefined) {
						expect(data).toBeNull();
						return;
					}
					const clause = kb.clauses[rule.cite];
					if (clause === undefined) return expect(data).toBeNull();
					const to = print(rule.to);
					expect(data).toEqual({
						clause,
						rule: {
							id,
							because: rule.because,
							expression:
								rule.when === undefined ? to : `${to} when ${print(rule.when)}`,
							cite: rule.cite,
						},
					});
				},
			),
			{ numRuns: 100 },
		);
	});
});
