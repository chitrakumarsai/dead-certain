/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { compileText } from "../compile";
import { runCli } from "../index";
import { memoryHost } from "../testkit";
import { checkGolden, duplicateIds } from "./check";
import { coverage } from "./coverage";
import { loadGolden, loadGoldenRaw } from "./load";
import {
	GOLDEN_ERROR_CODES,
	GOLDEN_WARNING_CODES,
	type GoldenSet,
	type Scenario,
} from "./model";
import { runGolden } from "./run";

// The project has no Node type definitions, so the document is read through
// Vite's build-time glob instead of node:fs.
const docs: Record<string, string> = import.meta.glob(
	"../../../../docs/kb-format.md",
	{ eager: true, query: "?raw", import: "default" },
);
const DOC = docs["../../../../docs/kb-format.md"] ?? "";

/** The "Golden scenarios" section: from its heading to the next `## ` heading. */
function section(): string {
	const start = DOC.indexOf("\n## Golden scenarios");
	expect(start).toBeGreaterThanOrEqual(0);
	const rest = DOC.slice(start + 1);
	const next = rest.indexOf("\n## ", 1);
	return next < 0 ? rest : rest.slice(0, next);
}

interface Row {
	readonly code: string;
	readonly severity: string;
	readonly id: string;
	readonly example: string;
}

function rows(): Row[] {
	const out: Row[] = [];
	for (const line of section().split("\n")) {
		const m = /^\| `([A-Z_]+)` \| (\w+) \| (.+?) \| `(.+)` \|$/.exec(line);
		if (m) {
			out.push({
				code: m[1] as string,
				severity: m[2] as string,
				id: m[3] as string,
				example: m[4] as string,
			});
		}
	}
	return out;
}

/** The fenced yaml blocks of the section, in order. */
function yamlBlocks(): string[] {
	return [...section().matchAll(/```yaml\n([\s\S]*?)```/g)].map(
		(m) => m[1] as string,
	);
}

const exampleOf = (code: string): string => {
	const row = rows().find((r) => r.code === code);
	expect(row, code).toBeDefined();
	return row?.example ?? "";
};

describe("Golden codes in docs/kb-format.md", () => {
	const expected = new Map<string, "error" | "warning">([
		...GOLDEN_ERROR_CODES.map((c): [string, "error" | "warning"] => [
			c,
			"error",
		]),
		...GOLDEN_WARNING_CODES.map((c): [string, "error" | "warning"] => [
			c,
			"warning",
		]),
	]);

	it("lists exactly the 15 golden codes, each once", () => {
		const listed = rows().map((r) => r.code);

		expect(listed).toHaveLength(15);
		expect(new Set(listed).size).toBe(15);
		expect([...listed].sort()).toEqual([...expected.keys()].sort());
	});

	it("gives every code its severity, an id description and an example message", () => {
		for (const r of rows()) {
			expect({ code: r.code, severity: r.severity }).toEqual({
				code: r.code,
				severity: expected.get(r.code),
			});
			expect(r.id.trim().length).toBeGreaterThan(0);
			expect(r.example.trim().length).toBeGreaterThan(0);
		}
	});
});

describe("the worked example in docs/kb-format.md", () => {
	const [kbText = "", goldenText = ""] = yamlBlocks();
	const compiled = compileText(kbText, "apps/claim-check/kb/policy.yaml");

	it("has a knowledge base and a golden file", () => {
		expect(yamlBlocks()).toHaveLength(2);
	});

	it("compiles the knowledge base with no diagnostic", () => {
		expect(compiled.diagnostics).toEqual([]);
		expect(compiled.ok).toBe(true);
	});

	it("loads the golden file, fits it to the knowledge base and passes every scenario", () => {
		if (!compiled.ok)
			throw new Error("the example knowledge base must compile");
		const loaded = loadGolden(
			goldenText,
			"apps/claim-check/golden/room-rent.yaml",
		);
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;
		expect(loaded.set.scenarios.map((s) => s.id)).toEqual([
			"G-01",
			"G-02",
			"G-03",
			"G-04",
		]);

		const checked = checkGolden(loaded.set, compiled.kb, "g.yaml");
		expect(checked.diagnostics).toEqual([]);
		const run = runGolden(compiled.kb, checked.runnable, "g.yaml");
		expect(run.diagnostics).toEqual([]);
		expect(run.results.map((r) => r.status)).toEqual([
			"passed",
			"passed",
			"passed",
			"passed",
		]);

		const cov = coverage(compiled.kb, "k.yaml", run.results, 4);
		expect(cov.covered).toEqual(["ROOM-01", "ROOM-02", "ROOM-03"]);
		expect(cov.diagnostics.map((d) => d.code)).toEqual(["TOO_FEW_SCENARIOS"]);
	});

	it("runs through dc golden with the warning and no error", () => {
		const host = memoryHost({
			root: "/repo",
			files: {
				"pnpm-workspace.yaml": "packages:\n  - apps/*\n",
				"apps/claim-check/kb/policy.yaml": kbText,
				"apps/claim-check/golden/room-rent.yaml": goldenText,
			},
			dirs: [],
		});
		const result = runCli(["golden"], host);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe(
			"apps/claim-check/kb/policy.yaml: warning TOO_FEW_SCENARIOS Knowledge base 'claim-check' has 4 scenarios; the build plan asks for at least 12.\n" +
				"1 files, 4 scenarios run, 4 passed, 3 of 3 rules covered, 0 errors, 1 warnings\n",
		);
	});
});

