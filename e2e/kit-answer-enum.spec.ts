import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const STATES = ["2", "6", "10", "filled", "invalid", "disabled"];
const specimen = (page: Page, state: string) =>
	page.locator(`[data-specimen="answercontrol-enum-${state}"]`);

// Radix selects on focus while an arrow key is held; hold it like a person.
async function hold(page: Page, key: string) {
	await page.keyboard.down(key);
	await page.waitForTimeout(50);
	await page.keyboard.up(key);
}

test("the six enum specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#answercontrol-enum-2");

	for (const state of STATES) {
		await expect(specimen(page, state), state).toHaveCount(1);
		await expectNoAxeViolations(
			page,
			`[data-specimen="answercontrol-enum-${state}"]`,
		);
	}
});

test("one card per option, labelled in words, named by the question", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-enum-6");
	const group = specimen(page, "6").getByRole("radiogroup", {
		name: "Which room did the patient stay in?",
	});

	const names = [
		"General ward",
		"Twin sharing",
		"Semi private",
		"Private",
		"Single with attendant",
		"Deluxe",
	];
	const radios = group.getByRole("radio");
	await expect(radios).toHaveCount(names.length);
	for (const [i, name] of names.entries()) {
		await expect(radios.nth(i)).toHaveAccessibleName(name);
	}
	for (const card of await group.getByRole("radio").all()) {
		const box = await card.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
	}
	await expect(specimen(page, "2").getByRole("radio")).toHaveCount(2);
	await expect(specimen(page, "10").getByRole("radio")).toHaveCount(10);
});

test("choosing a card emits the option string", async ({ page }) => {
	await page.goto("./kit/#answercontrol-enum-6");
	const six = specimen(page, "6");

	await six.getByRole("radio", { name: "Semi private" }).click();

	await expect(six.locator("[data-emitted]")).toHaveText("semi_private");
	await expect(
		six.getByRole("radio", { name: "Semi private" }),
	).toHaveAttribute("aria-checked", "true");
});

test("digits 1 to 9 pick by position while focus is on the group", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-enum-6");
	const six = specimen(page, "6");
	const emitted = six.locator("[data-emitted]");

	await page.keyboard.press("3");
	await expect(emitted).toHaveText("nothing yet");

	await six.getByRole("radio").first().focus();
	await page.keyboard.press("3");
	await expect(emitted).toHaveText("semi_private");
	await expect(six.getByRole("radio", { name: "Semi private" })).toBeFocused();
	await page.keyboard.press("7");
	await expect(emitted).toHaveText("semi_private");
});

test("with ten options, 9 picks the ninth, 0 does nothing, and arrows reach the tenth", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-enum-10");
	const ten = specimen(page, "10");
	const emitted = ten.locator("[data-emitted]");

	await ten.getByRole("radio").first().focus();
	await page.keyboard.press("9");
	await expect(emitted).toHaveText("ophthalmology");
	await page.keyboard.press("0");
	await expect(emitted).toHaveText("ophthalmology");

	await hold(page, "ArrowDown");
	await expect(ten.getByRole("radio").nth(9)).toBeFocused();
	await expect(emitted).toHaveText("ear_nose_and_throat");
	await ten.getByRole("radio", { name: "Cardiology" }).click();
	await expect(emitted).toHaveText("cardiology");
});

test("the first nine cards show their shortcut digit, hidden from screen readers", async ({
	page,
}) => {
	await page.goto("./kit/#answercontrol-enum-10");
	const hints = specimen(page, "10").locator("[data-shortcut]");

	await expect(hints).toHaveCount(9);
	await expect(hints.first()).toHaveText("1");
	await expect(hints.first()).toHaveAttribute("aria-hidden", "true");
});

test("invalid and disabled", async ({ page }) => {
	await page.goto("./kit/#answercontrol-enum-invalid");
	const group = specimen(page, "invalid").getByRole("radiogroup");

	await expect(group).toHaveAttribute("aria-invalid", "true");
	await expect(group).toHaveAccessibleDescription("Choose one answer.");

	const disabled = specimen(page, "disabled");
	const other = disabled.getByRole("radio", { name: "Reimbursement" });
	await expect(other).toBeDisabled();
	await other.click({ force: true });
	await expect(disabled.locator("[data-emitted]")).toHaveText("cashless");
});
