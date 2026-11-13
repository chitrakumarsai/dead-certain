import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { DiagnosticCode } from "./diagnostics";
import { validateText } from "./index";
import { docOf, faultArb, kbArb, REFERENCE_FAULTS, renderDoc } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

const NINE_CODES: ReadonlySet<DiagnosticCode> = new Set<DiagnosticCode>([
	"UNKNOWN_FACT",
	"DUPLICATE_RULE",
	"UNKNOWN_GOAL",
	"UNKNOWN_SET_FACT",
	"UNKNOWN_CLAUSE",
	"UNKNOWN_PLACEHOLDER",
	"GOAL_UNSET",
	"MISSING_ASK",
	"SET_NON_DERIVED",
]);

const referenceFaultArb = kbArb.chain((kb) => faultArb(kb, "reference"));

describe("Property 12: Reference, goal and question checks report exactly the broken items", () => {
	// Feature: kb-tools, Property 12: Reference, goal and question checks report exactly the broken items
	// **Validates: Requirements 5.1, 5.2, 5.5, 5.6, 5.7, 5.8, 7.1, 7.2, 7.3**
	it("reports exactly the injected fault, with the right code, id and name", () => {
		fc.assert(
			fc.property(referenceFaultArb, (injected) => {
				const result = validateText(injected.text, FILE);
				const found = result.diagnostics.filter((d) => NINE_CODES.has(d.code));
				const { code, id, name, field } = injected.expected;

				expect(found).toHaveLength(1);
				const [diag] = found;
				expect(diag?.code).toBe(code);
				expect(diag?.id).toBe(id);
				expect(diag?.file).toBe(FILE);
				if (name !== undefined) expect(diag?.message).toContain(name);
				if (field !== undefined) expect(diag?.field).toBe(field);
			}),
			{ numRuns: 200 },
		);
	});

	it("covers every one of the nine reference faults", () => {
		const seen = new Set<string>();
		for (const f of fc.sample(referenceFaultArb, { numRuns: 200, seed: 5 })) {
			seen.add(f.fault);
		}
		expect(seen).toEqual(new Set(REFERENCE_FAULTS));
	});

	it("reports none of the nine codes for a knowledge base with no fault injected", () => {
		fc.assert(
			fc.property(kbArb, (kb) => {
				const result = validateText(renderDoc(docOf(kb)), FILE);
				expect(
					result.diagnostics.filter((d) => NINE_CODES.has(d.code)),
				).toEqual([]);
			}),
			{ numRuns: 200 },
		);
	});
});
