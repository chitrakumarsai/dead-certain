import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkGolden } from "../golden/check";
import { loadGoldenRaw } from "../golden/load";
import { runGolden } from "../golden/run";
import { runCli } from "../index";
import {
	FIXTURE_KB_TEXT,
	fixtureKb,
	goldenSetArb,
	goldenYaml,
	memoryHost,
	treeArb,
} from "../testkit";
import type { Host } from "./host";

const WORKSPACE = "packages:\n  - apps/*\n";
const kb = fixtureKb();

/** A host that fails the test if anything is written. */
function readOnly(inner: ReturnType<typeof memoryHost>): {
	host: Host;
	attempts: string[];
} {
	const attempts: string[] = [];
	return {
		attempts,
		host: {
			readFile: (p) => inner.readFile(p),
			readDir: (p) => inner.readDir(p),
			stat: (p) => inner.stat(p),
			cwd: () => inner.cwd(),
			writeFile: (p) => {
				attempts.push(`writeFile ${p}`);
				throw new Error("writeFile must not be called");
			},
			makeDir: (p) => {
				attempts.push(`makeDir ${p}`);
				throw new Error("makeDir must not be called");
			},
		},
	};
}

/** The fixture knowledge base with one to three golden files of recorded scenarios, some broken. */
const treeWithGoldenArb = fc
	.tuple(
		fc.array(goldenSetArb(kb), { minLength: 1, maxLength: 3 }),
		fc.array(
			fc.constantFrom("", "payable_amount: 1", "kb: nope", "claimed: ten"),
			{
				minLength: 3,
				maxLength: 3,
			},
		),
	)
	.map(([sets, breaks]) => {
		const files: Record<string, string> = {
			"pnpm-workspace.yaml": WORKSPACE,
			"apps/fixture/kb/fixture.yaml": FIXTURE_KB_TEXT,
		};
		sets.forEach((set, i) => {
			let text = goldenYaml(set);
			const broken = breaks[i] ?? "";
			if (broken === "payable_amount: 1") {
				text = text.replace(/payable_amount: \d+/, "payable_amount: 1");
			} else if (broken === "kb: nope") {
				text = text.replace("kb: fixture", "kb: nope");
			} else if (broken === "claimed: ten") {
				text = text.replace(/claimed: -?\d+/, "claimed: ten");
			}
			files[`apps/fixture/golden/f${i + 1}.yaml`] = text;
		});
		return files;
	});

describe("Property 6: Golden files do not change validation (command part)", () => {
	// Feature: kb-golden, Property 6: Golden files do not change validation
	/** **Validates: Requirements 1.2, 1.3, 11.6** */
	it("gives validate and build the same output, exit code and writes with golden files added", () => {
		fc.assert(
			fc.property(
				treeArb,
				fc.array(fc.string({ maxLength: 40 }), { maxLength: 3 }),
				(tree, texts) => {
					const golden: Record<string, string> = {};
					texts.forEach((text, i) => {
						golden[`apps/demo/golden/g${i}.yaml`] = text;
					});
					const plus = { ...tree, files: { ...tree.files, ...golden } };
					for (const command of ["validate", "build"] as const) {
						const before = memoryHost(tree);
						const after = memoryHost(plus);
						const a = runCli([command], before);
						const b = runCli([command], after);

						expect(b).toEqual(a);
						expect(after.writes).toEqual(before.writes);
						expect(after.madeDirs).toEqual(before.madeDirs);
					}
				},
			),
			{ numRuns: 150 },
		);
	});
});

describe("Property 8: Deterministic and pure (command part)", () => {
	// Feature: kb-golden, Property 8: Deterministic and pure
	/** **Validates: Requirements 1.5, 8.7** */
	it("never calls writeFile or makeDir, and returns the same result twice", () => {
		fc.assert(
			fc.property(treeWithGoldenArb, (files) => {
				const a = readOnly(memoryHost({ root: "/repo", files, dirs: [] }));
				const b = readOnly(memoryHost({ root: "/repo", files, dirs: [] }));
				const first = runCli(["golden"], a.host);
				const second = runCli(["golden"], b.host);

				expect(second).toEqual(first);
				expect(a.attempts).toEqual([]);
				expect(b.attempts).toEqual([]);
			}),
			{ numRuns: 100 },
		);
	});
});

