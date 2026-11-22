import { expect, expectNoAxeViolations, test } from "./kit-fixtures";
import { openLanding, proofTree, seeWhy } from "./site-helpers";
import { horizontalOverflow, smallTargets } from "./sweep";

// Axe, touch targets and reflow (requirements 7.3, 9.4).
test("the page: no axe violations, every target at least 44 px", async ({
	page,
}) => {
	await openLanding(page);
	await expectNoAxeViolations(page);
	expect(await smallTargets(page)).toEqual([]);
});

test("with the X-ray open: no axe violations", async ({ page }) => {
	await openLanding(page);
	await seeWhy(page).click();
	await expect(proofTree(page)).toBeVisible();
	await expectNoAxeViolations(page);
});

test("the 404 page: no axe violations", async ({ page }) => {
	await page.goto("404.html");
	await page.evaluate(() => document.fonts.ready);
	await expectNoAxeViolations(page);
});

test("no sideways scroll at 320 px or at 200% zoom", async ({ page }, info) => {
	test.skip(info.project.name !== "1280", "sets its own viewport");
	for (const width of [320, 640]) {
		await page.setViewportSize({ width, height: 800 });
		await openLanding(page);
		expect(await horizontalOverflow(page), `${width} px`).toBeLessThanOrEqual(
			0,
		);
	}
});
