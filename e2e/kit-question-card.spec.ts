import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const STATES = [
	"boolean",
	"enum",
	"money",
	"number",
	"date",
	"why-only",
	"clause-only",
	"no-why",
	"invalid",
	"first",
	"last",
	"flow",
];
const specimen = (page: Page, state: string) =>
	page.locator(`[data-specimen="questioncard-${state}"]`);

test("the question card specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#questioncard-money");

	for (const state of STATES) {
		await expect(specimen(page, state), state).toHaveCount(1);
		await expectNoAxeViolations(
			page,
			`[data-specimen="questioncard-${state}"]`,
		);
	}
});

test("the progress line sits below the heading and describes it", async ({
	page,
}) => {
	await page.goto("./kit/#questioncard-money");
	const card = specimen(page, "money");
	const heading = card.getByRole("heading", {
		level: 2,
		name: "What was the room rent per day?",
	});
	const progress = card.getByText("Question 3. Up to 6 more.");

	await expect(heading).toHaveAttribute("tabindex", "-1");
	await expect(heading).toHaveAccessibleDescription(
		"Question 3. Up to 6 more.",
	);
	// DOM order: the progress line follows the heading.
	const follows = await heading.evaluate(
		(h, line) =>
			Boolean(
				line &&
					h.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
			),
		await progress.elementHandle(),
	);
	expect(follows).toBe(true);
	// Layout order: the progress line is drawn below the heading.
	const headingBox = await heading.boundingBox();
	const progressBox = await progress.boundingBox();
	expect(progressBox?.y ?? 0).toBeGreaterThanOrEqual(
		(headingBox?.y ?? 0) + (headingBox?.height ?? 0),
	);
	await expect(
		specimen(page, "last").getByText("Last question."),
	).toBeVisible();
});

test("the heading is 24/32 from 768 px and 21/28 below", async ({ page }) => {
	await page.goto("./kit/#questioncard-money");
	const heading = specimen(page, "money").getByRole("heading", { level: 2 });
	const width = page.viewportSize()?.width ?? 0;
	const [size, leading] = width >= 768 ? ["24px", "32px"] : ["21px", "28px"];

	await expect(heading).toHaveCSS("font-size", size);
	await expect(heading).toHaveCSS("line-height", leading);
});

test("the heading takes focus on mount and when the question changes", async ({
	page,
}) => {
	await page.goto("./kit/#questioncard-flow");
	const flow = specimen(page, "flow");

	await flow.getByRole("button", { name: "Start the questions" }).click();
	await expect(
		flow.getByRole("heading", { name: "Was it an emergency admission?" }),
	).toBeFocused();
	await expect(page.getByRole("status")).toHaveText(
		"Question 1. Up to 4 more.",
	);

	await flow.getByRole("radio", { name: "Yes" }).click();
	await flow.getByRole("button", { name: "Continue" }).click();
	await expect(
		flow.getByRole("heading", { name: "Which room did the patient stay in?" }),
	).toBeFocused();
	await expect(page.getByRole("status")).toHaveText(
		"Question 2. Up to 3 more.",
	);

	await flow.getByRole("button", { name: "Back" }).click();
	await expect(
		flow.getByRole("heading", { name: "Was it an emergency admission?" }),
	).toBeFocused();
	await expect(flow.getByRole("radio", { name: "Yes" })).toBeChecked();
});

test("Continue is enabled when empty, and an empty answer moves focus to the field", async ({
	page,
}) => {
	await page.goto("./kit/#questioncard-money");
	const card = specimen(page, "money");
	const continueButton = card.getByRole("button", { name: "Continue" });
	const input = card.getByRole("textbox");

	await expect(continueButton).toBeEnabled();
	await expect(continueButton).not.toHaveAttribute("aria-disabled", "true");
	await continueButton.click();
	await expect(input).toHaveAttribute("aria-invalid", "true");
	await expect(input).toHaveAccessibleDescription("Enter an amount.");
	await expect(input).toBeFocused();
	await expect(card.locator("[data-submits]")).toHaveText("0");

	// Editing clears the error.
	await input.pressSequentially("6");
	await expect(input).not.toHaveAttribute("aria-invalid", "true");
});

