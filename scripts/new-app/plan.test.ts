// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextPort } from "./markers.ts";
import { type Inputs, planFor } from "./plan.ts";
import { substitute } from "./substitute.ts";

const read = (p: string) =>
	readFileSync(new URL(`../../${p}`, import.meta.url), "utf8") as string;
// The next free port in the real file: 4176 today, more after a scaffold.
const PORT = nextPort(read("playwright.config.ts"));

/** A small Template, standing in for templates/app until task 4 makes it. */
const FIXTURE = [
	{ path: "package.json", text: '{ "name": "@dead-certain/__APP_NAME__" }\n' },
	{
		path: "vite.config.ts",
		text: 'export default { base: "/dead-certain/__APP_NAME__/" };\n',
	},
	{ path: "index.html", text: "<title>__APP_TITLE__</title>\n" },
	{
		path: "src/config.ts",
		text: "// __APP_SLUG_CONST__\nexport const config = {};\n",
	},
	{
		path: "e2e/smoke.spec.ts",
		text: 'const URL = "http://localhost:__APP_PORT__/dead-certain/__APP_NAME__/";\n',
	},
];

const inputs = (over: Partial<Inputs> = {}): Inputs => ({
	templateFiles: FIXTURE,
	playwright: read("playwright.config.ts"),
	ci: read(".github/workflows/ci.yml"),
	site: read("packages/ui/src/site.ts"),
	existingApps: ["claim-check", "pre-flight", "site"],
	packageNames: [
		"@dead-certain/claim-check",
		"@dead-certain/pre-flight",
		"@dead-certain/site",
		"@dead-certain/ui",
	],
	...over,
});

describe("substitute", () => {
	it("replaces every placeholder, and refuses an unknown one (3.3, 3.6)", () => {
		const values = {
			NAME: "loan-check",
			TITLE: "Loan Check",
			SLUG_CONST: "LOAN_CHECK",
			PORT: "4176",
		};
		expect(
			substitute(
				"__APP_NAME__ __APP_TITLE__ __APP_SLUG_CONST__ __APP_PORT__",
				values,
			),
		).toEqual({
			ok: true,
			text: "loan-check Loan Check LOAN_CHECK 4176",
		});
		expect(substitute("x __APP_COLOUR__ y", values)).toEqual({
			ok: false,
			token: "__APP_COLOUR__",
		});
	});
});

