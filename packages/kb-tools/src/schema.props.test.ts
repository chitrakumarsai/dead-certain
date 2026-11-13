import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateText } from "./index";
import { faultArb, kbArb } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

const schemaFaultArb = kbArb.chain((kb) => faultArb(kb, "schema"));

describe("Property 18: Shape violations are named", () => {
	// Feature: kb-tools, Property 18: Shape violations are named
	// **Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.7, 3.10**
	it("reports a SCHEMA_INVALID naming the field and the entity id, and runs no phase 2 check", () => {
		fc.assert(
			fc.property(schemaFaultArb, (injected) => {
				const result = validateText(injected.text, FILE);
				expect(result.ok).toBe(false);

				const { name, id } = injected.expected;
				const named = result.diagnostics.filter(
					(d) =>
						d.code === "SCHEMA_INVALID" &&
						d.file === FILE &&
						name !== undefined &&
						(d.field === name || d.message.includes(name)) &&
						(id === undefined || d.id === id),
				);
				expect(named.length).toBeGreaterThan(0);

				// Phase 2 does not run on a file with a shape violation.
				for (const d of result.diagnostics) {
					expect(d.code).toBe("SCHEMA_INVALID");
				}
			}),
			{ numRuns: 100 },
		);
	});
});
