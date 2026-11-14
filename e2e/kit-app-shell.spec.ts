import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const SHELL = "./kit/shell.html";

test("the skip link is the first Tab stop and moves focus to main", async ({
	page,
}) => {
	await page.goto(SHELL);
	const skip = page.getByRole("link", { name: "Skip to the content" });
	// Tab before React mounts lands nowhere; a slow CI runner showed it.
	await expect(skip).toBeAttached();

	await page.keyboard.press("Tab");
	await expect(skip).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.locator("main#content")).toBeFocused();
	await expect(page.locator("main#content")).toHaveAttribute("tabindex", "-1");
	// Apps route in the hash, so the skip link must not change it.
	expect(new URL(page.url()).hash).toBe("");
});

test("landmarks, the current page, the default footer and one live region", async ({
	page,
}) => {
	await page.goto(SHELL);

	await expect(page.getByRole("banner")).toHaveCount(1);
	await expect(page.getByRole("banner")).toContainText("Dead Certain");
	await expect(page.getByRole("banner")).toContainText("Claim Check");
	await expect(page.getByRole("main")).toHaveCount(1);
	await expect(page.getByRole("contentinfo")).toHaveText(
		"No guesses were made in the production of this verdict.",
	);
	await expect(page.locator("[aria-live]")).toHaveCount(1);
	if (isPhone(page)) await page.getByRole("button", { name: "Menu" }).click();
	await expect(page.locator('nav a[aria-current="page"]')).toHaveText(
		"Claim check",
	);
	await expect(page.locator('nav a[aria-current="page"]')).toHaveCount(1);
	await expectNoAxeViolations(page);
});

test("on phones the navigation sits behind Menu, which Escape and navigation close", async ({
	page,
}) => {
	await page.goto(SHELL);
	const menu = page.getByRole("button", { name: "Menu" });
	const rulebook = page.getByRole("link", { name: "Rulebook" });

	if (!isPhone(page)) {
		await expect(menu).toHaveCount(0);
		await expect(rulebook).toBeVisible();
		return;
	}
	await expect(menu).toHaveAttribute("aria-expanded", "false");
	await expect(rulebook).toBeHidden();

	await menu.click();
	await expect(menu).toHaveAttribute("aria-expanded", "true");
	await expect(rulebook).toBeVisible();
	await expectNoAxeViolations(page);
	await page.keyboard.press("Escape");
	await expect(rulebook).toBeHidden();
	await expect(menu).toBeFocused();

	await menu.click();
	await rulebook.click();
	await expect(menu).toHaveAttribute("aria-expanded", "false");
	await expect(rulebook).toBeHidden();
});

test("the gallery shows the shell framed at desktop and phone widths", async ({
	page,
}) => {
	await page.goto("./kit/#appshell-desktop");

	for (const id of ["desktop", "phone-closed", "phone-open"]) {
		const frame = page.locator(`[data-specimen="appshell-${id}"] iframe`);
		await expect(frame, id).toHaveCount(1);
		await expect(frame).toHaveAttribute("title", /Dead Certain shell/);
	}
	const open = page.frameLocator(
		'[data-specimen="appshell-phone-open"] iframe',
	);
	await expect(open.getByRole("button", { name: "Menu" })).toHaveAttribute(
		"aria-expanded",
		"true",
	);
	// The shell page is checked with axe on its own above. Across iframes axe
	// would read three pages' landmarks and headings as one.
});

test("the rail stacks above the content below 1024 px and sits beside it from 1024 px", async ({
	page,
}) => {
	await page.goto(SHELL);
	const rail = await page.locator("[data-rail-slot]").boundingBox();
	const main = await page.locator("main#content").boundingBox();
	if (!rail || !main) throw new Error("the shell page has no rail or main");
	const width = page.viewportSize()?.width ?? 0;

	if (width < 1024) {
		// Above: the rail ends before the content begins, and both start at the left.
		expect(rail.y + rail.height).toBeLessThanOrEqual(main.y);
		expect(Math.abs(rail.x - main.x)).toBeLessThan(1);
	} else {
		// Beside: the rail ends before the content begins, on the same row.
		expect(rail.x + rail.width).toBeLessThanOrEqual(main.x);
		expect(Math.abs(rail.y - main.y)).toBeLessThan(1);
	}
});
