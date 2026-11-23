import type { Locator, Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const VARIANTS = ["primary", "secondary", "quiet", "wax"] as const;
const STATES = ["default", "disabled"] as const;
const SURFACES = ["paper", "film"] as const;

const INK = "rgb(19, 34, 44)";
const INK_SOFT = "rgb(74, 90, 100)";
const PAPER = "rgb(252, 254, 254)";
const BONE = "rgb(220, 232, 235)";
const BONE_SOFT = "rgb(143, 166, 174)";
const FILM = "rgb(11, 28, 38)";
const FOCUS_PAPER = "rgb(31, 111, 235)";
const WAX = "rgb(242, 193, 46)";
const WAX_HOVER = "rgb(246, 207, 85)";
const ON_WAX = "rgb(7, 19, 26)";

const button = (page: Page, id: string): Locator =>
	page.locator(`[data-specimen="${id}"] button`);

test("the gallery has all sixteen button specimens", async ({ page }) => {
	await page.goto("./kit/#button-primary-default-paper");

	for (const variant of VARIANTS) {
		for (const state of STATES) {
			for (const surface of SURFACES) {
				const id = `button-${variant}-${state}-${surface}`;
				await expect(page.locator(`[data-specimen="${id}"]`), id).toHaveCount(
					1,
				);
				await expect(button(page, id), id).toHaveCount(1);
			}
		}
	}
	await expectNoAxeViolations(
		page,
		"#buttons-heading + *, [data-specimen^='button-']",
	);
});

test("every gallery button is at least 44 by 44 px with an 8 px radius", async ({
	page,
}) => {
	await page.goto("./kit/#button-primary-default-paper");
	const buttons = page.locator('[data-specimen^="button-"] button');

	await expect(buttons).toHaveCount(16);
	for (const each of await buttons.all()) {
		const box = await each.boundingBox();
		expect(box?.width).toBeGreaterThanOrEqual(44);
		expect(box?.height).toBeGreaterThanOrEqual(44);
		await expect(each).toHaveCSS("border-radius", "8px");
	}
});

test("primary is ink on paper and bone on film", async ({ page }) => {
	await page.goto("./kit/#button-primary-default-paper");

	const onPaper = button(page, "button-primary-default-paper");
	await expect(onPaper).toHaveCSS("background-color", INK);
	await expect(onPaper).toHaveCSS("color", PAPER);
	const onFilm = button(page, "button-primary-default-film");
	await expect(onFilm).toHaveCSS("background-color", BONE);
	await expect(onFilm).toHaveCSS("color", FILM);
});

test("secondary has a control-border outline and quiet is underlined", async ({
	page,
}) => {
	await page.goto("./kit/#button-secondary-default-paper");

	const secondary = button(page, "button-secondary-default-paper");
	await expect(secondary).toHaveCSS("border-top-color", INK_SOFT);
	await expect(secondary).toHaveCSS("border-top-style", "solid");
	await expect(button(page, "button-secondary-default-film")).toHaveCSS(
		"border-top-color",
		BONE_SOFT,
	);
	await expect(button(page, "button-quiet-default-paper")).toHaveCSS(
		"text-decoration-line",
		"underline",
	);
});

test("hover and press change colour over 120 ms, with no movement or shadow", async ({
	page,
}) => {
	await page.goto("./kit/#button-primary-default-paper");
	const primary = button(page, "button-primary-default-paper");

	await expect(primary).toHaveCSS("transition-duration", "0.12s");
	await primary.hover();
	await expect(primary).toHaveCSS("background-color", INK_SOFT);

	await page.mouse.down();
	await expect(primary).toHaveCSS("background-color", INK);
	await expect(primary).toHaveCSS("transform", "none");
	await expect(primary).toHaveCSS("box-shadow", "none");
	await page.mouse.up();

	const filmPrimary = button(page, "button-primary-default-film");
	await filmPrimary.hover();
	await expect(filmPrimary).toHaveCSS("background-color", BONE_SOFT);
});

test("keyboard focus draws the surface focus ring", async ({ page }) => {
	await page.goto("./kit/#button-primary-default-paper");

	const onPaper = button(page, "button-secondary-default-paper");
	await onPaper.focus();
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Tab");
	await expect(onPaper).toBeFocused();
	await expect(onPaper).toHaveCSS("outline-color", FOCUS_PAPER);
	await expect(onPaper).toHaveCSS("outline-width", "2px");

	const onFilm = button(page, "button-secondary-default-film");
	await onFilm.focus();
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Tab");
	await expect(onFilm).toBeFocused();
	await expect(onFilm).toHaveCSS("outline-color", WAX);
});

test("a disabled button stays in the tab order, says why, and does nothing", async ({
	page,
}) => {
	await page.goto("./kit/#button-primary-disabled-paper");
	const region = page.locator("[aria-live]");
	const disabled = button(page, "button-primary-disabled-paper");

	await expect(disabled).toHaveAttribute("aria-disabled", "true");
	await expect(disabled).not.toHaveAttribute("disabled");
	await expect(disabled).toHaveAccessibleDescription(
		"Answer the question first.",
	);
	await disabled.focus();
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Tab");
	await expect(disabled).toBeFocused();

	// Playwright waits on aria-disabled controls; force the click to prove it is ignored.
	await disabled.click({ force: true });
	await page.keyboard.press("Enter");
	await expect(region).toBeEmpty();

	await button(page, "button-primary-default-paper").click();
	await expect(region).toHaveText("Continue pressed.");
});

test("no rendered button label in the gallery contains an arrow", async ({
	page,
}) => {
	await page.goto("./kit/");
	const labels = await page
		.getByRole("button")
		.evaluateAll((all) => all.map((b) => b.textContent ?? ""));

	expect(labels.length).toBeGreaterThan(16);
	expect(labels.filter((label) => /[→←↑↓➜»«]/u.test(label))).toEqual([]);
});

test("wax is a wax fill with on-wax text and a soft glow, on paper and film, in either theme", async ({
	page,
}) => {
	await page.goto("./kit/#button-wax-default-paper");

	for (const surface of SURFACES) {
		const wax = button(page, `button-wax-default-${surface}`);
		await expect(wax, surface).toHaveCSS("background-color", WAX);
		await expect(wax, surface).toHaveCSS("color", ON_WAX);
		// The glow comes from the --glow-wax-soft depth token.
		await expect(wax, surface).toHaveClass(/\bglow-wax-soft\b/);
		await expect(wax, surface).not.toHaveCSS("box-shadow", "none");
	}
	const onPaper = button(page, "button-wax-default-paper");
	await onPaper.hover();
	await expect(onPaper).toHaveCSS("background-color", WAX_HOVER);
	await page.mouse.down();
	await expect(onPaper).toHaveCSS("background-color", WAX);
	await expect(onPaper).toHaveCSS("transform", "none");
	await page.mouse.up();
});

test("wax: keyboard focus draws the surface ring, and disabled drops the fill", async ({
	page,
}) => {
	await page.goto("./kit/#button-wax-default-paper");

	const onPaper = button(page, "button-wax-default-paper");
	await onPaper.focus();
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Tab");
	await expect(onPaper).toBeFocused();
	await expect(onPaper).toHaveCSS("outline-color", FOCUS_PAPER);
	await expect(onPaper).toHaveCSS("outline-width", "2px");

	const onFilm = button(page, "button-wax-default-film");
	await onFilm.focus();
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Tab");
	await expect(onFilm).toBeFocused();
	await expect(onFilm).toHaveCSS("outline-color", WAX);

	const disabled = button(page, "button-wax-disabled-paper");
	await expect(disabled).toHaveAttribute("aria-disabled", "true");
	await expect(disabled).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(disabled).toHaveCSS("border-top-style", "dashed");
});
