import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./index";
import { validateText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";

interface RuleSpec {
	set: string;
	to: string;
	when?: string;
}

/** Builds a knowledge base whose facts are all derived money/boolean facts. */
function kb(facts: readonly string[], rules: readonly RuleSpec[]): string {
	const factYaml = facts
		.map((name) => `  ${name}:\n    type: money\n    derived: true\n`)
		.join("");
	const ruleYaml = rules
		.map(
			(r, i) =>
				`  - id: R-${i + 1}\n    cite: "4.2"\n    set: ${r.set}\n    to: ${r.to}\n${
					r.when === undefined ? "" : `    when: ${r.when}\n`
				}    because: Because.\n`,
		)
		.join("");
	return [
		"id: demo",
		`goals: [${facts[0]}]`,
		"facts:",
		factYaml,
		"rules:",
		ruleYaml,
		"clauses:",
		'  "4.2":\n    title: Room\n    text: Room rent.\n',
	].join("\n");
}

function cycles(text: string): Diagnostic[] {
	return validateText(text, FILE).diagnostics.filter((d) => d.code === "CYCLE");
}

describe("CYCLE", () => {
	it("reports a two-fact cycle once, starting at the alphabetically first fact", () => {
		const found = cycles(
			kb(
				["b", "a"],
				[
					{ set: "a", to: "b" },
					{ set: "b", to: "a" },
				],
			),
		);
		expect(found).toHaveLength(1);
		expect(found[0]?.id).toBe("a");
		expect(found[0]?.message).toBe("Dependency cycle: a -> b -> a.");
		expect(found[0]?.file).toBe(FILE);
	});

	it("reports a three-fact cycle starting at the alphabetically first fact", () => {
		const found = cycles(
			kb(
				["c", "b", "a"],
				[
					{ set: "c", to: "a" },
					{ set: "a", to: "b" },
					{ set: "b", to: "c" },
				],
			),
		);
		expect(found).toHaveLength(1);
		expect(found[0]?.id).toBe("a");
		expect(found[0]?.message).toBe("Dependency cycle: a -> b -> c -> a.");
	});

	it("reports a self-reference in `to`, naming the rule", () => {
		const found = cycles(kb(["a"], [{ set: "a", to: "a + 1" }]));
		expect(found).toHaveLength(1);
		expect(found[0]?.id).toBe("a");
		expect(found[0]?.message).toBe(
			"Fact 'a' depends on itself: rule 'R-1' sets it from an expression that reads it.",
		);
	});

	it("reports a self-reference in `when`, naming the first such rule", () => {
		const found = cycles(
			kb(
				["a", "b"],
				[
					{ set: "b", to: "1" },
					{ set: "a", to: "1", when: "a > 0" },
					{ set: "a", to: "2", when: "a > 5" },
				],
			),
		);
		expect(found).toHaveLength(1);
		expect(found[0]?.id).toBe("a");
		expect(found[0]?.message).toContain("rule 'R-2'");
	});

	it("reports two separate cycles as two diagnostics, ordered by first fact in the file", () => {
		const found = cycles(
			kb(
				["y", "z", "a", "b"],
				[
					{ set: "y", to: "z" },
					{ set: "z", to: "y" },
					{ set: "a", to: "b" },
					{ set: "b", to: "a" },
				],
			),
		);
		expect(found.map((d) => d.id)).toEqual(["y", "a"]);
		expect(found.map((d) => d.message)).toEqual([
			"Dependency cycle: y -> z -> y.",
			"Dependency cycle: a -> b -> a.",
		]);
	});

	it("reports nothing for an acyclic graph", () => {
		expect(
			cycles(
				kb(
					["a", "b", "c"],
					[
						{ set: "a", to: "b + c" },
						{ set: "b", to: "c" },
						{ set: "c", to: "1" },
					],
				),
			),
		).toEqual([]);
	});

	it("excludes a rule with an unknown fact reference and gives no misleading CYCLE", () => {
		const text = kb(
			["a", "b"],
			[
				{ set: "a", to: "b" },
				{ set: "b", to: "a + ghost" },
			],
		);
		const diags = validateText(text, FILE).diagnostics;
		expect(diags.some((d) => d.code === "UNKNOWN_FACT")).toBe(true);
		expect(diags.some((d) => d.code === "CYCLE")).toBe(false);
	});

	it("does not overflow the stack on a 5,000-fact chain or ring", () => {
		const n = 5000;
		const names = Array.from({ length: n }, (_, i) => `f${i}`);
		const chain = names.map((name, i) => ({
			set: name,
			to: i + 1 < n ? `f${i + 1}` : "1",
		}));
		expect(cycles(kb(names, chain))).toEqual([]);

		const ring = names.map((name, i) => ({
			set: name,
			to: `f${(i + 1) % n}`,
		}));
		const found = cycles(kb(names, ring));
		expect(found).toHaveLength(1);
		expect(found[0]?.id).toBe("f0");
		// No timing assertion: the explicit timeout (rather than Vitest's 5 s
		// default) keeps a loaded machine from failing a correct run.
	}, 60_000);
});
