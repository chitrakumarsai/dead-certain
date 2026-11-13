// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { contrast } from "./tokens/contrast";

// Feature: ui-kit, Property 11: Contrast floor

const UI_ROOT = new URL("../", import.meta.url);
const read = (path: string): string =>
	readFileSync(new URL(path, UI_ROOT), "utf8");

/** Colour tokens from tokens.css, with one level of var() resolved. */
function colourTokens(): Record<string, string> {
	const raw = Object.fromEntries(
		[...read("tokens.css").matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [
			m[1] as string,
			(m[2] as string).trim(),
		]),
	);
	const resolve = (value: string): string => {
		const name = /^var\(--([\w-]+)\)$/.exec(value)?.[1];
		return name ? (raw[name] as string) : value;
	};
	return Object.fromEntries(
		Object.entries(raw).map(([name, value]) => [name, resolve(value)]),
	);
}

const TEXT = 4.5;
const NON_TEXT = 3;

// The contrast table in design.md: [foreground, background, floor, printed ratio].
const PAIRS: [string, string, number, number][] = [
	["ink", "paper", TEXT, 16.05],
	["ink", "lightbox", TEXT, 14.38],
	["ink-soft", "paper", TEXT, 7.06],
	["ink-soft", "lightbox", TEXT, 6.33],
	["bone", "film", TEXT, 13.89],
	["bone-soft", "film", TEXT, 6.81],
	["paid", "paper", TEXT, 6.16],
	["reduced", "paper", TEXT, 6.31],
	["denied", "paper", TEXT, 7.01],
	["paid", "lightbox", TEXT, 5.53],
	["reduced", "lightbox", TEXT, 5.66],
	["denied", "lightbox", TEXT, 6.28],
	["ink", "wax", TEXT, 9.62],
	["film", "wax", TEXT, 10.3],
	["focus-film", "film", NON_TEXT, 10.3],
	["focus-paper", "paper", NON_TEXT, 4.58],
	["focus-paper", "lightbox", NON_TEXT, 4.1],
	["paper", "ink", TEXT, 16.05],
];

test.each(PAIRS)("%s on %s meets %d:1", (fg, bg, floor, printed) => {
	const tokens = colourTokens();

	const ratio = contrast(tokens[fg] as string, tokens[bg] as string);

	expect(ratio).toBeGreaterThanOrEqual(floor);
	expect(ratio).toBeCloseTo(printed, 1);
});

test("hairline on paper is the one pair with no floor: it fails 3:1", () => {
	const tokens = colourTokens();

	const ratio = contrast(tokens.hairline as string, tokens.paper as string);

	expect(ratio).toBeLessThan(NON_TEXT);
});

test("contrast is symmetric and at least 1", () => {
	expect(contrast("#13222c", "#fcfefe")).toBe(contrast("#fcfefe", "#13222c"));
	expect(contrast("#f2c12e", "#f2c12e")).toBe(1);
});

// Token-usage scans. hairline is decorative: it reaches the page only through
// --divider. wax is a fill, a stroke or a focus ring, never a text colour.

/** Lines that use hairline anywhere but its definition and its two mappings. */
function hairlineMisuse(text: string): string[] {
	const allowed =
		/^\s*(--hairline:|--divider: var\(--hairline\);|--color-hairline: var\(--hairline\);)/;
	return text
		.split("\n")
		.filter((line) => /hairline/.test(line) && !allowed.test(line))
		.filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line));
}

/** Lines that set a text colour to wax, in CSS or as a Tailwind class. */
function waxMisuse(text: string): string[] {
	return text
		.split("\n")
		.filter(
			(line) =>
				/(^|[\s;{])color:\s*var\(--wax\)/.test(line) ||
				/--text(-soft)?:\s*var\(--wax\)/.test(line) ||
				/\btext-wax\b/.test(line),
		);
}

function sourceFiles(): string[] {
	const css = (readdirSync(UI_ROOT) as string[]).filter((f) =>
		f.endsWith(".css"),
	);
	const tsx = (
		readdirSync(new URL("src/", UI_ROOT), {
			recursive: true,
		}) as string[]
	)
		.filter((f) => f.endsWith(".tsx"))
		.map((f) => `src/${f}`);
	return [...css, ...tsx];
}

test("the scans catch each misuse and pass the allowed uses", () => {
	expect(hairlineMisuse("color: var(--hairline);")).toHaveLength(1);
	expect(hairlineMisuse("border: 1px solid var(--hairline);")).toHaveLength(1);
	expect(hairlineMisuse('<p className="text-hairline">')).toHaveLength(1);
	expect(hairlineMisuse('<input className="border-hairline" />')).toHaveLength(
		1,
	);
	expect(hairlineMisuse("\t--divider: var(--hairline);")).toEqual([]);
	expect(hairlineMisuse("\t--hairline: #c9d5d9;")).toEqual([]);

	expect(waxMisuse("p { color: var(--wax); }")).toHaveLength(1);
	expect(waxMisuse('<span className="text-wax">')).toHaveLength(1);
	expect(waxMisuse("--text: var(--wax);")).toHaveLength(1);
	expect(waxMisuse("mark { background-color: var(--wax); }")).toEqual([]);
	expect(waxMisuse("border-left-color: var(--wax);")).toEqual([]);
	expect(waxMisuse("--focus-film: var(--wax);")).toEqual([]);
	expect(waxMisuse('<mark className="bg-wax text-ink">')).toEqual([]);
});

test("the kit scans its stylesheets", () => {
	expect(sourceFiles()).toEqual(
		expect.arrayContaining(["tokens.css", "theme.css", "styles.css"]),
	);
});

test("no text and no control border uses hairline", () => {
	const misuse = sourceFiles().flatMap((file) =>
		hairlineMisuse(read(file)).map((line) => `${file}: ${line.trim()}`),
	);

	expect(misuse).toEqual([]);
});

test("wax is never a text colour", () => {
	const misuse = sourceFiles().flatMap((file) =>
		waxMisuse(read(file)).map((line) => `${file}: ${line.trim()}`),
	);

	expect(misuse).toEqual([]);
});
