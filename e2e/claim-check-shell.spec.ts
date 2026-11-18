import { CLAIM_CHECK_URL } from "../playwright.config";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

test("Claim Check opens in the app shell with its nav and footer", async ({
	page,
}) => {
	await page.goto(CLAIM_CHECK_URL);
	const nav = page.getByRole("navigation", { name: "Main" });
	// Below 768 px the nav sits behind the Menu button.
	const menu = page.getByRole("button", { name: "Menu" });
	if (await menu.isVisible()) await menu.click();
	await expect(nav.getByRole("link", { name: "Claim Check" })).toHaveAttribute(
		"aria-current",
		"page",
	);
	await expect(nav.getByRole("link", { name: "Rulebook" })).toBeVisible();
	await expect(page.getByRole("contentinfo")).toHaveText(
		"No guesses were made in the production of this verdict.",
	);
	await expectNoAxeViolations(page);
});