describe("the example messages are the messages the code gives", () => {
	const [kbText = ""] = yamlBlocks();
	const compiled = compileText(kbText, "apps/claim-check/kb/policy.yaml");
	if (!compiled.ok) throw new Error("the example knowledge base must compile");
	const kb = compiled.kb;

	const scenario = (over: Partial<Scenario> = {}): Scenario => ({
		id: "G-01",
		title: "Room rent over the limit",
		mode: "audit",
		facts: { sum_insured: 500000, room_rent_per_day: 600000 },
		expect: { goals: { room_rent_excess: 595000 } },
		...over,
	});
	const fit = (over: Partial<Scenario>): string[] =>
		checkGolden(
			{ kb: "claim-check", scenarios: [scenario(over)] },
			kb,
			"g.yaml",
		).diagnostics.map((d) => d.message);

	it("SCHEMA_INVALID", () => {
		const result = loadGoldenRaw(
			{
				kb: "claim-check",
				scenarios: [
					{
						id: "G-01",
						title: "t",
						facts: {},
						expect: { goals: {} },
						colour: 1,
					},
				],
			},
			"g.yaml",
		);

		expect(result.diagnostics.map((d) => d.message)).toEqual([
			exampleOf("SCHEMA_INVALID"),
		]);
	});

	it("UNKNOWN_FACT, NOT_ASKABLE, BAD_VALUE and UNKNOWN_RULE", () => {
		expect(fit({ facts: { nope: 1 } })).toEqual([exampleOf("UNKNOWN_FACT")]);
		expect(fit({ facts: { room_rent_cap: 1 } })).toEqual([
			exampleOf("NOT_ASKABLE"),
		]);
		expect(fit({ facts: { sum_insured: 1.5 } })).toEqual([
			exampleOf("BAD_VALUE"),
		]);
		expect(
			fit({ expect: { goals: { room_rent_excess: 1 }, fires: ["R-9"] } }),
		).toEqual([exampleOf("UNKNOWN_RULE")]);
	});

	it("DUPLICATE_SCENARIO", () => {
		const set: GoldenSet = { kb: "claim-check", scenarios: [scenario()] };
		const second: GoldenSet = { kb: "claim-check", scenarios: [scenario()] };
		const result = duplicateIds([
			{ file: "apps/claim-check/golden/a.yaml", set },
			{ file: "apps/claim-check/golden/b.yaml", set: second },
		]);

		expect(result.diagnostics.map((d) => d.message)).toEqual([
			exampleOf("DUPLICATE_SCENARIO"),
		]);
	});

	it("SCENARIO_FAILED, RULE_NOT_COVERED and TOO_FEW_SCENARIOS", () => {
		const failing = scenario({
			facts: { sum_insured: 500000, room_rent_per_day: 4000 },
		});
		const run = runGolden(kb, [failing], "g.yaml");
		expect(run.diagnostics.map((d) => d.message)).toEqual([
			exampleOf("SCENARIO_FAILED"),
		]);

		const passing = scenario({
			expect: { goals: { room_rent_excess: 595000 } },
		});
		const passed = runGolden(kb, [passing], "g.yaml");
		const cov = coverage(
			kb,
			"apps/claim-check/kb/policy.yaml",
			passed.results,
			4,
		);
		expect(cov.diagnostics.map((d) => [d.code, d.message])).toEqual([
			["RULE_NOT_COVERED", exampleOf("RULE_NOT_COVERED")],
			["TOO_FEW_SCENARIOS", exampleOf("TOO_FEW_SCENARIOS")],
		]);
	});

	it("KB_NOT_FOUND, KB_AMBIGUOUS and KB_INVALID", () => {
		const golden =
			"kb: claim-check\nscenarios:\n  - id: G-01\n    title: t\n    facts: {}\n    expect:\n      ask: sum_insured\n";
		const run = (files: Record<string, string>) =>
			runCli(
				["golden"],
				memoryHost({
					root: "/repo",
					files: { "pnpm-workspace.yaml": "packages:\n  - apps/*\n", ...files },
					dirs: [],
				}),
			).stdout;
		const g = "apps/claim-check/golden/main.yaml";

		expect(run({ [g]: golden })).toContain(
			`${g}: error KB_NOT_FOUND ${exampleOf("KB_NOT_FOUND")}`,
		);
		expect(
			run({
				[g]: golden,
				"apps/claim-check/kb/a.yaml": kbText,
				"apps/claim-check/kb/b.yaml": kbText,
			}),
		).toContain(`${g}: error KB_AMBIGUOUS ${exampleOf("KB_AMBIGUOUS")}`);
		expect(
			run({
				[g]: golden,
				"apps/claim-check/kb/policy.yaml": kbText.replace(
					"round(sum_insured * 0.01)",
					"nope",
				),
			}),
		).toContain(`${g}: error KB_INVALID ${exampleOf("KB_INVALID")}`);
	});
});
