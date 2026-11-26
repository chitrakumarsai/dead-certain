// @ts-expect-error TS2591: no type definitions for node:child_process
import { spawnSync } from "node:child_process";
// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = new URL("../", import.meta.url).pathname as string;
const dirs: string[] = [];

/** A temporary copy of the repository's top level, with a small Template, for running the script for real. */
function sandbox(): string {
	const tmp = fs.mkdtempSync("/tmp/new-app-") as string;
	dirs.push(tmp);
	for (const f of [
		"pnpm-workspace.yaml",
		"package.json",
		"playwright.config.ts",
	])
		fs.cpSync(`${ROOT}${f}`, `${tmp}/${f}`);
	fs.mkdirSync(`${tmp}/.github/workflows`, { recursive: true });
	fs.cpSync(
		`${ROOT}.github/workflows/ci.yml`,
		`${tmp}/.github/workflows/ci.yml`,
	);
	fs.cpSync(`${ROOT}scripts`, `${tmp}/scripts`, { recursive: true });
	fs.mkdirSync(`${tmp}/packages/ui/src`, { recursive: true });
	fs.cpSync(`${ROOT}packages/ui/src/site.ts`, `${tmp}/packages/ui/src/site.ts`);
	for (const app of ["claim-check", "pre-flight", "site"]) {
		fs.mkdirSync(`${tmp}/apps/${app}`, { recursive: true });
		fs.writeFileSync(
			`${tmp}/apps/${app}/package.json`,
			JSON.stringify({ name: `@dead-certain/${app}` }),
		);
	}
	fs.mkdirSync(`${tmp}/templates/app/src`, { recursive: true });
	fs.mkdirSync(`${tmp}/templates/app/e2e`, { recursive: true });
	fs.writeFileSync(
		`${tmp}/templates/app/package.json`,
		'{ "name": "@dead-certain/__APP_NAME__" }\n',
	);
	fs.writeFileSync(`${tmp}/templates/app/src/main.tsx`, "// __APP_TITLE__\n");
	fs.writeFileSync(
		`${tmp}/templates/app/e2e/smoke.spec.ts`,
		'const URL = "http://localhost:__APP_PORT__/dead-certain/__APP_NAME__/";\n',
	);
	return tmp;
}

const run = (cwd: string, ...args: string[]) =>
	spawnSync(
		"node",
		[
			"--experimental-strip-types",
			"--no-warnings",
			`${cwd}/scripts/new-app.ts`,
			...args,
		],
		{ cwd, encoding: "utf8" },
	) as {
		status: number;
		stdout: string;
		stderr: string;
	};

afterEach(() => {
	for (const d of dirs.splice(0))
		fs.rmSync(d, { recursive: true, force: true });
});

describe("pnpm new-app, run for real", () => {
	it("creates the app, edits the three shared files and prints the steps (1.3, 1.6, 13.2)", () => {
		const tmp = sandbox();
		const r = run(tmp, "loan-check");
		expect(r.status, r.stderr).toBe(0);
		expect(
			fs.readFileSync(`${tmp}/apps/loan-check/package.json`, "utf8"),
		).toContain("@dead-certain/loan-check");
		expect(
			fs.readFileSync(`${tmp}/apps/loan-check/src/main.tsx`, "utf8"),
		).toContain("Loan Check");
		expect(fs.existsSync(`${tmp}/e2e/loan-check-smoke.spec.ts`)).toBe(true);
		expect(fs.readFileSync(`${tmp}/playwright.config.ts`, "utf8")).toContain(
			"LOAN_CHECK_URL",
		);
		expect(
			fs.readFileSync(`${tmp}/.github/workflows/ci.yml`, "utf8"),
		).toContain("pnpm dc build apps/loan-check");
		expect(fs.readFileSync(`${tmp}/packages/ui/src/site.ts`, "utf8")).toContain(
			'\tloanCheck: {\n\t\tpath: "loan-check/",',
		);
		expect(r.stdout).toContain("pnpm --filter @dead-certain/loan-check dev");
	});

	it("changes nothing with --dry-run, and prints the plan (1.4)", () => {
		const tmp = sandbox();
		const pw = fs.readFileSync(`${tmp}/playwright.config.ts`, "utf8");
		const site = fs.readFileSync(`${tmp}/packages/ui/src/site.ts`, "utf8");
		const r = run(tmp, "loan-check", "--dry-run");
		expect(r.status).toBe(0);
		expect(r.stdout).toMatch(/^Dry run/);
		expect(fs.existsSync(`${tmp}/apps/loan-check`)).toBe(false);
		expect(fs.readFileSync(`${tmp}/playwright.config.ts`, "utf8")).toBe(pw);
		expect(fs.readFileSync(`${tmp}/packages/ui/src/site.ts`, "utf8")).toBe(
			site,
		);
		expect(r.stdout).toContain("Lines to insert in packages/ui/src/site.ts:");
	});

	it("refuses a taken name with exit 1 and changes nothing (2.3)", () => {
		const tmp = sandbox();
		const before = fs.readdirSync(`${tmp}/apps`);
		const r = run(tmp, "claim-check");
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("claim-check");
		expect(fs.readdirSync(`${tmp}/apps`)).toEqual(before);
	});

	it("prints the usage with exit 2 for bad arguments (1.5)", () => {
		const tmp = sandbox();
		const r = run(tmp);
		expect(r.status).toBe(2);
		expect(r.stderr).toContain("Usage: pnpm new-app <name> [--dry-run]");
	});

	it("finds the root from an app folder (1.8)", () => {
		const tmp = sandbox();
		const r = spawnSync(
			"node",
			[
				"--experimental-strip-types",
				"--no-warnings",
				`${tmp}/scripts/new-app.ts`,
				"loan-check",
				"--dry-run",
			],
			{ cwd: `${tmp}/apps/claim-check`, encoding: "utf8" },
		) as { status: number; stderr: string };
		expect(r.status, r.stderr).toBe(0);
	});
});
