// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { contrast } from "./tokens/contrast";

// Feature: ui-kit, Property 11: Contrast floor

const UI_ROOT = new URL("../", import.meta.url);
const read = (path: string): string =>
	readFileSync(new URL(path, UI_ROOT), "utf8");

/** The declarations of the first rule whose prelude is `selector`. */
function declarations(selector: string): Record<string, string> {
	const css = read("tokens.css");
	const start = css.indexOf(`${selector} {`);
	const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
	return Object.fromEntries(
		[...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [
			m[1] as string,
			(m[2] as string).trim(),
		]),
	);
}

/**
 * Colour tokens for a theme, with var() resolved. An rgb(r g b / a%) token
 * resolves to that colour laid over the theme's --bg-base, as it renders.
 */
function colourTokens(
	theme: "dark" | "light" = "dark",
): Record<string, string> {
	const raw = {
		...declarations(":root"),
		...(theme === "light" ? declarations(':root[data-theme="light"]') : {}),
	};
	const resolve = (value: string): string => {
		const name = /^var\(--([\w-]+)\)$/.exec(value)?.[1];
		return name && raw[name] ? resolve(raw[name] as string) : value;
	};
	const solid = Object.fromEntries(
		Object.entries(raw).map(([name, value]) => [name, resolve(value)]),
	);
	return Object.fromEntries(
		Object.entries(solid).map(([name, value]) => [
			name,
			translucent(value, solid["bg-base"] as string) ?? value,
		]),
	);
}

/** `rgb(r g b / a%)` over `bg`, as #rrggbb, or undefined for any other value. */
function translucent(value: string, bg: string): string | undefined {
	const m = /^rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)$/.exec(value);
	if (!m) return undefined;
	return over(
		m.slice(1, 4).map(Number) as [number, number, number],
		Number(m[4]) / 100,
		bg,
	);
}

/** `fg` at `alpha` laid over the #rrggbb colour `bg`. */
function over(fg: [number, number, number], alpha: number, bg: string): string {
	const base = [1, 3, 5].map((i) => Number.parseInt(bg.slice(i, i + 2), 16));
	return `#${fg
		.map((c, i) => Math.round(c * alpha + (base[i] as number) * (1 - alpha)))
		.map((c) => c.toString(16).padStart(2, "0"))
		.join("")}`;
}

const hexRgb = (hex: string): [number, number, number] =>
	[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [
		number,
		number,
		number,
	];

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
	const tokens = colourTokens("light");

	const ratio = contrast(tokens[fg] as string, tokens[bg] as string);

	expect(ratio).toBeGreaterThanOrEqual(floor);
	expect(ratio).toBeCloseTo(printed, 1);
});

// The steering contrast tables, redesign 2026-11-23: [fg, bg, floor, printed].
const SURFACES = ["bg-base", "bg-surface-1", "bg-surface-2", "bg-surface-3"];

const DARK_TEXT: [string, number[]][] = [
	["text-primary", [15.03, 13.89, 12.76, 11.03]],
	["text-secondary", [10.64, 9.84, 9.04, 7.81]],
	["text-tertiary", [7.37, 6.81, 6.26, 5.41]],
	["wax", [11.14, 10.3, 9.46, 8.17]],
	["paid-dark", [8.49, 7.85, 7.21, 6.23]],
	["reduced-dark", [8.38, 7.75, 7.12, 6.15]],
	["denied-dark", [6.43, 5.95, 5.46, 4.72]],
];

const DARK_PAIRS: [string, string, number, number][] = [
	...DARK_TEXT.flatMap(([fg, printed]) =>
		SURFACES.map(
			(bg, i) =>
				[fg, bg, TEXT, printed[i] as number] as [
					string,
					string,
					number,
					number,
				],
		),
	),
	["on-wax", "wax", TEXT, 11.14],
	["on-wax", "wax-hover", TEXT, 12.51],
	["control-border-dark", "bg-surface-2", NON_TEXT, 6.26],
	["focus-dark", "bg-surface-3", NON_TEXT, 8.17],
];

const LIGHT_PAIRS: [string, string, number, number][] = [
	...(
		[
			["text-primary", [14.38, 16.05, 15.19, 13.31]],
			["text-secondary", [6.33, 7.06, 6.69, 5.86]],
			["text-tertiary", [4.89, 5.46, 5.17, 4.53]],
			["paid", [5.53, 6.16, 5.84, 5.12]],
			["reduced", [5.66, 6.31, 5.97, 5.24]],
			["denied", [6.28, 7.01, 6.64, 5.82]],
		] as [string, number[]][]
	).flatMap(([fg, printed]) =>
		SURFACES.map(
			(bg, i) =>
				[fg, bg, TEXT, printed[i] as number] as [
					string,
					string,
					number,
					number,
				],
		),
	),
	["control-border", "bg-surface-2", NON_TEXT, 6.69],
	["focus", "bg-base", NON_TEXT, 4.1],
];

test.each(DARK_PAIRS)("dark: %s on %s meets %d:1", (fg, bg, floor, printed) => {
	const tokens = colourTokens("dark");

	const ratio = contrast(tokens[fg] as string, tokens[bg] as string);

	expect(ratio).toBeGreaterThanOrEqual(floor);
	expect(ratio).toBeCloseTo(printed, 1);
});

test.each(LIGHT_PAIRS)(
	"light: %s on %s meets %d:1",
	(fg, bg, floor, printed) => {
		const tokens = colourTokens("light");

		const ratio = contrast(tokens[fg] as string, tokens[bg] as string);

		expect(ratio).toBeGreaterThanOrEqual(floor);
		expect(ratio).toBeCloseTo(printed, 1);
	},
);

test("both stops of the hero headline fill reach 4.5:1 on bg-base in both themes (Property 11)", () => {
	for (const theme of ["dark", "light"] as const) {
		const t = colourTokens(theme);
		for (const stop of ["text-primary", "text-tertiary"])
			expect(
				contrast(t[stop] as string, t["bg-base"] as string),
				`${theme} ${stop}`,
			).toBeGreaterThanOrEqual(4.5);
	}
});

test("dark translucent pairs: wax-muted", () => {
	const t = colourTokens("dark");
	const base = t["bg-base"] as string;
	const muted = over(
		hexRgb(t.wax as string),
		0.12,
		t["bg-surface-1"] as string,
	);

	expect(contrast(t.bone as string, muted)).toBeCloseTo(10.91, 1);
	expect(contrast(t.wax as string, muted)).toBeCloseTo(8.09, 1);
});

test("decorative borders stay below 3:1 on base, so nothing may use them as a control edge", () => {
	const t = colourTokens("dark");

	expect(
		contrast(t["border-subtle"] as string, t["bg-base"] as string),
	).toBeCloseTo(1.13, 1);
	expect(
		contrast(t["border-default"] as string, t["bg-base"] as string),
	).toBeCloseTo(1.25, 1);
	expect(
		contrast(t["border-strong"] as string, t["bg-base"] as string),
	).toBeCloseTo(1.59, 1);
});

test("the dark room's focus ring is wax, and the paper one fails there", () => {
	const t = colourTokens("dark");

	expect(t.focus).toBe(t.wax);
	expect(
		contrast(t["focus-paper"] as string, t["bg-surface-3"] as string),
	).toBeLessThan(NON_TEXT);
});

test("hairline on paper is the one pair with no floor: it fails 3:1", () => {
	const ratio = contrast(
		colourTokens().hairline as string,
		colourTokens().paper as string,
	);

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
