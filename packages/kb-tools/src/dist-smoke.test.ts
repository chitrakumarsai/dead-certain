// Dist smoke test (task 14.2). The bundle tree-shakes the engine, so `audit` is
// not in dist/dc.mjs; the engine's audit is run from source on the JSON that the
// bundled CLI compiled instead.
// @ts-expect-error TS2591: no type definitions for node:child_process
import { spawnSync } from "node:child_process";
// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:os
import { tmpdir } from "node:os";
// @ts-expect-error TS2591: no type definitions for node:path
import { dirname, join } from "node:path";
// @ts-expect-error TS2591: no type definitions for node:url
import { fileURLToPath } from "node:url";
import { audit, type KnowledgeBase } from "@dead-certain/engine";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNodeHost } from "./cli/host-node";
import { runCli } from "./index";

declare const process: { execPath: string };

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const toyYaml = fs.readFileSync(
	join(pkgDir, "fixtures", "toy-money.yaml"),
	"utf8",
) as string;
const BAD_YAML = "id: bad\ngoals: [nope]\nfacts: {}\nrules: []\nclauses: {}\n";

const temps: string[] = [];
function makeTemp(label: string): string {
	const dir = fs.mkdtempSync(join(tmpdir(), `dc-smoke-${label}-`)) as string;
	temps.push(dir);
	return dir;
}

/** A repository tree: workspace marker plus apps/<app>/kb/<name>.yaml files. */
function makeTree(files: Record<string, string>): string {
	const root = makeTemp("tree");
	fs.writeFileSync(
		join(root, "pnpm-workspace.yaml"),
		"packages:\n  - apps/*\n",
	);
	for (const [rel, text] of Object.entries(files)) {
		const file = join(root, rel);
		fs.mkdirSync(dirname(file), { recursive: true });
		fs.writeFileSync(file, text);
	}
	return root;
}

function runBundle(bundle: string, cwd: string, args: string[]) {
	const r = spawnSync(process.execPath, [bundle, ...args], {
		cwd,
		encoding: "utf8",
	}) as { status: number; stdout: string; stderr: string };
	return { exitCode: r.status, stdout: r.stdout, stderr: r.stderr };
}

function runSource(cwd: string, args: string[]) {
	return runCli(args, { ...createNodeHost(), cwd: () => cwd });
}

let outDir = "";
let bundlePath = "";
let bundleText = "";

beforeAll(async () => {
	outDir = makeTemp("out");
	// The bundle keeps `zod` and `yaml` as bare imports; link the package's
	// node_modules so they resolve from the temporary directory.
	fs.symlinkSync(
		join(pkgDir, "node_modules"),
		join(outDir, "node_modules"),
		"dir",
	);
	await build({
		root: pkgDir,
		configFile: join(pkgDir, "vite.config.ts"),
		logLevel: "silent",
		build: { outDir: join(outDir, "dist"), emptyOutDir: true },
	});
	bundlePath = join(outDir, "dist", "dc.mjs");
	bundleText = fs.readFileSync(bundlePath, "utf8") as string;
}, 60_000);

afterAll(() => {
	for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});

