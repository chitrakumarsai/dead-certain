import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";

// The `zz` prefix keeps every name clear of reserved words and of the fixed facts.
const nameArb = fc.stringMatching(/^zz[a-z0-9_]{0,12}$/);

/** A knowledge base whose only rule has the given `to`; `extraFact` is an optional extra askable money fact. */
function kb(to: string, extraFact?: string): string {
	const extra = extraFact
		? `  ${extraFact}:\n    type: money\n    ask: Extra?\n`
		: "";
	return [
		"id: demo",
		"goals: [payable]",
		"facts:",
		"  rent:",
		"    type: money",
		"    ask: What is the rent?",
		extra.trimEnd(),
		"  payable:",
		"    type: money",
		"    derived: true",
		"rules:",
		"  - id: R-1",
		'    cite: "4.2"',
		"    set: payable",
		`    to: ${to}`,
		"    because: Because.",
		"clauses:",
		'  "4.2":',
		"    title: Room",
		"    text: Room rent.",
	]
		.filter((l) => l !== "")
		.join("\n");
}

describe("Property 14: The quoted-literal hint appears for a lone unknown identifier only", () => {
	// Feature: kb-tools, Property 14: The quoted-literal hint appears for a lone unknown identifier only
	// **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
	it("gives the hint and corrected YAML for a lone unknown identifier", () => {
		fc.assert(
			fc.property(nameArb, (name) => {
				const found = validateText(kb(name), FILE).diagnostics.filter(
					(d) => d.code === "UNKNOWN_FACT",
				);
				expect(found).toHaveLength(1);
				expect(found[0]?.message).toBe(
					`Fact '${name}' is not defined — did you mean the enum literal '${name}'? Corrected YAML: "'${name}'"`,
				);
			}),
			{ numRuns: 200 },
		);
	});

	it("gives the plain message for the identifier inside a larger expression", () => {
		fc.assert(
			fc.property(nameArb, (name) => {
				const found = validateText(kb(`${name} + 1`), FILE).diagnostics.filter(
					(d) => d.code === "UNKNOWN_FACT",
				);
				expect(found).toHaveLength(1);
				expect(found[0]?.message).toBe(`Fact '${name}' is not defined.`);
				expect(found[0]?.message).not.toContain("did you mean");
			}),
			{ numRuns: 200 },
		);
	});

	it("gives no diagnostic for a bare reference to a defined fact", () => {
		fc.assert(
			fc.property(nameArb, (name) => {
				const diagnostics = validateText(kb(name, name), FILE).diagnostics;
				expect(diagnostics.filter((d) => d.code === "UNKNOWN_FACT")).toEqual(
					[],
				);
				expect(
					diagnostics.some((d) => d.message.includes("did you mean")),
				).toBe(false);
			}),
			{ numRuns: 200 },
		);
	});
});
