import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const STATES = [
	"empty",
	"typing",
	"filled",
	"zero",
	"invalid-empty",
	"invalid-format",
	"invalid-decimals",
	"below-min-one",
	"below-min-amount",
	"disabled",
];
const specimen = (page: Page, state: string) =>
	page.locator(`[data-specimen="answercontrol-money-${state}"]`);
const field = (page: Page, state: string) =>
	specimen(page, state).getByRole("textbox");

test("the money specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#answercontrol-money-empty");

	for (const state of STATES) {
		await expect(specimen(page, state), state).toHaveCount(1);
		await expectNoAxeViolations(
			page,
			`[data-specimen="answercontrol-money-${state}"]`,
		);
	}
});

test("a text field with a visible rupee sign that is part of its name", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-money-empty");
	const input = field(page, "empty");

	await expect(input).toHaveAccessibleName(
		"What was the room rent per day? Indian rupees",
	);
	await expect(input).toHaveAttribute("inputmode", "decimal");
	await expect(
		specimen(page, "empty").getByText("₹", { exact: true }),
	).toBeVisible();
	const box = await input.boundingBox();
	expect(box?.height).toBeGreaterThanOrEqual(44);
});

test("typing groups the digits and emits integer paise", async ({ page }) => {
	await page.goto("./kit/#answercontrol-money-empty");
	const input = field(page, "empty");

	await input.pressSequentially("142500");

	await expect(input).toHaveValue("1,42,500");
	await expect(specimen(page, "empty").locator("[data-emitted]")).toHaveText(
		"14250000",
	);
});

test("editing in the middle keeps the caret after the typed digit", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-money-filled");
	const input = field(page, "filled");
	await expect(input).toHaveValue("1,42,500");

	await input.focus();
	await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(3, 3));
	await page.keyboard.type("9");

	await expect(input).toHaveValue("14,92,500");
	expect(
		await input.evaluate((el: HTMLInputElement) => el.selectionStart),
	).toBe(4);
	await expect(specimen(page, "filled").locator("[data-emitted]")).toHaveText(
		"149250000",
	);
});

test("zero is a valid amount when there is no minimum", async ({ page }) => {
	await page.goto("./kit/#answercontrol-money-zero");
	const input = field(page, "zero");

	await expect(input).toHaveValue("0");
	await expect(specimen(page, "zero").locator("[data-emitted]")).toHaveText(
		"0",
	);
	await input.press("Enter");
	await expect(specimen(page, "zero").locator("[data-enters]")).toHaveText("1");
	await expect(input).not.toHaveAttribute("aria-invalid", "true");
});

test("digit keys type text, and Enter reports each problem in words", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-money-typing");
	const input = field(page, "typing");
	const say = (text: string) => expect(input).toHaveAccessibleDescription(text);

	await input.fill("");
	await input.press("Enter");
	await say("Enter an amount.");
	await expect(input).toHaveAttribute("aria-invalid", "true");

	await input.pressSequentially("1");
	await expect(input).toHaveValue("1");
	await expect(input).not.toHaveAttribute("aria-invalid", "true");

	await input.fill(".");
	await input.press("Enter");
	await say("Use digits only, with an optional decimal point.");

	await input.fill("");
	await input.pressSequentially("1.234");
	await input.press("Enter");
	await say("Use at most 2 decimal places.");
});

test("below the minimum, the message names the minimum", async ({ page }) => {
	await page.goto("./kit/#answercontrol-money-below-min-one");

	const one = field(page, "below-min-one");
	await one.pressSequentially("0");
	await one.press("Enter");
	await expect(one).toHaveAccessibleDescription("Enter an amount above zero.");

	const amount = field(page, "below-min-amount");
	await amount.pressSequentially("499");
	await amount.press("Enter");
	await expect(amount).toHaveAccessibleDescription(
		"Enter an amount of at least ₹500.",
	);
});

test("the invalid specimens show each message under the field", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-money-invalid-empty");

	for (const [state, message] of [
		["invalid-empty", "Enter an amount."],
		["invalid-format", "Use digits only, with an optional decimal point."],
		["invalid-decimals", "Use at most 2 decimal places."],
	]) {
		await expect(field(page, state as string)).toHaveAccessibleDescription(
			message as string,
		);
	}
});

test("a disabled money field cannot be edited", async ({ page }) => {
	await page.goto("./kit/#answercontrol-money-disabled");

	await expect(field(page, "disabled")).toBeDisabled();
	await expect(field(page, "disabled")).toHaveValue("6,000");
});

test("a focused field shows one ring, on its frame", async ({ page }) => {
	await page.goto("./kit/#answercontrol-money-empty");
	const input = field(page, "empty");

	await input.focus();
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Tab");

	await expect(input).toBeFocused();
	await expect(input).toHaveCSS("outline-style", "none");
	const frame = input.locator("..");
	await expect(frame).toHaveCSS("outline-style", "solid");
	await expect(frame).toHaveCSS("outline-width", "2px");
	await expect(frame).toHaveCSS("outline-color", "rgb(31, 111, 235)");
});
