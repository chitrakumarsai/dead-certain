import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const specimen = (page: Page, state: string) =>
	page.locator(`[data-specimen="answercontrol-date-${state}"]`);
const field = (page: Page, state: string) =>
	specimen(page, state).locator('input[type="date"]');

test("the date specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#answercontrol-date-empty");

	for (const state of ["empty", "filled", "invalid", "disabled"]) {
		await expect(specimen(page, state), state).toHaveCount(1);
		await expectNoAxeViolations(
			page,
			`[data-specimen="answercontrol-date-${state}"]`,
		);
	}
});

test("a native date field, named by the question", async ({ page }) => {
	await page.goto("./kit/#answercontrol-date-empty");
	const input = field(page, "empty");

	await expect(input).toHaveCount(1);
	await expect(input).toHaveAccessibleName("When was the patient admitted?");
	const box = await input.boundingBox();
	expect(box?.height).toBeGreaterThanOrEqual(44);
});

test("picking a date emits the ISO string, shown in words with formatDate", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-date-empty");
	const empty = specimen(page, "empty");

	await field(page, "empty").fill("2026-11-13");

	await expect(empty.locator("[data-emitted]")).toHaveText("2026-11-13");
	await expect(empty.locator("[data-reads-as]")).toHaveText("13 Nov 2026");
});

test("Enter calls onEnter, and an empty field says Pick a date", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-date-empty");
	const input = field(page, "empty");

	await input.focus();
	await input.press("Enter");

	await expect(specimen(page, "empty").locator("[data-enters]")).toHaveText(
		"1",
	);
	await expect(input).toHaveAttribute("aria-invalid", "true");
	await expect(input).toHaveAccessibleDescription("Pick a date.");
	const errorId = await input.getAttribute("aria-describedby");
	await expect(page.locator(`[id="${errorId}"]`)).toHaveText("Pick a date.");

	await input.fill("2026-01-31");
	await expect(input).not.toHaveAttribute("aria-invalid", "true");
	await input.press("Enter");
	await expect(input).not.toHaveAttribute("aria-invalid", "true");
});

test("filled, invalid and disabled", async ({ page }) => {
	await page.goto("./kit/#answercontrol-date-filled");

	await expect(field(page, "filled")).toHaveValue("2026-11-10");
	await expect(specimen(page, "filled").locator("[data-reads-as]")).toHaveText(
		"10 Nov 2026",
	);
	await expect(field(page, "invalid")).toHaveAccessibleDescription(
		"Pick a date.",
	);
	await expect(field(page, "disabled")).toBeDisabled();
});
