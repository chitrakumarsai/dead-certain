// @ts-expect-error TS2591: no type definitions for node:child_process
import { spawnSync } from "node:child_process";
// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { type Plan, planFor } from "./new-app/plan.ts";

// The real Template, planned for a fixed name and linted where it lands
// (design: "The Template is tested in place before it is copied").
const ROOT = new URL("../", import.meta.url).pathname as string;
const TEMPLATE = `${ROOT}templates/app/`;
const read = (p: string) => fs.readFileSync(p, "utf8") as string;

const templateFiles = (
	fs.readdirSync(TEMPLATE, { recursive: true }) as string[]
)
	.map((p) => p.replaceAll("\\", "/"))
	.filter((p) => fs.statSync(`${TEMPLATE}${p}`).isFile())
	.sort()
	.map((path) => ({ path, text: read(`${TEMPLATE}${path}`) }));

const plan = planFor(
	{
		templateFiles,
		playwright: read(`${ROOT}playwright.config.ts`),
		ci: read(`${ROOT}.github/workflows/ci.yml`),
		existingApps: ["claim-check", "pre-flight", "site"],
		packageNames: [],
	},
	"lint-probe",
) as Plan;

const tmp = fs.mkdtempSync("/tmp/template-lint-") as string;
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("the Template", () => {
	it("plans without a refusal", () => {
		expect("create" in plan, JSON.stringify(plan)).toBe(true);
	});

	it("leaves no Placeholder and names no Reference_App (3.6, 3.8)", () => {
		const left = plan.create
			.filter((f) =>
				/__APP_|claim-check|pre-flight|Claim Check|Pre-Flight/.test(f.text),
			)
			.map((f) => f.path);
		expect(left).toEqual([]);
	});

	it("passes Biome after substitution (3.4)", () => {
		const config = JSON.parse(read(`${ROOT}biome.json`));
		config.vcs = { enabled: false };
		fs.writeFileSync(`${tmp}/biome.json`, JSON.stringify(config));
		for (const f of plan.create) {
			const to = `${tmp}/${f.path}`;
			fs.mkdirSync(to.slice(0, to.lastIndexOf("/")), { recursive: true });
			fs.writeFileSync(to, f.text);
		}
		const run = spawnSync(
			`${ROOT}node_modules/.bin/biome`,
			["check", "apps", "e2e"],
			{
				cwd: tmp,
				encoding: "utf8",
			},
		) as { status: number; stdout: string; stderr: string };
		expect(run.status, run.stdout + run.stderr).toBe(0);
	});
});
