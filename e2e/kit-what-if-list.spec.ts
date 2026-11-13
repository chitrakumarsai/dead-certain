import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const specimen = (page: Page, state: string) =>
	page.locator(`[data-specimen="whatiflist-${state}"]`);

test("the what-if specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#whatiflist-money");

	for (const state of ["money", "no-money", "empty"]) {
		await expect(specimen(page, state), state).toHaveCount(1);
		await expectNoAxeViolations(page, `[data-specimen="whatiflist-${state}"]`);
	}
});

test("with a money goal each row shows the signed change in the amount", async ({
	page,
}) => {
	await page.goto("./kit/#whatiflist-money");
	const money = specimen(page, "money");

	await expect(
		money.getByRole("heading", { name: "What would change this" }),
	).toBeVisible();
	await expect(money.getByRole("listitem")).toHaveText([
		"If room rent per day were ₹5,000: + ₹38,000",
		"If age were 60: + ₹29,500",
	]);
});

test("without a money goal each row names the new verdict", async ({
	page,
}) => {
	await page.goto("./kit/#whatiflist-no-money");

	await expect(specimen(page, "no-money").getByRole("listitem")).toHaveText([
		"If public repository were no: Ready to Not ready",
		"If license file GitHub can detect were no: Ready to Not ready",
	]);
});

test("rows are plain text, and an empty list renders nothing", async ({
	page,
}) => {
	await page.goto("./kit/#whatiflist-money");

	await expect(specimen(page, "money").locator("button, a, input")).toHaveCount(
		0,
	);
	const empty = specimen(page, "empty");
	await expect(empty.locator("h2, [role=heading], ul")).toHaveCount(0);
	await expect(empty.locator("[data-whatif-host]")).toBeEmpty();
});
