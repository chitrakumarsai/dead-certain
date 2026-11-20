// @ts-expect-error TS2591: no type definitions for node:child_process
import { spawnSync } from "node:child_process";
// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = new URL("../", import.meta.url).pathname as string;
const tmp = fs.mkdtempSync("/tmp/new-app-props-") as string;
for (const f of ["pnpm-workspace.yaml", "package.json", "playwright.config.ts"])
	fs.cpSync(`${ROOT}${f}`, `${tmp}/${f}`);
fs.mkdirSync(`${tmp}/.github/workflows`, { recursive: true });
fs.cpSync(`${ROOT}.github/workflows/ci.yml`, `${tmp}/.github/workflows/ci.yml`);
fs.cpSync(`${ROOT}scripts`, `${tmp}/scripts`, { recursive: true });
fs.mkdirSync(`${tmp}/apps/claim-check`, { recursive: true });
fs.writeFileSync(
	`${tmp}/apps/claim-check/package.json`,
	'{ "name": "@dead-certain/claim-check" }',
);
fs.mkdirSync(`${tmp}/templates/app/e2e`, { recursive: true });
fs.writeFileSync(
	`${tmp}/templates/app/package.json`,
	'{ "name": "@dead-certain/__APP_NAME__" }\n',
);
fs.writeFileSync(`${tmp}/templates/app/e2e/smoke.spec.ts`, "// __APP_NAME__\n");

/** Every file under the sandbox with its text, to compare before and after. */
const snapshot = () =>
	(fs.readdirSync(tmp, { recursive: true }) as string[])
		.filter((p) => fs.statSync(`${tmp}/${p}`).isFile())
		.sort()
		.map((p) => [p, fs.readFileSync(`${tmp}/${p}`, "utf8")]);

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("new-app properties", () => {
	it("a dry run changes nothing", () => {
		// Feature: app-template, Property 7: Dry run changes nothing
		const before = snapshot();
		const nameArb = fc.oneof(
			fc.stringMatching(/^[a-z][a-z0-9]{1,6}(-[a-z0-9]{1,4})?$/),
			fc.constantFrom("claim-check", "kit", "A", "a"),
		);
		fc.assert(
			fc.property(nameArb, (name) => {
				const r = spawnSync(
					"node",
					[
						"--experimental-strip-types",
						"--no-warnings",
						`${tmp}/scripts/new-app.ts`,
						name,
						"--dry-run",
					],
					{
						cwd: tmp,
						encoding: "utf8",
					},
				) as { status: number };
				expect([0, 1]).toContain(r.status);
				expect(snapshot()).toEqual(before);
			}),
			{ numRuns: 100 },
		);
	}, 120_000);
});
