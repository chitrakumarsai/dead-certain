import { describe, expect, it } from "vitest";
import { runCli } from "../index";
import {
	FIXTURE_KB_TEXT,
	fixtureScenarios,
	goldenYaml,
	memoryHost,
} from "../testkit";

const WORKSPACE = "packages:\n  - apps/*\n";
const KB = "apps/fixture/kb/fixture.yaml";
const MAIN = "apps/fixture/golden/main.yaml";
const SUMMARY_EMPTY =
	"0 files, 0 scenarios run, 0 passed, 0 of 0 rules covered, 0 errors, 0 warnings";

const scenarios = fixtureScenarios();
const fullYaml = goldenYaml({ kb: "fixture", scenarios });

function host(files: Record<string, string>) {
	return memoryHost({
		root: "/repo",
		files: { "pnpm-workspace.yaml": WORKSPACE, ...files },
		dirs: [],
	});
}

const GOOD = { [KB]: FIXTURE_KB_TEXT, [MAIN]: fullYaml };

function golden(files: Record<string, string>, ...args: string[]) {
	const h = host(files);
	const result = runCli(["golden", ...args], h);
	return { ...result, host: h, lines: result.stdout.trimEnd().split("\n") };
}

describe("dc golden", () => {
	it("prints only the summary line for a clean run, and exits 0", () => {
		const r = golden(GOOD);

		expect(r.exitCode).toBe(0);
		expect(r.stderr).toBe("");
		expect(r.stdout).toBe(
			"1 files, 12 scenarios run, 12 passed, 11 of 11 rules covered, 0 errors, 0 warnings\n",
		);
	});

	it("writes nothing and creates no directory, on a clean and on a failing run", () => {
		for (const files of [GOOD, { ...GOOD, [MAIN]: "kb: [" }]) {
			const r = golden(files);

			expect(r.host.writes).toEqual([]);
			expect(r.host.madeDirs).toEqual([]);
		}
	});

	it("prints a failing scenario on one line with expected and observed, and exits 1", () => {
		const broken = fullYaml.replace(
			"payable_amount: 17293500",
			"payable_amount: 14250000",
		);
		const r = golden({ ...GOOD, [MAIN]: broken });

		expect(r.exitCode).toBe(1);
		expect(r.lines).toContain(
			`${MAIN}: error SCENARIO_FAILED [G-1] Scenario 'G-1' (Recorded consult run) failed: goals.payable_amount expected 14250000, observed 17293500`,
		);
		expect(r.lines.at(-1)).toMatch(
			/^1 files, 12 scenarios run, 11 passed, \d+ of 11 rules covered, 1 errors, 0 warnings$/,
		);
	});

	it("reports a YAML error in a golden file with its line", () => {
		const r = golden({ ...GOOD, [MAIN]: "kb: [unclosed\n" });

		expect(r.exitCode).toBe(1);
		expect(r.lines[0]).toMatch(
			new RegExp(`^${MAIN}: error YAML_SYNTAX .*line 2`),
		);
		expect(r.lines.at(-1)).toBe(
			"1 files, 0 scenarios run, 0 passed, 0 of 0 rules covered, 1 errors, 0 warnings",
		);
	});

	it("reports a shape error and runs none of that file's scenarios", () => {
		const r = golden({ ...GOOD, [MAIN]: "kb: fixture\nscenarios: []\n" });

		expect(r.exitCode).toBe(1);
		expect(r.lines[0]).toBe(
			`${MAIN}: error SCHEMA_INVALID Field 'scenarios' must list at least one scenario.`,
		);
	});

	describe("matching the knowledge base", () => {
		it("KB_NOT_FOUND when no knowledge base has that id", () => {
			const r = golden({
				...GOOD,
				[MAIN]: fullYaml.replace("kb: fixture", "kb: nope"),
			});

			expect(r.exitCode).toBe(1);
			expect(r.lines).toEqual([
				`${MAIN}: error KB_NOT_FOUND No knowledge base with id 'nope' in apps/fixture/kb.`,
				"1 files, 0 scenarios run, 0 passed, 0 of 0 rules covered, 1 errors, 0 warnings",
			]);
		});

		it("KB_NOT_FOUND when the app has no kb directory at all", () => {
			const r = golden({ [MAIN]: fullYaml });

			expect(r.lines[0]).toBe(
				`${MAIN}: error KB_NOT_FOUND No knowledge base with id 'fixture' in apps/fixture/kb.`,
			);
		});

		it("KB_AMBIGUOUS when two files have the id", () => {
			const r = golden({
				...GOOD,
				"apps/fixture/kb/copy.yaml": FIXTURE_KB_TEXT,
			});

			expect(r.exitCode).toBe(1);
			expect(r.lines[0]).toBe(
				`${MAIN}: error KB_AMBIGUOUS More than one knowledge base in apps/fixture/kb has id 'fixture': copy.yaml, fixture.yaml.`,
			);
			expect(r.lines.at(-1)).toContain("0 scenarios run");
		});

		it("KB_INVALID when the matching file has errors, and runs none of its scenarios", () => {
			const r = golden({
				...GOOD,
				[KB]: FIXTURE_KB_TEXT.replace(
					"to: round(sum_insured / 100)",
					"to: nope + 1",
				),
			});

			expect(r.exitCode).toBe(1);
			expect(r.lines).toEqual([
				`${MAIN}: error KB_INVALID The knowledge base '${KB}' has errors. Run dc validate first.`,
				"1 files, 0 scenarios run, 0 passed, 0 of 0 rules covered, 1 errors, 0 warnings",
			]);
		});

		it("reads a knowledge base with another file name when its id matches", () => {
			const r = golden({
				"apps/fixture/kb/other-name.yaml": FIXTURE_KB_TEXT,
				[MAIN]: fullYaml,
			});

			expect(r.exitCode).toBe(0);
		});
	});

	describe("scenario errors", () => {
		it("reports a fit error and still runs the other scenarios", () => {
			const text = fullYaml.replace("claimed: 100\n", "claimed: ten\n");
			const r = golden({ ...GOOD, [MAIN]: text });

			expect(r.exitCode).toBe(1);
			expect(r.lines.some((l) => l.includes("BAD_VALUE [G-2]"))).toBe(true);
			expect(r.lines.at(-1)).toMatch(
				/^1 files, 11 scenarios run, 11 passed, 10 of 11 rules covered, 2 errors, 0 warnings$/,
			);
		});

		it("reports a duplicate id across two files and runs the earlier scenario only", () => {
			const second = goldenYaml({
				kb: "fixture",
				scenarios: scenarios.slice(0, 1),
			});
			const r = golden({ ...GOOD, "apps/fixture/golden/second.yaml": second });

			expect(r.exitCode).toBe(1);
			expect(r.lines).toContain(
				"apps/fixture/golden/second.yaml: error DUPLICATE_SCENARIO [G-1] Scenario id 'G-1' is already used by scenario 1 of apps/fixture/golden/main.yaml.",
			);
			expect(r.lines.at(-1)).toBe(
				"2 files, 12 scenarios run, 12 passed, 11 of 11 rules covered, 1 errors, 0 warnings",
			);
		});

		it("reports an engine error and carries on", () => {
			const text = fullYaml.replace("age: 65\n", "age: 65\n      ghost: 1\n");
			const r = golden({ ...GOOD, [MAIN]: text });

			expect(r.lines.some((l) => l.includes("UNKNOWN_FACT [G-1]"))).toBe(true);
		});
	});

	describe("coverage", () => {
		const without = (rule: string) =>
			goldenYaml({
				kb: "fixture",
				scenarios: scenarios.filter(
					(s) => !("goals" in s.expect && s.expect.fires?.includes(rule)),
				),
			});

		it("reports a rule that no passing scenario fires as an error on the KB file", () => {
			const r = golden({ ...GOOD, [MAIN]: without("VER-01") });

			expect(r.exitCode).toBe(1);
			expect(r.lines).toContain(
				`${KB}: error RULE_NOT_COVERED [PAY-01] No passing scenario fires rule 'PAY-01'.`,
			);
			expect(r.lines).toContain(
				`${KB}: error RULE_NOT_COVERED [VER-01] No passing scenario fires rule 'VER-01'.`,
			);
			expect(r.lines.at(-1)).toMatch(/9 of 11 rules covered, 2 errors/);
		});

		it("warns below twelve scenarios, and still exits 0 when every rule is covered", () => {
			const eleven = goldenYaml({
				kb: "fixture",
				scenarios: scenarios.slice(0, 11),
			});
			const r = golden({ ...GOOD, [MAIN]: eleven });

			expect(r.lines).toEqual([
				`${KB}: warning TOO_FEW_SCENARIOS Knowledge base 'fixture' has 11 scenarios; the build plan asks for at least 12.`,
				"1 files, 11 scenarios run, 11 passed, 11 of 11 rules covered, 0 errors, 1 warnings",
			]);
			expect(r.exitCode).toBe(0);
		});

		it("computes coverage for an app directory and not for a single file path", () => {
			const files = { ...GOOD, [MAIN]: without("VER-01") };

			const dir = golden(files, "apps/fixture");
			expect(dir.exitCode).toBe(1);
			expect(dir.lines.some((l) => l.includes("RULE_NOT_COVERED"))).toBe(true);

			const kept = scenarios.filter(
				(s) => !("goals" in s.expect && s.expect.fires?.includes("VER-01")),
			).length;
			const one = golden(files, MAIN);
			expect(one.exitCode).toBe(0);
			expect(one.stdout).toBe(
				`1 files, ${kept} scenarios run, ${kept} passed, 0 of 0 rules covered, 0 errors, 1 warnings\n`.replace(
					", 1 warnings",
					", 0 warnings",
				),
			);

			const both = golden(files, MAIN, "apps/fixture");
			expect(both.lines.some((l) => l.includes("RULE_NOT_COVERED"))).toBe(true);
		});

		it("takes nothing from a failed scenario", () => {
			const broken = fullYaml.replace("verdict: denied", "verdict: paid");
			const r = golden({ ...GOOD, [MAIN]: broken });

			expect(r.exitCode).toBe(1);
			expect(r.lines.some((l) => l.includes("RULE_NOT_COVERED"))).toBe(true);
		});
	});

	describe("nothing to run, and usage", () => {
		it("prints the all-zero summary and exits 0 with no golden file", () => {
			const r = golden({ [KB]: FIXTURE_KB_TEXT });

			expect(r.exitCode).toBe(0);
			expect(r.stdout).toBe(`${SUMMARY_EMPTY}\n`);
		});

		it("prints the all-zero summary on a tree with no apps", () => {
			expect(golden({}).stdout).toBe(`${SUMMARY_EMPTY}\n`);
		});

		it("exits 2 with the usage text for a path that matches no golden file", () => {
			const r = golden(GOOD, "apps/fixture/golden/missing.yaml");

			expect(r.exitCode).toBe(2);
			expect(r.stdout).toBe("");
			expect(r.stderr).toContain(
				"dc: 'apps/fixture/golden/missing.yaml' matches no golden file",
			);
			expect(r.stderr).toContain("Usage:");
		});

		it("exits 2 for --json", () => {
			const r = golden(GOOD, "--json");

			expect(r.exitCode).toBe(2);
			expect(r.stderr).toContain("dc: malformed argument '--json'.");
		});

		it("leaves dc validate alone: it ignores the golden file", () => {
			const r = runCli(["validate"], host(GOOD));

			expect(r.stdout).toMatch(/^1 files checked, /m);
		});
	});

	describe("order", () => {
		it("prints scenario diagnostics by file, then by scenario position, then coverage", () => {
			const a = goldenYaml({
				kb: "fixture",
				scenarios: scenarios.slice(0, 2),
			}).replace(/payable_amount: \d+/g, "payable_amount: 1");
			const b = goldenYaml({
				kb: "fixture",
				scenarios: scenarios.slice(2, 4),
			}).replace(/payable_amount: \d+/g, "payable_amount: 1");
			const r = golden({
				[KB]: FIXTURE_KB_TEXT,
				"apps/fixture/golden/b.yaml": b,
				"apps/fixture/golden/a.yaml": a,
			});
			const files = r.lines.slice(0, -1).map((l) => l.slice(0, l.indexOf(":")));
			const ids = r.lines
				.filter((l) => l.includes("SCENARIO_FAILED"))
				.map((l) => /\[(G-\d+)\]/.exec(l)?.[1]);

			expect(ids).toEqual(["G-1", "G-2", "G-3", "G-4"]);
			expect(files.indexOf(KB)).toBeGreaterThan(
				files.lastIndexOf("apps/fixture/golden/b.yaml"),
			);
		});
	});
});
