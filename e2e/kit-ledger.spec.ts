import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const STATES = [
	"normal",
	"no-deductions",
	"zero",
	"unknown",
	"many",
	"selected",
	"wrap",
];
const specimen = (page: Page, state: string) =>
	page.locator(`[data-specimen="ledger-${state}"]`);
const table = (page: Page, state: string) =>
	specimen(page, state).getByRole("table", { name: "Claim ledger" });

test("the ledger specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#ledger-normal");

	for (const state of STATES) {
		await expect(table(page, state), state).toHaveCount(1);
		await expectNoAxeViolations(page, `[data-specimen="ledger-${state}"]`);
	}
});

test("rows print label, clause and the formatted amount, and sum nothing", async ({
	page,
}) => {
	await page.goto("./kit/#ledger-normal");
	const rows = table(page, "normal").locator("tbody tr, tfoot tr");

	await expect(rows).toHaveCount(4);
	await expect(rows.nth(0)).toHaveText(/^Claimed\s*₹2,10,000$/);
	await expect(rows.nth(1)).toHaveText(
		/^Room rent above the limit\s*4\.2\s*− ₹38,000$/,
	);
	await expect(rows.nth(2)).toHaveText(
		/^Co-payment at age 61 or over\s*6\.1\s*− ₹29,500$/,
	);
	await expect(rows.nth(3)).toHaveText(/^Payable\s*₹1,42,500$/);
	await expect(rows.locator('th[scope="row"]')).toHaveCount(4);
	await expect(rows.nth(1).locator("[data-clause]")).toHaveCSS(
		"font-family",
		/IBM Plex Mono/,
	);
	await expect(rows.nth(1).locator("[data-amount]")).toHaveCSS(
		"text-align",
		"right",
	);
});

test("each item row is a button named for its proof, and opens it", async ({
	page,
}) => {
	await page.goto("./kit/#ledger-normal");
	const normal = specimen(page, "normal");
	const button = normal.getByRole("button", {
		name: "Room rent above the limit, clause 4.2, minus ₹38,000. See why",
	});

	await expect(button).toBeVisible();
	await expect(normal.getByRole("button")).toHaveCount(2);
	// The button's overlay covers the amount cell, so the click lands on the button.
	await normal
		.locator("tbody tr")
		.nth(1)
		.locator("[data-amount]")
		.click({ force: true });
	await expect(normal.locator("[data-opened]")).toHaveText(
		"room_rent_deduction from BUTTON",
	);
	await button.focus();
	await page.keyboard.press("Enter");
	await expect(normal.locator("[data-opened]")).toHaveText(
		"room_rent_deduction from BUTTON",
	);
});

test("the selected row is aria-current", async ({ page }) => {
	await page.goto("./kit/#ledger-selected");
	const rows = table(page, "selected").locator('tr[aria-current="true"]');

	await expect(rows).toHaveCount(1);
	await expect(rows).toContainText("Co-payment at age 61 or over");
});

test("edge states: no deductions, zero omitted, unknown still openable, 30 rows", async ({
	page,
}) => {
	await page.goto("./kit/#ledger-no-deductions");

	await expect(
		table(page, "no-deductions").locator("tbody tr, tfoot tr"),
	).toHaveCount(2);
	await expect(table(page, "zero")).not.toContainText("₹0");
	await expect(table(page, "zero").getByRole("button")).toHaveCount(1);
	await expect(
		specimen(page, "unknown").getByRole("button", {
			name: "Co-payment at age 61 or over, clause 6.1, not known yet. See why",
		}),
	).toBeVisible();
	await expect(table(page, "unknown")).toContainText("Not known yet");
	await expect(table(page, "many").getByRole("button")).toHaveCount(30);
});

test("at 320 px labels wrap, amounts never do, and nothing scrolls sideways", async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await page.goto("./kit/#ledger-wrap");
	const wrap = table(page, "wrap");

	const label = wrap.locator("tbody tr").nth(1).locator("th");
	const amount = wrap.locator("tbody tr").nth(1).locator("[data-amount]");
	const lineHeight = Number.parseFloat(
		await amount.evaluate((el) => getComputedStyle(el).lineHeight),
	);
	expect((await label.boundingBox())?.height ?? 0).toBeGreaterThan(
		lineHeight * 1.5,
	);
	for (const cell of await wrap.locator("[data-amount]").all()) {
		await expect(cell).toHaveCSS("white-space", "nowrap");
		const box = await cell.locator("span").first().boundingBox();
		expect(box?.height ?? 0).toBeLessThan(lineHeight * 1.5);
	}
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - innerWidth,
	);
	expect(overflow).toBeLessThanOrEqual(0);
});