test("Enter in the field submits a valid answer once", async ({ page }) => {
	await page.goto("./kit/#questioncard-money");
	const card = specimen(page, "money");
	const input = card.getByRole("textbox");

	await input.fill("6000");
	await input.press("Enter");
	await expect(card.locator("[data-submits]")).toHaveText("1");
	await expect(card.locator("[data-submitted]")).toHaveText(
		"room_rent_per_day = 600000",
	);
});

test("Enter in the field shows why typed text is not accepted", async ({
	page,
}) => {
	await page.goto("./kit/#questioncard-number");
	const card = specimen(page, "number");
	const input = card.getByRole("textbox");

	await input.fill("four");
	await input.press("Enter");
	await expect(input).toHaveAccessibleDescription("Enter a number.");
	await expect(card.locator("[data-submits]")).toHaveText("0");
});

test("Enter on the heading validates a choice", async ({ page }) => {
	await page.goto("./kit/#questioncard-boolean");
	const card = specimen(page, "boolean");
	const heading = card.getByRole("heading", { level: 2 });

	await heading.focus();
	await heading.press("Enter");
	await expect(card.getByRole("radiogroup")).toHaveAccessibleDescription(
		"Choose one answer.",
	);
	await expect(card.getByRole("radio", { name: "Yes" })).toBeFocused();

	await card.getByRole("radio", { name: "No" }).click();
	await heading.focus();
	await heading.press("Enter");
	await expect(card.locator("[data-submitted]")).toHaveText(
		"is_emergency = false",
	);
	await expect(card.locator("[data-submits]")).toHaveText("1");
});

test("an external error shows as the field error until the field is edited", async ({
	page,
}) => {
	await page.goto("./kit/#questioncard-invalid");
	const card = specimen(page, "invalid");
	const input = card.getByRole("textbox");

	await expect(input).toHaveAttribute("aria-invalid", "true");
	await expect(input).toHaveAccessibleDescription(
		"Enter an amount above zero.",
	);
	await input.pressSequentially("5");
	await expect(input).not.toHaveAttribute("aria-invalid", "true");
	await expect(card.getByText("Enter an amount above zero.")).toHaveCount(0);
});

test("the why disclosure holds only the parts that exist, and Escape closes it", async ({
	page,
}) => {
	await page.goto("./kit/#questioncard-money");
	const why = "Why this question?";

	const money = specimen(page, "money");
	await money.getByRole("button", { name: why }).click();
	await expect(money.getByText(/The policy caps room rent/)).toBeVisible();
	await expect(money.getByText("Clause 4.2")).toBeVisible();
	await money.getByRole("textbox").focus();
	await page.keyboard.press("Escape");
	await expect(money.getByRole("button", { name: why })).toHaveAttribute(
		"aria-expanded",
		"false",
	);

	const whyOnly = specimen(page, "why-only");
	await whyOnly.getByRole("button", { name: why }).click();
	await expect(
		whyOnly.getByText(/emergency admission is covered/),
	).toBeVisible();
	await expect(whyOnly.locator("blockquote")).toHaveCount(0);

	const clauseOnly = specimen(page, "clause-only");
	await clauseOnly.getByRole("button", { name: why }).click();
	await expect(clauseOnly.locator("blockquote")).toHaveCount(1);
	await expect(clauseOnly.locator("[data-why]")).toHaveCount(0);

	await expect(
		specimen(page, "no-why").getByRole("button", { name: why }),
	).toHaveCount(0);
});

test("Back appears only when the app can go back", async ({ page }) => {
	await page.goto("./kit/#questioncard-first");

	await expect(
		specimen(page, "first").getByRole("button", { name: "Back" }),
	).toHaveCount(0);
	await expect(
		specimen(page, "money").getByRole("button", { name: "Back" }),
	).toHaveCount(1);
});
