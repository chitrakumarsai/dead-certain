import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

// ui-kit tasks 13.1 and 13.2: the command trigger, Kbd and the command menu.
const trigger = (page: Page) => page.locator("header [data-command-trigger]");
const input = (page: Page) => page.getByRole("combobox", { name: "Go to" });
const options = (page: Page) =>
	page.getByRole("listbox", { name: "Results" }).getByRole("option");

test.beforeEach(async ({ page }, testInfo) => {
	test.skip(
		(testInfo.project.use.viewport?.width ?? 0) < 768,
		"the trigger sits in the phone menu; the wide header is tested here",
	);
	await page.goto("./");
});

test("the trigger follows the navigation and precedes the theme toggle, at 44 px, with its Kbd hint", async ({
	page,
}) => {
	const order = await page
		.locator("header")
		.locator("a, button")
		.evaluateAll((all) =>
			all.map((el) =>
				el.hasAttribute("data-command-trigger")
					? "trigger"
					: el.getAttribute("aria-label")?.includes("theme")
						? "toggle"
						: "link",
			),
		);
	expect(order.slice(-2)).toEqual(["trigger", "toggle"]);
	expect(order.slice(0, -2).every((kind) => kind === "link")).toBe(true);

	const box = await trigger(page).boundingBox();
	expect(box?.height).toBeGreaterThanOrEqual(44);
	expect(box?.width).toBeGreaterThanOrEqual(44);
	await expect(trigger(page)).toHaveAccessibleName(/^Go to/);
	await expect(trigger(page).locator("kbd")).toHaveCSS(
		"font-family",
		/Plex Mono/,
	);
	await expect(trigger(page).locator("kbd")).toHaveCSS("font-size", "13px");
});

test("Ctrl+K and Cmd+K open it with focus in the field; Escape closes it and focus returns", async ({
	page,
}) => {
	for (const chord of ["Control+k", "Meta+k"]) {
		await trigger(page).focus();
		await page.keyboard.press(chord);
		await expect(input(page), chord).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(input(page), chord).toBeHidden();
		await expect(trigger(page), chord).toBeFocused();
	}
});

test("typing filters, the count is announced, arrows move and Enter goes", async ({
	page,
}) => {
	await trigger(page).click();
	await expect(input(page)).toBeFocused();
	expect(await options(page).count()).toBeLessThanOrEqual(60);

	await input(page).fill("kit");
	await expect(options(page)).toHaveCount(1);
	await expect(page.locator("[aria-live]")).toHaveText("1 result");

	await input(page).fill("");
	const first = await options(page).first().getAttribute("id");
	await expect(input(page)).toHaveAttribute(
		"aria-activedescendant",
		first ?? "",
	);
	await page.keyboard.press("ArrowDown");
	const second = await options(page).nth(1).getAttribute("id");
	await expect(input(page)).toHaveAttribute(
		"aria-activedescendant",
		second ?? "",
	);
	await page.keyboard.press("ArrowUp");
	await page.keyboard.press("ArrowUp");
	const last = await options(page).last().getAttribute("id");
	await expect(input(page)).toHaveAttribute(
		"aria-activedescendant",
		last ?? "",
	);

	await input(page).fill("zzzz");
	await expect(options(page)).toHaveCount(0);
	await expect(page.locator("[aria-live]")).toHaveText("No results");

	await input(page).fill("kit");
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(/\/kit\/$/);
});

test("the open menu passes axe", async ({ page }) => {
	await trigger(page).click();
	await expect(input(page)).toBeFocused();
	await expectNoAxeViolations(page);
});
