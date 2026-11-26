import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Inputs, planFor } from "./plan.ts";

const PLAYWRIGHT =
	'const A = "http://localhost:4174/dead-certain/a/";\n// new-app:urls\nexport default {\n\twebServer: [\n\t\t// new-app:servers\n\t],\n};\n';
const CI =
	"      - run: pnpm dc build apps/a\n      # new-app:dc-build\n      - run: cp -R apps/a/dist apps/site/dist/a\n      # new-app:copy\n";
const SITE =
	'export const ENTRIES = {\n\ta: {\n\t\tpath: "a/",\n\t},\n\t// new-app:pages\n};\n';
const TOKENS = [
	"__APP_NAME__",
	"__APP_TITLE__",
	"__APP_SLUG_CONST__",
	"__APP_PORT__",
	"plain",
	"/",
	"-",
	" ",
];

const textArb = fc
	.array(fc.constantFrom(...TOKENS), { maxLength: 8 })
	.map((t) => t.join(""));
const filesArb = fc.uniqueArray(
	fc.record({
		path: fc.constantFrom(
			"package.json",
			"src/a.ts",
			"src/b/c.ts",
			"e2e/smoke.spec.ts",
			"kb/x.yaml",
		),
		text: textArb,
	}),
	{ selector: (f) => f.path, minLength: 1, maxLength: 5 },
);
const nameArb = fc.stringMatching(/^[a-z][a-z0-9]{1,8}(-[a-z0-9]{1,5}){0,2}$/);
const inputs = (
	templateFiles: Inputs["templateFiles"],
	existingApps: string[] = ["a"],
): Inputs => ({
	templateFiles,
	playwright: PLAYWRIGHT,
	ci: CI,
	site: SITE,
	existingApps,
	packageNames: existingApps.map((a) => `@dead-certain/${a}`),
});

describe("plan properties", () => {
	it("substitution is complete and local", () => {
		// Feature: app-template, Property 2: Substitution is complete and local
		fc.assert(
			fc.property(filesArb, nameArb, (files, name) => {
				const plan = planFor(inputs(files), name);
				if (!("create" in plan)) return;
				for (const f of plan.create) {
					expect(f.text).not.toContain("__APP_");
					expect(
						f.path.startsWith(`apps/${name}/`) ||
							f.path === `e2e/${name}-smoke.spec.ts`,
					).toBe(true);
				}
			}),
			{ numRuns: 200 },
		);
	});

	it("the plan is deterministic and refuses a collision", () => {
		// Feature: app-template, Property 3: The Plan is deterministic and refuses a collision
		fc.assert(
			fc.property(filesArb, nameArb, (files, name) => {
				expect(planFor(inputs(files), name)).toEqual(
					planFor(inputs(files), name),
				);
				expect(planFor(inputs(files, ["a", name]), name)).toMatchObject({
					code: "EXISTS",
				});
			}),
			{ numRuns: 200 },
		);
	});
});