describe("dist smoke test", () => {
	it("keeps zod and yaml external and inlines the engine", () => {
		expect(bundleText).toMatch(/^import [^\n]*from "zod";$/m);
		expect(bundleText).toMatch(/^import [^\n]*from "yaml";$/m);
		expect(bundleText).not.toContain("@dead-certain/engine");
		// Engine source is inlined: its parser entry point is in the bundle.
		expect(bundleText).toMatch(/function parse\(/);
		expect(fs.existsSync(join(outDir, "dist", "dc.mjs.map"))).toBe(true);
	});

	it("validates a toy tree exactly like runCli on the source", () => {
		const files = {
			"apps/demo/kb/toy.yaml": toyYaml,
			"apps/demo/kb/bad.yaml": BAD_YAML,
		};
		const bundled = runBundle(bundlePath, makeTree(files), ["validate"]);
		const source = runSource(makeTree(files), ["validate"]);
		expect(bundled.exitCode).toBe(1);
		expect(bundled).toEqual(source);
		const good = { "apps/demo/kb/toy.yaml": toyYaml };
		const okBundled = runBundle(bundlePath, makeTree(good), ["validate"]);
		const okSource = runSource(makeTree(good), ["validate"]);
		expect(okBundled.exitCode).toBe(0);
		expect(okBundled).toEqual(okSource);
	}, 60_000);

	it("builds the same JSON as the source, and the engine audits it", () => {
		const files = { "apps/demo/kb/toy.yaml": toyYaml };
		const rootA = makeTree(files);
		const rootB = makeTree(files);
		const bundled = runBundle(bundlePath, rootA, ["build"]);
		const source = runSource(rootB, ["build"]);
		expect(bundled.exitCode).toBe(0);
		expect(bundled).toEqual(source);
		const rel = join("apps", "demo", "kb", "dist", "toy.json");
		const jsonA = fs.readFileSync(join(rootA, rel), "utf8") as string;
		const jsonB = fs.readFileSync(join(rootB, rel), "utf8") as string;
		expect(jsonA).toBe(jsonB);

		const kb = JSON.parse(jsonA) as KnowledgeBase;
		const verdict = audit(kb, { sum_insured: 100000 });
		expect(verdict.goals.payable).toBe(1000);
		expect(verdict.needed).toEqual([]);
	}, 60_000);

	it("runs golden scenarios like runCli on the source: a passing and a failing file", () => {
		const passing = [
			"kb: toy-money",
			"scenarios:",
			"  - id: G-1",
			"    title: One percent of the sum insured",
			"    mode: audit",
			"    facts: { sum_insured: 100000 }",
			"    expect:",
			"      goals: { payable: 1000 }",
			"      fires: [R-1]",
			"",
		].join("\n");
		const failing = passing.replace("payable: 1000", "payable: 999");
		const base = { "apps/demo/kb/toy.yaml": toyYaml };
		const path = "apps/demo/golden/main.yaml";

		const okFiles = { ...base, [path]: passing };
		const okBundled = runBundle(bundlePath, makeTree(okFiles), [
			"golden",
			path,
		]);
		const okSource = runSource(makeTree(okFiles), ["golden", path]);
		expect(okBundled.exitCode).toBe(0);
		expect(okBundled.stdout).toBe(
			"1 files, 1 scenarios run, 1 passed, 0 of 0 rules covered, 0 errors, 0 warnings\n",
		);
		expect(okBundled).toEqual(okSource);

		// A whole-app run adds the coverage and the too-few warning: one rule, covered.
		const whole = runBundle(bundlePath, makeTree(okFiles), ["golden"]);
		expect(whole.exitCode).toBe(0);
		expect(whole.stdout).toContain("TOO_FEW_SCENARIOS");
		expect(whole.stdout).toContain("1 of 1 rules covered");

		const badFiles = { ...base, [path]: failing };
		const badBundled = runBundle(bundlePath, makeTree(badFiles), [
			"golden",
			path,
		]);
		const badSource = runSource(makeTree(badFiles), ["golden", path]);
		expect(badBundled.exitCode).toBe(1);
		expect(badBundled.stdout).toContain(
			`${path}: error SCENARIO_FAILED [G-1] Scenario 'G-1' (One percent of the sum insured) failed: goals.payable expected 999, observed 1000`,
		);
		expect(badBundled).toEqual(badSource);
	}, 60_000);

	it("keeps dc validate and dc build blind to golden files", () => {
		const files = {
			"apps/demo/kb/toy.yaml": toyYaml,
			"apps/demo/golden/main.yaml": "this: is not: a knowledge base\n",
		};
		const root = makeTree(files);
		const validate = runBundle(bundlePath, root, ["validate"]);
		const build = runBundle(bundlePath, root, ["build"]);

		expect(validate.exitCode).toBe(0);
		expect(validate.stdout).toBe("1 files checked, 0 errors, 0 warnings\n");
		expect(build.exitCode).toBe(0);
		expect(fs.existsSync(join(root, "apps", "demo", "golden", "dist"))).toBe(
			false,
		);
		expect(
			fs.existsSync(join(root, "apps", "demo", "kb", "dist", "toy.json")),
		).toBe(true);
	}, 60_000);

	it("shim without dist/dc.mjs prints the build instruction and exits 2", () => {
		const shimDir = makeTemp("shim");
		fs.mkdirSync(join(shimDir, "bin"));
		const shim = join(shimDir, "bin", "dc.mjs");
		fs.copyFileSync(join(pkgDir, "bin", "dc.mjs"), shim);
		const r = runBundle(shim, shimDir, []);
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toBe(
			'dist/dc.mjs is missing: run "pnpm --filter @dead-certain/kb-tools build"\n',
		);
		expect(r.stdout).toBe("");
	});
});