describe("planFor", () => {
	it("maps the files, substitutes them, and leaves no __APP_ (3.2, 3.6)", () => {
		const plan = planFor(inputs(), "loan-check");
		if (!("create" in plan)) throw new Error(plan.message);
		expect(plan).toMatchObject({
			name: "loan-check",
			title: "Loan Check",
			slugConst: "LOAN_CHECK",
			port: PORT,
			url: `http://localhost:${PORT}/dead-certain/loan-check/`,
		});
		expect(plan.create.map((f) => f.path)).toEqual([
			"apps/loan-check/package.json",
			"apps/loan-check/vite.config.ts",
			"apps/loan-check/index.html",
			"apps/loan-check/src/config.ts",
			"e2e/loan-check-smoke.spec.ts",
		]);
		for (const f of plan.create) expect(f.text, f.path).not.toContain("__APP_");
		expect(plan.create.at(-1)?.text).toContain(
			`"http://localhost:${PORT}/dead-certain/loan-check/"`,
		);
	});

	it("edits the two shared files at their markers (6.1 to 6.4)", () => {
		const plan = planFor(inputs(), "loan-check");
		if (!("create" in plan)) throw new Error(plan.message);
		const pw = plan.edits.find((e) => e.path === "playwright.config.ts");
		const ci = plan.edits.find((e) => e.path === ".github/workflows/ci.yml");
		expect(pw?.after).toContain(
			`export const LOAN_CHECK_URL = "http://localhost:${PORT}/dead-certain/loan-check/";`,
		);
		expect(pw?.after).toContain(
			`pnpm --filter @dead-certain/loan-check build && pnpm --filter @dead-certain/loan-check preview --port ${PORT} --strictPort`,
		);
		expect(pw?.after).toContain("url: LOAN_CHECK_URL,");
		expect(ci?.after).toContain(
			"      - run: pnpm dc build apps/loan-check\n      # new-app:dc-build",
		);
		expect(ci?.after).toContain(
			"      - run: cp -R apps/loan-check/dist apps/site/dist/loan-check\n      # new-app:copy",
		);
		expect(pw?.before).toBe(inputs().playwright);
	});

	it("adds a noindex PAGES entry before new-app:pages, and refuses a key or path PAGES has (13.2 to 13.4)", () => {
		const plan = planFor(inputs(), "loan-check");
		if (!("create" in plan)) throw new Error(plan.message);
		const site = plan.edits.find((e) => e.path === "packages/ui/src/site.ts");
		expect(site?.before).toBe(inputs().site);
		expect(site?.after).toContain(
			[
				"\tloanCheck: {",
				'\t\tpath: "loan-check/",',
				'\t\tname: "Loan Check",',
				'\t\ttitle: "Loan Check",',
				'\t\tdescription: "An app built with the Dead Certain skeleton.",',
				"\t\tindex: false,",
				"\t},",
				"\t// new-app:pages",
			].join("\n"),
		);
		// "not-found" is a valid name whose key, notFound, PAGES already has.
		expect(planFor(inputs(), "not-found")).toMatchObject({ code: "EXISTS" });
		const pathTaken = inputs().site.replace(
			'path: "kit/"',
			'path: "loan-check/"',
		);
		expect(planFor(inputs({ site: pathTaken }), "loan-check")).toMatchObject({
			code: "EXISTS",
		});
		const doubled = `${inputs().site}\n// new-app:pages\n`;
		expect(planFor(inputs({ site: doubled }), "loan-check")).toMatchObject({
			code: "MARKER",
		});
		expect(
			planFor(
				inputs({ site: inputs().site.replace("new-app:pages", "") }),
				"loan-check",
			),
		).toMatchObject({ code: "MARKER" });
	});

	it("refuses a name in apps, a package that exists, or a shared file that already names it (2.3)", () => {
		expect(
			planFor(inputs({ existingApps: ["loan-check"] }), "loan-check"),
		).toMatchObject({ code: "EXISTS" });
		expect(
			planFor(
				inputs({ packageNames: ["@dead-certain/loan-check"] }),
				"loan-check",
			),
		).toMatchObject({ code: "EXISTS" });
		const named = `${inputs().ci}\n# apps/loan-check\n`;
		expect(planFor(inputs({ ci: named }), "loan-check")).toMatchObject({
			code: "EXISTS",
		});
	});

	it("plans a name that is only the start of another app's name (Kiro's G5 review)", () => {
		// "apps/claim" sits inside "apps/claim-check" in both shared files.
		for (const name of ["claim", "pre", "claim-check-two"])
			expect(planFor(inputs(), name), name).toHaveProperty("create");
		const named = `${inputs().ci}\n# apps/claim\n`;
		expect(planFor(inputs({ ci: named }), "claim")).toMatchObject({
			code: "EXISTS",
		});
	});

	it("refuses a bad name, a reserved one, a missing marker, a path outside, and an unknown placeholder (2.1, 2.4, 3.6, 8.1)", () => {
		expect(planFor(inputs(), "Loan")).toMatchObject({ code: "BAD_NAME" });
		expect(planFor(inputs(), "kit")).toMatchObject({ code: "RESERVED" });
		expect(planFor(inputs({ ci: "no markers\n" }), "loan-check")).toMatchObject(
			{ code: "MARKER" },
		);
		expect(
			planFor(
				inputs({
					templateFiles: [...FIXTURE, { path: "../evil.ts", text: "" }],
				}),
				"loan-check",
			),
		).toMatchObject({ code: "PATH" });
		expect(
			planFor(
				inputs({ templateFiles: [...FIXTURE, { path: "/abs.ts", text: "" }] }),
				"loan-check",
			),
		).toMatchObject({ code: "PATH" });
		expect(
			planFor(
				inputs({ templateFiles: [{ path: "x.ts", text: "__APP_OOPS__" }] }),
				"loan-check",
			),
		).toMatchObject({ code: "PATH" });
	});
});
