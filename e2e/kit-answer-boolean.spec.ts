import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const QUESTION = "Was it an emergency admission?";
const specimen = (page: Page, state: string) =>
	page.locator(`[data-specimen="answercontrol-boolean-${state}"]`);

test("the four boolean specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#answercontrol-boolean-empty");

	for (const state of ["empty", "filled", "invalid", "disabled"]) {
		await expect(specimen(page, state), state).toHaveCount(1);
		await expectNoAxeViolations(
			page,
			`[data-specimen="answercontrol-boolean-${state}"]`,
		);
	}
});

test("a radio group named by the question, with large Yes and No", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-boolean-empty");
	const group = specimen(page, "empty").getByRole("radiogroup", {
		name: QUESTION,
	});

	await expect(group).toBeVisible();
	const radios = group.getByRole("radio");
	await expect(radios).toHaveText(["Yes", "No"]);
	for (const radio of await radios.all()) {
		await expect(radio).toHaveAttribute("aria-checked", "false");
		const box = await radio.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
		expect(box?.width).toBeGreaterThanOrEqual(88);
	}
});

test("clicking emits true or false and marks the choice with more than colour", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-boolean-empty");
	const empty = specimen(page, "empty");
	const emitted = empty.locator("[data-emitted]");

	await empty.getByRole("radio", { name: "Yes" }).click();
	await expect(emitted).toHaveText("true");
	const yes = empty.getByRole("radio", { name: "Yes" });
	await expect(yes).toHaveAttribute("aria-checked", "true");
	await expect(yes.locator("svg")).toHaveCount(1);
	await expect(
		empty.getByRole("radio", { name: "No" }).locator("svg"),
	).toHaveCount(0);

	await empty.getByRole("radio", { name: "No" }).click();
	await expect(emitted).toHaveText("false");
});

// Radix selects on focus while an arrow key is held. Playwright's press()
// releases the key at once, before Radix moves focus, so hold it like a person.
async function holdArrow(page: Page, key: "ArrowRight" | "ArrowLeft") {
	await page.keyboard.down(key);
	await page.waitForTimeout(50);
	await page.keyboard.up(key);
}

test("arrow keys move between Yes and No", async ({ page }) => {
	await page.goto("./kit/#answercontrol-boolean-filled");
	const filled = specimen(page, "filled");
	const yes = filled.getByRole("radio", { name: "Yes" });

	await yes.focus();
	await holdArrow(page, "ArrowRight");
	await expect(filled.getByRole("radio", { name: "No" })).toBeFocused();
	await expect(filled.locator("[data-emitted]")).toHaveText("false");
	await holdArrow(page, "ArrowLeft");
	await expect(yes).toBeFocused();
	await expect(filled.locator("[data-emitted]")).toHaveText("true");
});

test("1 selects Yes and 2 selects No while focus is on the group", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-boolean-empty");
	const empty = specimen(page, "empty");
	const emitted = empty.locator("[data-emitted]");

	await page.keyboard.press("1");
	await expect(emitted).toHaveText("nothing yet");

	await empty.getByRole("radio", { name: "Yes" }).focus();
	await page.keyboard.press("2");
	await expect(emitted).toHaveText("false");
	await expect(empty.getByRole("radio", { name: "No" })).toBeFocused();
	await page.keyboard.press("1");
	await expect(emitted).toHaveText("true");
	await expect(empty.getByRole("radio", { name: "Yes" })).toBeFocused();
});

test("an error marks the group invalid and is read as its description", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-boolean-invalid");
	const group = specimen(page, "invalid").getByRole("radiogroup");

	await expect(group).toHaveAttribute("aria-invalid", "true");
	await expect(group).toHaveAccessibleDescription("Choose one answer.");
	const errorId = await group.getAttribute("aria-describedby");
	await expect(page.locator(`[id="${errorId}"]`)).toBeVisible();
	await expect(
		specimen(page, "empty").getByRole("radiogroup"),
	).not.toHaveAttribute("aria-invalid", "true");
});

test("a disabled group cannot be changed", async ({ page }) => {
	await page.goto("./kit/#answercontrol-boolean-disabled");
	const disabled = specimen(page, "disabled");
	const no = disabled.getByRole("radio", { name: "No" });

	await expect(no).toBeDisabled();
	await no.click({ force: true });
	await expect(disabled.locator("[data-emitted]")).toHaveText("true");
});
