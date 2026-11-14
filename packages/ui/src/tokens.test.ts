// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const css: string = readFileSync(
	new URL("../tokens.css", import.meta.url),
	"utf8",
);

/** The declarations of the first rule whose prelude matches `selector`. */
function block(selector: string): Map<string, string> {
	const start = css.indexOf(`${selector} {`);
	if (start < 0) throw new Error(`no rule for ${selector}`);
	const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
	return new Map(
		[...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
			m[1] as string,
			(m[2] as string).trim(),
		]),
	);
}

// Biome's formatter lowercases hex colours; the values are the steering ones.
const ROOT = {
	"--lightbox": "#edf2f3",
	"--paper": "#fcfefe",
	"--ink": "#13222c",
	"--ink-soft": "#4a5a64",
	"--hairline": "#c9d5d9",
	"--film": "#0b1c26",
	"--bone": "#dce8eb",
	"--bone-soft": "#8fa6ae",
	"--wax": "#f2c12e",
	"--paid": "#1b6e46",
	"--reduced": "#8a5200",
	"--denied": "#a8261c",
	"--focus-paper": "#1f6feb",
	"--focus-film": "var(--wax)",
	"--surface": "var(--paper)",
	"--text": "var(--ink)",
	"--text-soft": "var(--ink-soft)",
	"--control-border": "var(--ink-soft)",
	"--divider": "var(--hairline)",
	"--focus": "var(--focus-paper)",
	"--space-1": "4px",
	"--space-2": "8px",
	"--space-3": "12px",
	"--space-4": "16px",
	"--space-6": "24px",
	"--space-8": "32px",
	"--space-12": "48px",
	"--space-16": "64px",
	"--space-24": "96px",
	"--radius-paper": "4px",
	"--radius-control": "6px",
	"--radius-film": "8px",
	"--column-max": "680px",
	"--rail-width": "240px",
	"--touch-min": "44px",
	"--bar-gap": "2px",
	"--bar-part-min": "2px",
	"--ease": "cubic-bezier(0.2, 0, 0, 1)",
	"--dur-press": "120ms",
	"--dur-panel": "200ms",
	"--dur-xray": "500ms",
	"--dur-reduced": "120ms",
	"--text-doc-body": "17px",
	"--leading-doc-body": "28px",
	"--text-doc-fine": "14px",
	"--leading-doc-fine": "22px",
	"--text-verdict": "36px",
	"--leading-verdict": "44px",
	"--text-summary": "36px",
	"--leading-summary": "44px",
	"--text-sys-body": "17px",
	"--leading-sys-body": "26px",
	"--text-question": "21px",
	"--leading-question": "28px",
	"--text-sys-small": "14px",
	"--leading-sys-small": "20px",
	"--text-mono": "14px",
	"--leading-mono": "22px",
};

test("root defines every token with the steering value", () => {
	const root = block(":root");

	expect(Object.fromEntries(root)).toMatchObject(ROOT);
	expect(css).toMatch(/:root \{\s*color-scheme: light;/);
	for (const family of ["--font-doc", "--font-sys", "--font-mono"]) {
		expect(root.has(family), family).toBe(true);
	}
});

test("paper surface restores the paper context, for paper set inside film", () => {
	expect(Object.fromEntries(block('[data-surface="paper"]'))).toEqual({
		"--surface": "var(--paper)",
		"--text": "var(--ink)",
		"--text-soft": "var(--ink-soft)",
		"--control-border": "var(--ink-soft)",
		"--divider": "var(--hairline)",
		"--focus": "var(--focus-paper)",
	});
});

test("film surface swaps the surface-context properties", () => {
	expect(Object.fromEntries(block('[data-surface="film"]'))).toEqual({
		"--surface": "var(--film)",
		"--text": "var(--bone)",
		"--text-soft": "var(--bone-soft)",
		"--control-border": "var(--bone-soft)",
		"--divider": "var(--bone-soft)",
		"--focus": "var(--focus-film)",
	});
});

test("verdict and question type grow from 768 px", () => {
	const wide = css.slice(css.indexOf("@media (min-width: 768px)"));

	expect(wide).toMatch(/--text-verdict: 48px;\s*--leading-verdict: 56px;/);
	expect(wide).toMatch(/--text-question: 24px;\s*--leading-question: 32px;/);
	// The Pre-Flight summary stays 36/44 at every width.
	expect(wide).not.toContain("--text-summary");
});

test("reduced motion sets the panel duration to zero", () => {
	const reduced = css.slice(
		css.indexOf("@media (prefers-reduced-motion: reduce)"),
	);

	expect(reduced).toMatch(/--dur-panel: 0ms;/);
});

test("focus is a 2 px outline in the surface focus colour with a 2 px offset", () => {
	expect(css).toMatch(
		/:focus-visible \{\s*outline: 2px solid var\(--focus\);\s*outline-offset: 2px;\s*\}/,
	);
});
