import { describe, expect, it } from "vitest";
import { loadText } from "../load/yaml-load";

const FILE = "apps/demo/golden/main.yaml";

const GOLDEN = `kb: demo
scenarios:
  - id: G-01
    title: Room rent over the limit
    facts:
      sum_insured: 500000
      room_rent_per_day: 600000
    expect:
      goals:
        payable_amount: 14250000
        verdict: reduced
`;

describe("loadText on a golden-shaped file", () => {
	it("reads it with no diagnostics and keeps each mapping's key order", () => {
		const loaded = loadText(GOLDEN, FILE);

		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;
		const scenario = (
			loaded.raw.scenarios as { facts: object; expect: { goals: object } }[]
		)[0] as { facts: object; expect: { goals: object } };
		expect(Object.keys(scenario.facts)).toEqual([
			"sum_insured",
			"room_rent_per_day",
		]);
		expect(Object.keys(scenario.expect.goals)).toEqual([
			"payable_amount",
			"verdict",
		]);
	});

	it("does not read a nested facts mapping as the top-level facts section", () => {
		const text = GOLDEN.replace(
			"      sum_insured: 500000\n",
			"      sum_insured: 500000\n      sum_insured: 1\n",
		);
		const loaded = loadText(text, FILE);

		expect(loaded.ok).toBe(false);
		expect(loaded.diagnostics.map((d) => d.code)).toEqual(["YAML_SYNTAX"]);
		expect(loaded.diagnostics[0]?.message).toContain(
			"Duplicate key 'sum_insured'",
		);
	});

	it.each([
		["a non-string key", "kb: demo\nscenarios: []\n1: x\n", "SCHEMA_INVALID"],
		[
			"an alias flood",
			`a: &a [1]\n${Array.from({ length: 101 }, (_, i) => `k${i}: *a`).join("\n")}\n`,
			"YAML_SYNTAX",
		],
		["a file over 1 MiB", `kb: ${"x".repeat(1048577)}\n`, "SCHEMA_INVALID"],
		[
			"nesting over 64 levels",
			`a: ${"[".repeat(70)}${"]".repeat(70)}\n`,
			"SCHEMA_INVALID",
		],
	])(
		"gives %s the same diagnostic as for a knowledge base",
		(_, text, code) => {
			const loaded = loadText(text, FILE);

			expect(loaded.ok).toBe(false);
			expect(loaded.diagnostics.map((d) => d.code)).toContain(code);
		},
	);

	it("names the subject in the empty-file message, a knowledge base by default", () => {
		expect(loadText("", FILE).diagnostics[0]?.message).toBe(
			`File '${FILE}' is empty. A knowledge base is a YAML mapping.`,
		);
		expect(loadText("", FILE, "A golden file").diagnostics[0]?.message).toBe(
			`File '${FILE}' is empty. A golden file is a YAML mapping.`,
		);
	});
});
