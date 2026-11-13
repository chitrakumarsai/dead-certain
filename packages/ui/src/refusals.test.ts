// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:url
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { beforeAll, expect, test } from "vitest";

// Feature: ui-kit, Property 12: No refused patterns

type Refusal = { name: string; found: (css: string) => string[] };

const matches = (css: string, pattern: RegExp): string[] =>
	[...css.matchAll(pattern)].map((m) => m[0]);

/** A licence banner may carry a link. A comment is never requested. */
const withoutComments = (css: string): string =>
	css.replace(/\/\*[\s\S]*?\*\//g, "");

const CSS_REFUSALS: Refusal[] = [
	{
		name: "box-shadow other than none",
		found: (css) =>
			matches(css, /box-shadow\s*:\s*[^;}]+/g).filter(
				(decl) => !/:\s*none\s*(!important)?$/.test(decl.trim()),
			),
	},
	{
		name: "gradient",
		found: (css) => matches(css, /(linear|radial|conic)-gradient/g),
	},
	{
		name: "uppercase text",
		found: (css) => matches(css, /text-transform\s*:\s*uppercase/g),
	},
	{
		name: "global dark mode",
		found: (css) => matches(css, /prefers-color-scheme\s*:\s*dark/g),
	},
	{
		name: "third-party URL",
		found: (css) => matches(withoutComments(css), /https?:\/\/[^\s"')]+/g),
	},
];

const SOURCE_REFUSALS =
	/dangerouslySetInnerHTML|localStorage|sessionStorage|document\.cookie|\bfetch\(|XMLHttpRequest|sendBeacon/;

test.each([
	["a{box-shadow:0 1px 2px #000}", "box-shadow other than none"],
	["a{background:linear-gradient(red,blue)}", "gradient"],
	["a{background:conic-gradient(red,blue)}", "gradient"],
	["a{text-transform:uppercase}", "uppercase text"],
	["@media (prefers-color-scheme:dark){a{color:#fff}}", "global dark mode"],
	["@font-face{src:url(https://fonts.example/x.woff2)}", "third-party URL"],
])("the scan refuses %s", (css, name) => {
	const refusal = CSS_REFUSALS.find((r) => r.name === name) as Refusal;

	expect(refusal.found(css)).not.toEqual([]);
});

test("the scan allows box-shadow none, a licence comment and relative URLs", () => {
	const css =
		"/*! lib | MIT | https://lib.example */a{box-shadow:none}@font-face{src:url(./x.woff2)}";

	expect(CSS_REFUSALS.flatMap((r) => r.found(css))).toEqual([]);
});

let builtCss = "";

beforeAll(async () => {
	const output = await build({
		root: fileURLToPath(new URL("../../../apps/site", import.meta.url)),
		logLevel: "silent",
		build: { write: false },
	});
	const bundles = Array.isArray(output) ? output : [output];
	builtCss = bundles
		.flatMap((bundle) => ("output" in bundle ? bundle.output : []))
		.filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
		.map((file) => (file.type === "asset" ? String(file.source) : ""))
		.join("\n");
}, 60_000);

test("the site build emits the kit stylesheet", () => {
	expect(builtCss).toContain("--lightbox");
});

test.each(CSS_REFUSALS)("the built CSS has no $name", ({ found }) => {
	expect(found(builtCss)).toEqual([]);
});

test("kit source has no raw HTML injection, storage or network call", () => {
	const src = new URL("./", import.meta.url);
	const offenders = (readdirSync(src, { recursive: true }) as string[])
		.filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
		.filter((file) => !file.startsWith("testkit/"))
		.filter((file) =>
			SOURCE_REFUSALS.test(readFileSync(new URL(file, src), "utf8")),
		);

	expect(offenders).toEqual([]);
});
