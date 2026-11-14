import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const STATES = ["unit", "plain", "typing", "invalid", "disabled"];
const specimen = (page: Page, state: string) =>
	page.locator(`[data-specimen="answercontrol-number-${state}"]`);
const field = (page: Page, state: string) =>
	specimen(page, state).getByRole("textbox");

test("the number specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#answercontrol-number-unit");

	for (const state of STATES) {
		await expect(specimen(page, state), state).toHaveCount(1);
		await expectNoAxeViolations(
			page,
			`[data-specimen="answercontrol-number-${state}"]`,
		);
	}
});

test("a decimal keypad field, with the unit as visible text", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-number-unit");
	const input = field(page, "unit");

	await expect(input).toHaveAttribute("inputmode", "decimal");
	await expect(
		specimen(page, "unit").getByText("days", { exact: true }),
	).toBeVisible();
	await expect(input).toHaveAccessibleName(
		"How many days was the hospital stay? days",
	);
	await expect(field(page, "plain")).toHaveAccessibleName(
		"How old is the patient?",
	);
	const box = await input.boundingBox();
	expect(box?.height).toBeGreaterThanOrEqual(44);
});

test("typing emits a number, and digit keys are text", async ({ page }) => {
	await page.goto("./kit/#answercontrol-number-typing");
	const input = field(page, "typing");
	const emitted = specimen(page, "typing").locator("[data-emitted]");

	await input.fill("");
	await input.pressSequentially("4.5");
	await expect(input).toHaveValue("4.5");
	await expect(emitted).toHaveText("4.5");

	await input.press("Enter");
	await expect(specimen(page, "typing").locator("[data-enters]")).toHaveText(
		"1",
	);
	await expect(input).not.toHaveAttribute("aria-invalid", "true");
});

test("an empty or non-numeric field says Enter a number on Enter", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-number-typing");
	const input = field(page, "typing");

	await input.fill("");
	await input.press("Enter");
	await expect(input).toHaveAttribute("aria-invalid", "true");
	await expect(input).toHaveAccessibleDescription("Enter a number.");

	await input.pressSequentially("four");
	await expect(input).not.toHaveAttribute("aria-invalid", "true");
	await input.press("Enter");
	await expect(input).toHaveAccessibleDescription("Enter a number.");
	await expect(specimen(page, "typing").locator("[data-emitted]")).toHaveText(
		"nothing yet",
	);
});

test("the invalid specimen shows its message and disabled cannot change", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-number-invalid");

	await expect(field(page, "invalid")).toHaveAttribute("aria-invalid", "true");
	await expect(field(page, "invalid")).toHaveAccessibleDescription(
		"Enter a number.",
	);
	await expect(field(page, "disabled")).toBeDisabled();
	await expect(field(page, "disabled")).toHaveValue("4");
});
