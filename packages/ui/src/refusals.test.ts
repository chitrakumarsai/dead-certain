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

/** Depth tokens a box-shadow may use (steering: Spacing, radius, layout). */
const DEPTH =
	/^(none|var\(--(highlight-inset|glow-wax-soft|glow-wax-pulse|halo-paper)\))\s*(!important)?$/;

/** Tokens that may hold a gradient (steering: What this design refuses). */
const GRADIENT_TOKENS =
	/^--(glow-hero|fill-hero-text|grid-calibration|grain|scan-line)\s*:/;

/** The declaration a match sits in: from the last `{` or `;` before it. */
const declarationAt = (css: string, index: number): string =>
	css
		.slice(
			Math.max(css.lastIndexOf("{", index), css.lastIndexOf(";", index)) + 1,
			index,
		)
		.trim();

const CSS_REFUSALS: Refusal[] = [
	{
		name: "box-shadow other than a depth token",
		found: (css) =>
			[...css.matchAll(/box-shadow\s*:\s*([^;}]+)/g)]
				.filter((m) => !DEPTH.test((m[1] as string).trim()))
				.map((m) => m[0]),
	},
	{
		name: "gradient outside a gradient token",
		found: (css) =>
			[...css.matchAll(/(linear|radial|conic)-gradient/g)]
				.filter((m) => !GRADIENT_TOKENS.test(declarationAt(css, m.index)))
				.map((m) => declarationAt(css, m.index)),
	},
	{
		name: "uppercase text",
		found: (css) => matches(css, /text-transform\s*:\s*uppercase/g),
	},
	{
		name: "Tailwind uppercase, ring or shadow utility",
		found: (css) =>
			matches(
				css,
				/\.(uppercase|inset-ring|ring|inset-shadow|shadow)(-[\w-]+)?(?=[\s{,:])/g,
			),
	},
	{
		name: "third-party URL",
		found: (css) => matches(withoutComments(css), /https?:\/\/[^\s"')]+/g),
	},
];

const SOURCE_REFUSALS =
	/dangerouslySetInnerHTML|localStorage|sessionStorage|document\.cookie|\bfetch\(|XMLHttpRequest|sendBeacon/;

test.each([
	["a{box-shadow:0 1px 2px #000}", "box-shadow other than a depth token"],
	["a{box-shadow:var(--other)}", "box-shadow other than a depth token"],
	[
		"a{background:linear-gradient(red,blue)}",
		"gradient outside a gradient token",
	],
	["a{--wash:conic-gradient(red,blue)}", "gradient outside a gradient token"],
	["a{text-transform:uppercase}", "uppercase text"],
	[".shadow-lg{color:red}", "Tailwind uppercase, ring or shadow utility"],
	[".ring{color:red}", "Tailwind uppercase, ring or shadow utility"],
	["@font-face{src:url(https://fonts.example/x.woff2)}", "third-party URL"],
])("the scan refuses %s", (css, name) => {
	const refusal = CSS_REFUSALS.find((r) => r.name === name) as Refusal;

	expect(refusal.found(css)).not.toEqual([]);
});

test("the scan allows depth tokens, gradient tokens, a licence comment and relative URLs", () => {
	const css =
		"/*! lib | MIT | https://lib.example */a{box-shadow:none}b{box-shadow:var(--glow-wax-soft)}:root{--grain:linear-gradient(red,blue)}.ringside{color:red}@font-face{src:url(./x.woff2)}";

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

test("the built CSS loads every font from this origin", () => {
	const urls = matches(withoutComments(builtCss), /url\(([^)]+)\)/g);
	const fonts = urls.filter((url) => url.includes(".woff"));

	expect(fonts).toHaveLength(10);
	for (const url of urls) {
		expect(url).not.toMatch(/url\(["']?(https?:)?\/\//);
	}
});

test.each(CSS_REFUSALS)("the built CSS has no $name", ({ found }) => {
	expect(found(builtCss)).toEqual([]);
});

/** The one file allowed to touch localStorage (steering: Theme). */
const THEME_STORAGE = "theme/storage.ts";

test("kit source has no raw HTML injection, storage or network call", () => {
	const src = new URL("./", import.meta.url);
	const offenders = (readdirSync(src, { recursive: true }) as string[])
		.filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
		.filter((file) => !file.startsWith("testkit/"))
		.filter((file) => {
			const text = readFileSync(new URL(file, src), "utf8");
			const scanned =
				file === THEME_STORAGE ? text.replace(/\blocalStorage\b/g, "") : text;
			return SOURCE_REFUSALS.test(scanned);
		});

	expect(offenders).toEqual([]);
});

test("theme storage touches localStorage and nothing else refused", () => {
	const text = readFileSync(new URL(THEME_STORAGE, import.meta.url), "utf8");

	expect(text).toMatch(/\blocalStorage\b/);
	expect(text).not.toMatch(/sessionStorage|document\.cookie|\bfetch\(/);
});

test("prefers-color-scheme: dark appears in no stylesheet or source but tokens.css", () => {
	const roots = [
		"../",
		"../../../apps/site/src/",
		"../../../apps/claim-check/src/",
		"../../../apps/pre-flight/src/",
	].map((path) => new URL(path, import.meta.url));
	const offenders = roots.flatMap((root) =>
		(readdirSync(root, { recursive: true }) as string[])
			.filter(
				(file) => /\.(css|tsx?)$/.test(file) && !file.includes("node_modules"),
			)
			.filter(
				(file) => !file.endsWith("tokens.css") && !/\.test\.tsx?$/.test(file),
			)
			.filter((file) =>
				/prefers-color-scheme\s*:\s*dark/.test(
					readFileSync(new URL(file, root), "utf8"),
				),
			)
			.map((file) => `${root.pathname}${file}`),
	);

	expect(offenders).toEqual([]);
});

// Property 12, button-label part. The Playwright suite checks every rendered
// label in the gallery; this scan stops an arrow reaching any kit or gallery
// source at all.
const ARROWS = /[→←↑↓➜»«]/u;

test("the arrow scan recognises each refused arrow", () => {
	for (const arrow of ["→", "←", "↑", "↓", "➜", "»", "«"]) {
		expect(ARROWS.test(`Continue ${arrow}`)).toBe(true);
	}
	expect(ARROWS.test("Continue")).toBe(false);
});

test("no kit or gallery component source contains an arrow", () => {
	const roots = [
		new URL("./", import.meta.url),
		new URL("../../../apps/site/src/", import.meta.url),
	];
	const offenders = roots.flatMap((root) =>
		(readdirSync(root, { recursive: true }) as string[])
			.filter((file) => file.endsWith(".tsx"))
			.filter((file) => ARROWS.test(readFileSync(new URL(file, root), "utf8"))),
	);

	expect(offenders).toEqual([]);
});
