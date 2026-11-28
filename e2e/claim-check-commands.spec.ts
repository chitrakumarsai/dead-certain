import { answer, encode, start } from "@dead-certain/engine";
import type { Page } from "@playwright/test";
import { claimKb } from "./claim-check-engine";
import { openClaimCheck, questionHeading } from "./claim-check-helpers";
import { expect, test } from "./kit-fixtures";

// claim-check task 17, requirements 16.1 to 16.4: the theme toggle, the
// command menu's items and the "Link copied" toast.
const DENIED = {
	claimed: 1_00_000_00,
	cause: "accident",
	treatment: "cosmetic",
};
const VERDICT = `#/?r=${encode(
	Object.entries(DENIED).reduce((s, [f, v]) => answer(s, f, v), start(claimKb)),
)}`;

const input = (page: Page) => page.getByRole("combobox", { name: "Go to" });
const options = (page: Page) =>
	page.getByRole("listbox", { name: "Results" }).getByRole("option");
const seeWhy = (page: Page) =>
	page.getByRole("button", { name: "See why", exact: true });
// Radix returns focus to the trigger when the menu closes (kit, ui-kit 13.2).
const trigger = (page: Page) => page.locator("header [data-command-trigger]");

/** Opens the menu from the focused element, filters, and runs the first match. */
async function run(page: Page, query: string): Promise<void> {
	await page.keyboard.press("Control+k");
	await expect(input(page)).toBeFocused();
	await input(page).fill(query);
	await expect(options(page)).toHaveCount(1);
	await page.keyboard.press("Enter");
	await expect(input(page)).toBeHidden();
}

const wideOnly = (width: number | undefined) =>
	test.skip(
		(width ?? 0) < 768,
		"below 768 px the menu sits in the phone menu; the kit's spec covers it",
	);

test("the theme toggle switches the app and the choice survives a reload, in dc-theme only (16.1, 16.2)", async ({
	page,
}) => {
	await openClaimCheck(page, VERDICT);
	const html = page.locator("html");
	const toggle = page
		.getByRole("banner")
		.getByRole("button", { name: /theme\. Switch to/ });
	// The room follows the system until a choice is stored; dark is the default.
	const before = await page.evaluate(() =>
		matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
	);
	const after = before === "dark" ? "light" : "dark";
	await toggle.click();
	await expect(html).toHaveAttribute("data-theme", after);
	await page.reload();
	await expect(html).toHaveAttribute("data-theme", after);
	await expect(seeWhy(page)).toBeVisible();
	expect(
		await page.evaluate(() => ({
			local: Object.keys(localStorage),
			session: Object.keys(sessionStorage),
		})),
	).toEqual({ local: ["dc-theme"], session: [] });
});

test("Ctrl+K and Cmd+K open the menu on a verdict; Escape closes it and focus returns (16.3)", async ({
	page,
}, testInfo) => {
	wideOnly(testInfo.project.use.viewport?.width);
	await openClaimCheck(page, VERDICT);
	for (const chord of ["Control+k", "Meta+k"]) {
		await seeWhy(page).focus();
		await page.keyboard.press(chord);
		await expect(input(page), chord).toBeFocused();
		await expect(options(page).first()).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(input(page), chord).toBeHidden();
		await expect(trigger(page), chord).toBeFocused();
	}
});

test("the menu offers start over, copy link, the rulebook and the answers (16.3)", async ({
	page,
}, testInfo) => {
	wideOnly(testInfo.project.use.viewport?.width);
	await openClaimCheck(page, VERDICT);
	await page.keyboard.press("Control+k");
	// Wait for the whole list: start over, copy link, rulebook, and one Change per answer.
	await expect(options(page)).toHaveCount(3 + Object.keys(DENIED).length);
	const labels = await options(page).allTextContents();
	for (const label of [
		"Start over",
		"Copy link to this verdict",
		"Open the rulebook",
	])
		expect(
			labels.some((l) => l.includes(label)),
			label,
		).toBe(true);
	// One "Change" item per answer: all three of DENIED's are relevant.
	expect(labels.filter((l) => l.startsWith("Change")).length).toBe(
		Object.keys(DENIED).length,
	);
	expect(labels.length).toBeLessThanOrEqual(60);
});

test("Copy link from the menu copies, shows Link copied in the toast and the live region, and focus returns (16.3, 16.4)", async ({
	page,
	context,
}, testInfo) => {
	wideOnly(testInfo.project.use.viewport?.width);
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await openClaimCheck(page, VERDICT);
	await seeWhy(page).focus();
	await run(page, "copy link");
	await expect(page.locator("[data-toast]")).toContainText("Link copied");
	await expect(page.locator("[aria-live]")).toHaveText("Link copied");
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		page.url(),
	);
	await expect(trigger(page)).toBeFocused();

	// Dismiss takes its own button away, so focus moves to the copy button.
	await page
		.locator("[data-toast]")
		.getByRole("button", { name: "Dismiss" })
		.click();
	await expect(page.locator("[data-toast]")).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Copy link to this verdict" }),
	).toBeFocused();
});

test("a Change item reopens that question, the rulebook item opens the rulebook, and Start over starts over (16.3)", async ({
	page,
}, testInfo) => {
	wideOnly(testInfo.project.use.viewport?.width);
	const label = claimKb.facts.cause?.label ?? "cause";
	await openClaimCheck(page, VERDICT);
	await run(page, `Change ${label}`);
	await expect(questionHeading(page)).toBeFocused();
	await expect(page.getByRole("radio", { name: "Accident" })).toBeChecked();

	await run(page, "rulebook");
	await expect(page).toHaveURL(/#\/rulebook/);

	await openClaimCheck(page, VERDICT);
	await run(page, "start over");
	await expect(
		page.getByRole("button", { name: "Start the check" }),
	).toBeVisible();
});
