import { PRE_FLIGHT_URL } from "../playwright.config";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

test("Pre-Flight opens in the shell with its nav and footer", async ({
	page,
}) => {
	await page.goto(PRE_FLIGHT_URL);
	await expect(page).toHaveTitle(
		"Pre-Flight: check a GitHub repository before you submit",
	);
	// At 390 px the nav sits behind the Menu button.
	const menu = page.getByRole("button", { name: "Menu" });
	if (await menu.isVisible()) await menu.click();
	await expect(
		page.getByRole("navigation", { name: "Main" }).getByRole("link", {
			name: "Pre-Flight",
		}),
	).toBeVisible();
	await expect(page.getByRole("contentinfo")).toContainText(
		"No guesses were made",
	);
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await expectNoAxeViolations(page);
});

test("any route shows the start screen", async ({ page }) => {
	await page.goto(`${PRE_FLIGHT_URL}#/anything`);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"Check a repository before you submit it",
	);
});
