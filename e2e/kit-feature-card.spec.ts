import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

// ui-kit 14.2: FeatureCard and Illustration, and the gallery's CommandMenu.
const specimen = (page: Page, id: string) =>
	page.locator(`[data-specimen="${id}"]`);

test("a card: radius 12, a decorative edge, the inset highlight and no grain", async ({
	page,
}) => {
	await page.goto("./kit/#featurecard-plain");
	const cards = specimen(page, "featurecard-plain").locator(
		"[data-feature-card]",
	);

	await expect(cards).toHaveCount(3);
	for (const card of await cards.all()) {
		await expect(card).toHaveCSS("border-radius", "12px");
		await expect(card).toHaveCSS("border-top-width", "1px");
		await expect(card).toHaveCSS("box-shadow", /inset/);
		// Grain is film's alone.
		await expect(card).toHaveCSS("background-image", "none");
		await expect(card.locator("[data-spotlight], [data-shine]")).toHaveCount(0);
	}
	await expectNoAxeViolations(page, '[data-specimen^="featurecard-"]');
});

test("the spotlight follows the pointer, and holds still under reduced motion", async ({
	page,
}, testInfo) => {
	test.skip(
		(testInfo.project.use.viewport?.width ?? 0) < 768,
		"hover is a pointer feature",
	);
	await page.goto("./kit/#featurecard-effects");
	const card = specimen(page, "featurecard-effects")
		.locator("[data-feature-card]")
		.first();
	const spotlight = card.locator("[data-spotlight]");
	const box = await card.boundingBox();
	if (!box) throw new Error("no card box");

	await page.mouse.move(box.x + 40, box.y + 30);
	await page.mouse.move(box.x + 60, box.y + 50);

	await expect(spotlight).toHaveCSS("opacity", "1");
	const reduced = testInfo.project.name === "reduced-motion";
	const [x, y] = (
		await spotlight.evaluate((el) => getComputedStyle(el).translate)
	)
		.split(" ")
		.map(Number.parseFloat);
	expect(x).toBeCloseTo(reduced ? 48 : 60, 0);
	expect(y).toBeCloseTo(reduced ? 48 : 50, 0);
	await expect(card.locator("[data-shine]")).toHaveCSS(
		"display",
		reduced ? "none" : "block",
	);
});

test("illustrations are 48 px inline drawings in currentColor, hidden from assistive technology", async ({
	page,
}) => {
	await page.goto("./kit/#illustration-set");
	const drawings = specimen(page, "illustration-set").locator(
		"svg[data-illustration]",
	);

	await expect(drawings).toHaveCount(4);
	for (const svg of await drawings.all()) {
		await expect(svg).toHaveAttribute("aria-hidden", "true");
		await expect(svg).toHaveAttribute("stroke", "currentColor");
		await expect(svg).toHaveAttribute("stroke-width", "1.5");
		const size = await svg.boundingBox();
		expect(size?.width).toBe(48);
		expect(size?.height).toBe(48);
	}
});

test("the gallery's command menu goes to a section", async ({ page }) => {
	await page.goto("./kit/#commandmenu-gallery");

	await specimen(page, "commandmenu-gallery")
		.locator("[data-command-trigger]")
		.click();
	await page.getByRole("combobox").fill("FeatureCard");
	await page.keyboard.press("Enter");

	await expect(page).toHaveURL(/#featurecard-plain$/);
});
