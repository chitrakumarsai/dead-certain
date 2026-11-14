import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const STATES = ["plain", "deciding", "deciding-mark", "mark-not-found", "long"];
const SURFACES = ["paper", "film"] as const;
const WAX = "rgb(242, 193, 46)";
const DIVIDER = { paper: "rgb(201, 213, 217)", film: "rgb(143, 166, 174)" };
const MARK_TEXT = { paper: "rgb(19, 34, 44)", film: "rgb(11, 28, 38)" };

const quote = (page: Page, state: string, surface: string) =>
	page.locator(`[data-specimen="clausequote-${state}-${surface}"] blockquote`);

test("every clause quote specimen exists and passes axe", async ({ page }) => {
	await page.goto("./kit/#clausequote-heading");

	for (const surface of SURFACES) {
		for (const state of STATES) {
			await expect(
				quote(page, state, surface),
				`${state} ${surface}`,
			).toHaveCount(1);
		}
	}
	await expectNoAxeViolations(page, '[data-specimen^="clausequote-"]');
});

test("the heading line is the clause id and title in the System voice", async ({
	page,
}) => {
	await page.goto("./kit/#clausequote-plain-paper");
	const plain = quote(page, "plain", "paper");
	const heading = plain.locator("[data-clause-heading]");

	await expect(heading).toHaveText(/^Clause 4\.2\s+Room rent limit$/);
	await expect(heading).toHaveCSS("font-family", /^"IBM Plex Sans"/);
	const body = plain.locator("[data-clause-text]");
	await expect(body).toHaveCSS("font-family", /^"IBM Plex Serif"/);
	await expect(body).toHaveCSS("font-size", "17px");
	await expect(body).toHaveCSS("line-height", "28px");
});

for (const surface of SURFACES) {
	test(`plain draws a divider rule and deciding a wax rule, on ${surface}`, async ({
		page,
	}) => {
		await page.goto(`./kit/#clausequote-plain-${surface}`);

		const plain = quote(page, "plain", surface);
		await expect(plain).toHaveCSS("border-left-width", "2px");
		await expect(plain).toHaveCSS("border-left-color", DIVIDER[surface]);
		const deciding = quote(page, "deciding", surface);
		await expect(deciding).toHaveCSS("border-left-width", "2px");
		await expect(deciding).toHaveCSS("border-left-color", WAX);
	});

	test(`only the mark specimen highlights, in wax behind dark text, on ${surface}`, async ({
		page,
	}) => {
		await page.goto(`./kit/#clausequote-deciding-mark-${surface}`);
		const marks = page.locator(
			`[data-specimen^="clausequote-"][data-specimen$="-${surface}"] mark`,
		);

		await expect(marks).toHaveCount(1);
		const mark = quote(page, "deciding-mark", surface).locator("mark");
		await expect(mark).toHaveText("1% of the sum insured per day");
		await expect(mark).toHaveCSS("background-color", WAX);
		await expect(mark).toHaveCSS("color", MARK_TEXT[surface]);
		await expect(
			quote(page, "mark-not-found", surface).locator("mark"),
		).toHaveCount(0);
	});
}

test("a clause id with no clause prints the id as plain text, not a quote", async ({
	page,
}) => {
	await page.goto("./kit/#clausequote-id-only");
	const specimen = page.locator('[data-specimen="clausequote-id-only"]');

	await expect(specimen.locator("blockquote")).toHaveCount(0);
	await expect(specimen.getByText("Clause 9.9", { exact: true })).toBeVisible();
});

test("long clause text wraps inside the column", async ({ page }) => {
	await page.goto("./kit/#clausequote-long-paper");
	const box = await quote(page, "long", "paper").boundingBox();

	expect(box?.width).toBeLessThanOrEqual(680);
	expect(box?.height).toBeGreaterThan(100);
	const scrolls = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth,
	);
	expect(scrolls).toBe(false);
});
