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
