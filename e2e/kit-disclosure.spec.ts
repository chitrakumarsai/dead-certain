import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const trigger = (page: Page, id: string) =>
	page
		.locator(`[data-specimen="${id}"]`)
		.getByRole("button", { name: "Why this question?" })
		.first();

test("the three disclosure specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#disclosure-closed");

	for (const id of [
		"disclosure-closed",
		"disclosure-open",
		"disclosure-nested-film",
	]) {
		await expect(page.locator(`[data-specimen="${id}"]`), id).toHaveCount(1);
		await expectNoAxeViolations(page, `[data-specimen="${id}"]`);
	}
	await expect(
		page.locator(
			'[data-specimen="disclosure-nested-film"] [data-surface="film"]',
		),
	).toHaveCount(1);
});

test("the trigger is a button that reports and controls its panel", async ({
	page,
}) => {
	await page.goto("./kit/#disclosure-open");
	const open = trigger(page, "disclosure-open");

	await expect(open).toHaveAttribute("aria-expanded", "true");
	const panelId = await open.getAttribute("aria-controls");
	expect(panelId).toBeTruthy();
	await expect(page.locator(`[id="${panelId}"]`)).toBeVisible();
	await expect(page.locator(`[id="${panelId}"]`)).toContainText(
		"The policy caps room rent",
	);

	await expect(trigger(page, "disclosure-closed")).toHaveAttribute(
		"aria-expanded",
		"false",
	);
});

test("click, Enter and Space each toggle the panel", async ({ page }) => {
	await page.goto("./kit/#disclosure-closed");
	const closed = trigger(page, "disclosure-closed");
	const panel = page
		.locator('[data-specimen="disclosure-closed"]')
		.getByText("The policy caps room rent");

	await closed.click();
	await expect(closed).toHaveAttribute("aria-expanded", "true");
	await expect(panel).toBeVisible();

	await closed.focus();
	await page.keyboard.press("Enter");
	await expect(closed).toHaveAttribute("aria-expanded", "false");
	await expect(panel).toBeHidden();

	await page.keyboard.press("Space");
	await expect(closed).toHaveAttribute("aria-expanded", "true");
});

test("Escape inside the panel closes it and returns focus to the trigger", async ({
	page,
}) => {
	await page.goto("./kit/#disclosure-open");
	const open = trigger(page, "disclosure-open");
	const inside = page
		.locator('[data-specimen="disclosure-open"]')
		.getByRole("button", { name: "Read clause 4.2" });

	await inside.focus();
	await page.keyboard.press("Escape");

	await expect(open).toHaveAttribute("aria-expanded", "false");
	await expect(open).toBeFocused();
});

test("Escape in a nested panel closes only that panel", async ({ page }) => {
	await page.goto("./kit/#disclosure-nested-film");
	const specimen = page.locator('[data-specimen="disclosure-nested-film"]');
	const outer = specimen.getByRole("button", { name: "Show the rule" });
	const inner = specimen.getByRole("button", { name: "Why this question?" });

	if ((await outer.getAttribute("aria-expanded")) === "false")
		await outer.click();
	await inner.click();
	await expect(inner).toHaveAttribute("aria-expanded", "true");
	await specimen.getByRole("button", { name: "Read clause 4.2" }).focus();
	await page.keyboard.press("Escape");

	await expect(inner).toHaveAttribute("aria-expanded", "false");
	await expect(inner).toBeFocused();
	await expect(outer).toHaveAttribute("aria-expanded", "true");
});

test("the chevron is hidden and swaps its glyph", async ({ page }) => {
	await page.goto("./kit/#disclosure-closed");
	const closed = trigger(page, "disclosure-closed");
	const glyph = closed.locator("svg");

	await expect(glyph).toHaveAttribute("aria-hidden", "true");
	const before = await glyph.locator("path").getAttribute("d");
	await closed.click();
	const after = await glyph.locator("path").getAttribute("d");

	expect(before).not.toBe(after);
	await expect(glyph).toHaveCSS("transform", "none");
});

test("the panel opens over 200 ms, or instantly under reduced motion", async ({
	page,
}, testInfo) => {
	await page.goto("./kit/#disclosure-open");
	const open = trigger(page, "disclosure-open");
	const panel = page.locator(
		`[id="${await open.getAttribute("aria-controls")}"]`,
	);

	const expected = testInfo.project.name === "reduced-motion" ? "0s" : "0.2s";
	await expect(panel).toHaveCSS("animation-duration", expected);
	await expect(panel).toHaveCSS(
		"animation-timing-function",
		"cubic-bezier(0.2, 0, 0, 1)",
	);
});

test("controlled use: the owner opens and closes it, and hears the trigger", async ({
	page,
}) => {
	await page.goto("./kit/#disclosure-nested-film");
	const specimen = page.locator('[data-specimen="disclosure-nested-film"]');
	const outer = specimen.getByRole("button", { name: "Show the rule" });
	const owner = specimen.getByRole("button", {
		name: /the rule from outside$/,
	});

	const startOpen = (await outer.getAttribute("aria-expanded")) === "true";
	await owner.click();
	await expect(outer).toHaveAttribute("aria-expanded", String(!startOpen));
	await outer.click();
	await expect(outer).toHaveAttribute("aria-expanded", String(startOpen));
	await expect(owner).toHaveText(
		startOpen ? "Close the rule from outside" : "Open the rule from outside",
	);
});