describe("Property 10: Output is stable", () => {
	// Feature: kb-golden, Property 10: Output is stable
	/** **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6** */
	it("prints the same lines in the documented order whatever order the host lists directories in", () => {
		fc.assert(
			fc.property(
				treeWithGoldenArb,
				fc.integer({ min: 0, max: 0xffffffff }),
				(files, seed) => {
					const sorted = runCli(
						["golden"],
						memoryHost({ root: "/repo", files, dirs: [] }),
					);
					const shuffled = runCli(
						["golden"],
						memoryHost(
							{ root: "/repo", files, dirs: [] },
							{ shuffleSeed: seed },
						),
					);

					expect(shuffled).toEqual(sorted);

					const lines = sorted.stdout.trimEnd().split("\n");
					const summary = lines.at(-1) ?? "";
					expect(summary).toMatch(
						/^\d+ files, \d+ scenarios run, \d+ passed, \d+ of \d+ rules covered, \d+ errors, \d+ warnings$/,
					);
					const body = lines.slice(0, -1);
					// A clean run prints only the summary line.
					if (sorted.exitCode === 0 && !summary.endsWith(" 1 warnings")) {
						expect(body.filter((l) => !l.includes(" warning "))).toEqual([]);
					}
					// Golden-file lines come first, in file path order; knowledge-base lines after.
					const fileOf = (l: string) => l.slice(0, l.indexOf(": "));
					const golden = body.filter((l) => fileOf(l).includes("/golden/"));
					const kbLines = body.filter((l) => fileOf(l).includes("/kb/"));
					expect(body).toEqual([...golden, ...kbLines]);
					expect(golden.map(fileOf)).toEqual([...golden.map(fileOf)].sort());
					// No absolute path, colour code, timestamp or duration.
					const text = sorted.stdout;
					expect(text).not.toContain("/repo");
					// biome-ignore lint/suspicious/noControlCharactersInRegex: looking for ANSI escapes
					expect(text).not.toMatch(/\u001b\[/);
					expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T|\d+ ?ms\b/);
				},
			),
			{ numRuns: 100 },
		);
	});
});

describe("Property 7: Total (checker, runner and command part)", () => {
	// Feature: kb-golden, Property 7: Total
	/** **Validates: Requirements 10.3, 10.4** */
	const factNames = [
		...Object.keys(kb.facts),
		"ghost",
		"constructor",
		"__proto__",
	];
	const valueArb = fc.oneof(
		fc.boolean(),
		fc.integer(),
		fc.double(),
		fc.string({ maxLength: 12 }),
		fc.constant(null),
	);
	const factsArb = fc.array(fc.tuple(fc.constantFrom(...factNames), valueArb), {
		maxLength: 6,
	});
	const scenarioRawArb = fc
		.tuple(
			fc.constantFrom("consult", "audit"),
			factsArb,
			fc.array(fc.tuple(fc.constantFrom(...factNames), valueArb), {
				maxLength: 4,
			}),
			fc.array(fc.constantFrom(...factNames, "CAP-01", "R-9"), {
				maxLength: 3,
			}),
			fc.option(fc.constantFrom(...factNames), { nil: undefined }),
		)
		.map(([mode, facts, goals, fires, ask]) => ({
			id: "G-0",
			title: "t",
			mode,
			facts: Object.fromEntries(facts),
			expect:
				ask !== undefined && mode === "consult"
					? { ask }
					: { goals: Object.fromEntries(goals), fires },
		}));

	it("never throws, and returns one result per runnable scenario", () => {
		fc.assert(
			fc.property(
				fc.array(scenarioRawArb, { minLength: 1, maxLength: 4 }),
				(scenarios) => {
					const loaded = loadGoldenRaw(
						{
							kb: "fixture",
							scenarios: scenarios.map((s, i) => ({ ...s, id: `G-${i}` })),
						},
						"apps/fixture/golden/main.yaml",
					);
					if (!loaded.ok) return;
					const checked = checkGolden(loaded.set, kb, "f.yaml");
					const run = runGolden(kb, checked.runnable, "f.yaml");

					expect(run.results).toHaveLength(checked.runnable.length);
				},
			),
			{ numRuns: 300 },
		);
	});

	it("runs dc golden on arbitrary golden file text without throwing", () => {
		fc.assert(
			fc.property(
				fc.oneof(
					fc.string({ maxLength: 200 }),
					fc.constantFrom("kb: fixture\n", "- a\n", "{", "\u0000", ""),
				),
				(text) => {
					const host = memoryHost({
						root: "/repo",
						files: {
							"pnpm-workspace.yaml": WORKSPACE,
							"apps/fixture/kb/fixture.yaml": FIXTURE_KB_TEXT,
							"apps/fixture/golden/main.yaml": text,
						},
						dirs: [],
					});
					const result = runCli(["golden"], host);

					expect([0, 1]).toContain(result.exitCode);
				},
			),
			{ numRuns: 300 },
		);
	});
});
