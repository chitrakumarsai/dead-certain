import { openClaimCheck, questionHeading } from "./claim-check-helpers";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

test.describe("Claim Check start screen", () => {
	test("shows the heading, the paragraph, both controls and both lines", async ({
		page,
	}) => {
		await openClaimCheck(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			"Check a hospital claim before you file it",
		);
		await expect(page.getByText("Answer a few questions.")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Start the check" }),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Read the sample policy" }),
		).toHaveAttribute("href", "#/rulebook");
		await expect(
			page.getByText("Uses a sample policy written for this demo."),
		).toBeVisible();
		await expect(
			page.getByText("Your answers stay in your browser."),
		).toBeVisible();
		await expect(page).toHaveTitle(
			"Check a hospital claim before you file it. Claim Check",
		);
		await expectNoAxeViolations(page);
	});

	test("Enter on the button starts and focus lands on the question heading", async ({
		page,
	}) => {
		await openClaimCheck(page);
		await page.getByRole("button", { name: "Start the check" }).focus();
		await page.keyboard.press("Enter");
		await expect(questionHeading(page)).toBeFocused();
		await expect(questionHeading(page)).toHaveText(
			"What is the total on the final hospital bill?",
		);
	});

	test("has no uppercase text and no arrow glyph", async ({ page }) => {
		await openClaimCheck(page);
		const transforms = await page
			.locator("main *")
			.evaluateAll((els) =>
				els.map((el) => getComputedStyle(el).textTransform),
			);
		expect(transforms).not.toContain("uppercase");
		await expect(page.locator("main")).not.toContainText(/[→←↑↓›‹»«]/);
	});
});
