// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";

// The Template follows Claim Check (requirements 7.1 to 7.4).
const read = (path: string): string =>
	fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8") as string;

type Pkg = {
	name: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
};
const deps = (pkg: Pkg): Record<string, string> => ({
	...pkg.dependencies,
	...pkg.devDependencies,
});
const reference = deps(JSON.parse(read("apps/claim-check/package.json")));
const template = deps(JSON.parse(read("templates/app/package.json")));

/** Claim Check's text with its own names put back as Placeholders. */
const normalise = (text: string): string =>
	text
		.replaceAll("claim-check", "__APP_NAME__")
		.replaceAll("Claim Check", "__APP_TITLE__");

/** The lines each file may change: the base path, the description and the title (7.4). */
const ALLOWED: Record<string, RegExp[]> = {
	"vite.config.ts": [/^\s*base: /],
	"index.html": [/<meta name="description"/, /<title>/],
	"src/styles.css": [],
};

describe("drift", () => {
	// Feature: app-template, Property 9: The Template follows Claim Check
	it("names the same packages at the same exact versions", () => {
		expect(Object.keys(template).sort()).toEqual(Object.keys(reference).sort());
		for (const [name, version] of Object.entries(template)) {
			expect(version, name).toBe(reference[name]);
			if (!version.startsWith("workspace:"))
				expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
		}
	});

	it.each(Object.keys(ALLOWED))(
		"%s differs only on its allowed lines",
		(file) => {
			const ours = read(`templates/app/${file}`).split("\n");
			const theirs = normalise(read(`apps/claim-check/${file}`)).split("\n");
			expect(ours.length).toBe(theirs.length);
			const allowed = ALLOWED[file] ?? [];
			const drift = ours
				.map((line, i) => ({ line: i + 1, ours: line, theirs: theirs[i] }))
				.filter(
					(d) =>
						d.ours !== d.theirs &&
						!allowed.some((re) => re.test(d.theirs ?? "")),
				);
			expect(drift).toEqual([]);
		},
	);
});
