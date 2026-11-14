// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import { compile } from "tailwindcss";
import { expect, test } from "vitest";

const read = (url: URL): string => readFileSync(url, "utf8");
const themeUrl = new URL("../theme.css", import.meta.url);

/** Compiles theme.css and returns the CSS Tailwind emits for `classes`. */
async function build(classes: string[]): Promise<string> {
	const compiler = await compile(read(themeUrl), {
		base: "/",
		loadStylesheet: async (id: string, base: string) => {
			if (id !== "tailwindcss") throw new Error(`unexpected import ${id}`);
			const path = import.meta.resolve("tailwindcss/index.css");
			return { path, base, content: read(new URL(path)) };
		},
	});
	return compiler.build(classes);
}

test.each([
	["bg-paper", "background-color: var(--paper)"],
	["bg-surface", "background-color: var(--surface)"],
	["text-text-soft", "color: var(--text-soft)"],
	["border-control-border", "border-color: var(--control-border)"],
	["p-4", "padding: var(--space-4)"],
	["inset-x-0", "inset-inline: 0px"],
	["bottom-0", "bottom: 0px"],
	["gap-24", "gap: var(--space-24)"],
	["rounded-control", "border-radius: var(--radius-control)"],
	["max-w-column", "max-width: var(--column-max)"],
	["min-h-touch", "min-height: var(--touch-min)"],
	["gap-(--bar-gap)", "gap: var(--bar-gap)"],
	["min-w-(--bar-part-min)", "min-width: var(--bar-part-min)"],
	["font-doc", "font-family: var(--font-doc)"],
	["text-verdict", "font-size: var(--text-verdict)"],
	["text-verdict", "var(--leading-verdict)"],
	["text-summary", "font-size: var(--text-summary)"],
	["text-summary", "var(--leading-summary)"],
	["ease-kit", "transition-timing-function: var(--ease)"],
	["figures", "font-variant-numeric: tabular-nums lining-nums"],
])("%s compiles to %s", async (className, declaration) => {
	expect(await build([className])).toContain(declaration);
});

test.each([
	"bg-red-500",
	"text-white",
	"border-black",
	"p-5",
	"m-7",
	"gap-10",
	"rounded-lg",
	"font-sans",
	"text-xl",
])("%s is off the scale and does not compile", async (className) => {
	const withClass = await build([className]);
	const without = await build([]);

	expect(withClass).toBe(without);
});

test("emits no theme variable that refers to itself", async () => {
	const css = await build(["rounded-paper", "font-doc", "text-verdict"]);

	expect(css).not.toMatch(/(--[\w-]+):\s*var\(\1\)/);
});

test("breakpoints are 768, 1024 and 1280 px", async () => {
	const css = await build(["md:p-4", "lg:p-4", "xl:p-4", "sm:p-4"]);

	expect(css).toContain("(width >= 768px)");
	expect(css).toContain("(width >= 1024px)");
	expect(css).toContain("(width >= 1280px)");
	expect(css).not.toContain("40rem");
});

test("forced colors hands the surface tokens to system colours and keeps the outline", () => {
	const css = read(themeUrl);
	const forced = css.slice(css.indexOf("@media (forced-colors: active)"));

	expect(forced).toMatch(/--control-border: CanvasText;/);
	expect(forced).toMatch(/--focus: Highlight;/);
	expect(forced).not.toMatch(/outline:\s*(none|0)/);
});
