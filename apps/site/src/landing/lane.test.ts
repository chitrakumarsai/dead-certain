// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";

// The landing page imports no app's source, calls no network and touches no
// storage (requirements 1.5, 1.7, 8.4). Tests and test helpers are not the page.
const DIR = new URL("./", import.meta.url);
const files = (fs.readdirSync(DIR, { recursive: true }) as string[])
	.map((f) => f.replaceAll("\\", "/"))
	.filter(
		(f) =>
			/\.tsx?$/.test(f) &&
			!/\.test\.tsx?$/.test(f) &&
			!f.startsWith("testing/"),
	);

const FORBIDDEN: [string, RegExp][] = [
	[
		"an import from an app's src",
		/from\s+["'][^"']*(claim-check|pre-flight)\/src/,
	],
	["fetch", /\bfetch\s*\(/],
	["XMLHttpRequest", /\bXMLHttpRequest\b/],
	["localStorage", /\blocalStorage\b/],
	["sessionStorage", /\bsessionStorage\b/],
	["document.cookie", /\bdocument\.cookie\b/],
];

/** Each file's forbidden uses, as "file: what". */
export function findCrossings(sources: Record<string, string>): string[] {
	return Object.entries(sources).flatMap(([file, text]) =>
		FORBIDDEN.filter(([, re]) => re.test(text)).map(
			([what]) => `${file}: ${what}`,
		),
	);
}

describe("the landing page's lane", () => {
	it("has page files to scan", () => {
		expect(files).toContain("main.tsx");
	});

	it("imports no app source and uses no network or storage", () => {
		const sources = Object.fromEntries(
			files.map((f) => [f, fs.readFileSync(new URL(f, DIR), "utf8") as string]),
		);
		expect(findCrossings(sources)).toEqual([]);
	});

	it("catches each forbidden use", () => {
		expect(
			findCrossings({
				"a.ts": 'import { x } from "../../../claim-check/src/kb";',
				"b.ts": 'await fetch("/x");',
				"c.ts": "localStorage.setItem('a', 'b');",
				"d.ts": "document.cookie = 'a=b';",
				"e.ts":
					'import compiled from "../../../claim-check/kb/dist/policy.json";',
			}),
		).toEqual([
			"a.ts: an import from an app's src",
			"b.ts: fetch",
			"c.ts: localStorage",
			"d.ts: document.cookie",
		]);
	});
});
