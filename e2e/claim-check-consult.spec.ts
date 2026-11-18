import { answerWith, questionHeading, startCheck } from "./claim-check-helpers";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const BILL = "What is the total on the final hospital bill?";

test.describe("Claim Check consultation", () => {
	test("asks money, enum, boolean, number and date questions with their controls", async ({
		page,
	}) => {
		await startCheck(page);
		await expect(page.getByRole("textbox")).toBeVisible(); // money
		await expectNoAxeViolations(page);
		await answerWith(page, "250000");
		await expect(page.getByRole("radio", { name: "Illness" })).toBeVisible(); // enum
		await answerWith(page, "Illness");
		await expect(page.locator('main input[type="date"]')).toBeVisible(); // date
		await expectNoAxeViolations(page);
		await answerWith(page, "2021-04-01");
		await answerWith(page, "2024-06-10");
		await answerWith(page, "Other");
		await expect(page.getByRole("radio", { name: "Yes" })).toBeVisible(); // boolean
		await expectNoAxeViolations(page);
		await answerWith(page, "No");
		await answerWith(page, "2000");
		await answerWith(page, "6000");
		await answerWith(page, "Rs 500000");
		await expect(page.getByText("days", { exact: true })).toBeVisible(); // number
		await expectNoAxeViolations(page);
	});

	test("an empty or invalid answer gets a message and no step", async ({
		page,
	}) => {
		await startCheck(page);
		await page.getByRole("button", { name: "Continue" }).click();
		await expect(questionHeading(page)).toHaveText(BILL);
		await expect(page.getByText("Enter an amount.")).toBeVisible();
		await page.getByRole("textbox").fill("1.234");
		await page.getByRole("button", { name: "Continue" }).click();
		await expect(questionHeading(page)).toHaveText(BILL);
		await expect(page.getByText("Use at most 2 decimal places.")).toBeVisible();
	});

	test("Enter submits, and a number key picks an option", async ({ page }) => {
		await startCheck(page);
		await page.getByRole("textbox").fill("250000");
		await page.keyboard.press("Enter");
		await expect(questionHeading(page)).not.toHaveText(BILL);
		await page.getByRole("radio").first().focus();
		await page.keyboard.press("2");
		await expect(page.getByRole("radio", { name: "Accident" })).toBeChecked();
	});

	test("Why this question shows the clause and Escape closes it", async ({
		page,
	}) => {
		await startCheck(page);
		const why = page.getByRole("button", { name: "Why this question?" });
		await why.click();
		await expect(why).toHaveAttribute("aria-expanded", "true");
		await expect(
			page.locator("main blockquote, main figure").first(),
		).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(why).toHaveAttribute("aria-expanded", "false");
	});

	test("the progress line and Back with the answer filled in", async ({
		page,
	}) => {
		await startCheck(page);
		await expect(
			page.locator("main").getByText(/^Question 1\. Up to \d+ more\.$/),
		).toBeVisible();
		await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
		await answerWith(page, "250000");
		await expect(
			page.locator("main").getByText(/^Question 2\. Up to \d+ more\.$/),
		).toBeVisible();
		await page.getByRole("button", { name: "Back" }).click();
		await expect(questionHeading(page)).toHaveText(BILL);
		await expect(page.getByRole("textbox")).toHaveValue("2,50,000");
	});

	test("an answer the app refuses shows a message and stays on the question", async ({
		page,
	}) => {
		await startCheck(page);
		await answerWith(page, "1000");
		await answerWith(page, "Accident");
		await answerWith(page, "Other");
		await answerWith(page, "No");
		await answerWith(page, "5000");
		await expect(
			page.getByText(
				"With this answer, the charges would be more than the hospital bill.",
			),
		).toBeVisible();
		await expect(page.locator("main input").first()).toBeVisible();
	});
});
