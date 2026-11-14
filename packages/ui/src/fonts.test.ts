// @ts-expect-error TS2591: no type definitions for node:fs
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

const UI_ROOT = new URL("../", import.meta.url);
const css: string = readFileSync(new URL("fonts.css", UI_ROOT), "utf8");

interface Face {
	family: string;
	weight: string;
	file: string;
	display: string;
	range: string;
}

const prop = (block: string, name: string): string =>
	new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim() ?? "";

const faces: Face[] = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(
	(m) => {
		const block = m[1] as string;
		return {
			family: prop(block, "font-family").replaceAll('"', ""),
			weight: prop(block, "font-weight"),
			file: /url\("([^"]+)"\)/.exec(block)?.[1] ?? "",
			display: prop(block, "font-display"),
			range: prop(block, "unicode-range"),
		};
	},
);

function covers(range: string, codePoint: number): boolean {
	return range.split(",").some((part) => {
		const [lo, hi = lo] = part.trim().replace(/^U\+/i, "").split("-");
		return (
			Number.parseInt(lo as string, 16) <= codePoint &&
			codePoint <= Number.parseInt(hi as string, 16)
		);
	});
}

const RUPEE = 0x20b9;
const REQUIRED = [
	["IBM Plex Serif", "400"],
	["IBM Plex Serif", "600"],
	["IBM Plex Sans", "400"],
	["IBM Plex Sans", "600"],
	["IBM Plex Mono", "400"],
] as const;

test.each(REQUIRED)(
	"%s %s covers basic Latin and the rupee sign",
	(family, weight) => {
		const mine = faces.filter(
			(f) => f.family === family && f.weight === weight,
		);

		expect(mine.some((f) => covers(f.range, "A".charCodeAt(0)))).toBe(true);
		expect(mine.some((f) => covers(f.range, RUPEE))).toBe(true);
	},
);

test("loads exactly the five required faces, latin and latin-ext only", () => {
	const loaded = new Set(faces.map((f) => `${f.family} ${f.weight}`));

	expect([...loaded].sort()).toEqual(
		REQUIRED.map(([family, weight]) => `${family} ${weight}`).sort(),
	);
	expect(faces).toHaveLength(REQUIRED.length * 2);
	for (const face of faces) {
		expect(face.file).toMatch(/-(latin|latin-ext)-(400|600)-normal\.woff2$/);
	}
});

test("every face is a self-hosted fontsource file that exists, with a range and swap", () => {
	for (const face of faces) {
		expect(face.file).toMatch(/^\.\/node_modules\/@fontsource\/ibm-plex-/);
		expect(existsSync(new URL(face.file, UI_ROOT)), face.file).toBe(true);
		expect(face.display).toBe("swap");
		expect(face.range).not.toBe("");
	}
});

test("no two rules for one face overlap, so neither overrides the other", () => {
	for (const [family, weight] of REQUIRED) {
		const mine = faces.filter(
			(f) => f.family === family && f.weight === weight,
		);
		const both = [..."Aaz09₹€"].filter(
			(ch) =>
				mine.filter((f) => covers(f.range, ch.codePointAt(0) as number))
					.length > 1,
		);

		expect(both, `${family} ${weight}`).toEqual([]);
	}
});

test("fonts.css documents the three preload tags", () => {
	for (const file of [
		"ibm-plex-sans-latin-400-normal.woff2",
		"ibm-plex-sans-latin-600-normal.woff2",
		"ibm-plex-serif-latin-600-normal.woff2",
	]) {
		expect(css).toContain(file);
	}
	expect(css).toContain('rel="preload"');
});
