// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextPort } from "./markers.ts";
import { planFor } from "./plan.ts";
import { formatPlan, nextSteps } from "./print.ts";

const read = (p: string) =>
	readFileSync(new URL(`../../${p}`, import.meta.url), "utf8") as string;
// The next free port in the real file: 4176 today, more after a scaffold.
const PORT = nextPort(read("playwright.config.ts"));
const plan = planFor(
	{
		templateFiles: [
			{
				path: "package.json",
				text: '{ "name": "@dead-certain/__APP_NAME__" }\n',
			},
			{ path: "e2e/smoke.spec.ts", text: "// __APP_NAME__\n" },
		],
		playwright: read("playwright.config.ts"),
		ci: read(".github/workflows/ci.yml"),
		existingApps: ["claim-check", "pre-flight", "site"],
		packageNames: [],
	},
	"loan-check",
);
if (!("create" in plan)) throw new Error(plan.message);

describe("nextSteps (1.6)", () => {
	it("holds the three commands, in order, and the address", () => {
		const text = nextSteps(plan);
		const at = (s: string) => text.indexOf(s);
		expect(at("pnpm install")).toBeGreaterThan(-1);
		expect(at("pnpm --filter @dead-certain/loan-check dev")).toBeGreaterThan(
			at("pnpm install"),
		);
		expect(
			at("pnpm exec playwright test e2e/loan-check-smoke.spec.ts"),
		).toBeGreaterThan(at("pnpm --filter @dead-certain/loan-check dev"));
		expect(text).toContain(`http://localhost:${PORT}/dead-certain/loan-check/`);
		expect(text).not.toMatch(/!/);
	});
});

describe("formatPlan (1.4)", () => {
	it("lists every file to create, every line to insert, and the port", () => {
		const text = formatPlan(plan);
		for (const f of plan.create) expect(text).toContain(f.path);
		for (const e of plan.edits)
			for (const line of e.inserted) expect(text).toContain(line.trim());
		expect(text).toContain(`${PORT}`);
		expect(text).toMatch(/^Dry run/);
	});
});
