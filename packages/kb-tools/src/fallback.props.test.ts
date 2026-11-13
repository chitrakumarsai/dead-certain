import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";

type Role = "deduction" | "check" | undefined;

interface DerivedSpec {
	name: string;
	role: Role;
	/** One entry per rule that sets this fact: true when it has a `when` guard. */
	guards: boolean[];
}

const roleArb: fc.Arbitrary<Role> = fc.constantFrom<Role>(
	"deduction",
	"check",
	undefined,
);

/** Three derived number facts, each with its own role and 0 to 3 rules. */
const specsArb: fc.Arbitrary<DerivedSpec[]> = fc
	.tuple(
		fc.tuple(roleArb, fc.array(fc.boolean(), { maxLength: 3 })),
		fc.tuple(roleArb, fc.array(fc.boolean(), { maxLength: 3 })),
		fc.tuple(roleArb, fc.array(fc.boolean(), { maxLength: 3 })),
	)
	.map((parts) =>
		parts.map(([role, guards], i) => ({ name: `d${i}`, role, guards })),
	);

function render(specs: DerivedSpec[]): string {
	const lines = [
		"id: demo",
		"goals: [payable]",
		"facts:",
		"  payable:",
		"    type: money",
		"    derived: true",
		"  ok:",
		"    type: boolean",
		"    ask: Is it ok?",
	];
	for (const s of specs) {
		lines.push(`  ${s.name}:`, "    type: number", "    derived: true");
		if (s.role !== undefined) lines.push(`    role: ${s.role}`);
	}
	lines.push(
		"rules:",
		"  - id: R-pay",
		'    cite: "4.2"',
		"    set: payable",
		'    to: "1"',
		"    because: Because.",
	);
	for (const s of specs) {
		s.guards.forEach((guarded, i) => {
			lines.push(
				`  - id: R-${s.name}-${i}`,
				'    cite: "4.2"',
				`    set: ${s.name}`,
				'    to: "1"',
				"    because: Because.",
			);
			if (guarded) lines.push('    when: "ok"');
		});
	}
	lines.push("clauses:", '  "4.2":', "    title: Room", "    text: Room rent.");
	return lines.join("\n");
}

describe("Property 16: The fallback warning is exactly characterised and never fails a run", () => {
	// Feature: kb-tools, Property 16: The fallback warning is exactly characterised and never fails a run
	// **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 14.5**
	it("reports NO_FALLBACK_RULE for a fact if and only if its role is deduction and no unguarded rule sets it", () => {
		fc.assert(
			fc.property(specsArb, (specs) => {
				const result = validateText(render(specs), FILE);
				const warned = result.diagnostics
					.filter((d) => d.code === "NO_FALLBACK_RULE")
					.map((d) => d.id)
					.sort();
				const expected = specs
					.filter((s) => s.role === "deduction" && !s.guards.includes(false))
					.map((s) => s.name)
					.sort();
				expect(warned).toEqual(expected);
			}),
			{ numRuns: 200 },
		);
	});

	it("keeps ok true when the only diagnostics are warnings", () => {
		// The compile and exit-code halves are asserted in tasks 11.1 and 13.5.
		fc.assert(
			fc.property(specsArb, (specs) => {
				const result = validateText(render(specs), FILE);
				expect(result.diagnostics.every((d) => d.severity === "warning")).toBe(
					true,
				);
				expect(result.ok).toBe(true);
			}),
			{ numRuns: 200 },
		);
	});
});
