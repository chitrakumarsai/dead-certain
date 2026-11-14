import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const ROWS = [
	["pass", "Passed", "pass", "Public repository", "R-01"],
	["fail", "Failed", "fail", "License file GitHub can detect", "R-02"],
	[
		"unknown",
		"Needs your answer",
		"unknown",
		"Demo video under 3 minutes",
		"R-09",
	],
	["evidence", "Failed", "fail", ".kiro is not ignored", "R-05"],
	["non-boolean", "Needs your answer", "unknown", "Public repository", "R-01"],
] as const;

const specimen = (page: Page, id: string) =>
	page.locator(`[data-specimen="checkrow-${id}"]`);

test("the check row specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#checkrow-pass");

	for (const [id] of ROWS) {
		await expect(specimen(page, id).locator("[data-check]"), id).toHaveCount(1);
		await expectNoAxeViolations(page, `[data-specimen="checkrow-${id}"]`);
	}
});

test("each state shows its word beside a hidden icon, and names its rule button with it", async ({
	page,
}) => {
	await page.goto("./kit/#checkrow-pass");

	for (const [id, word, state, label, rule] of ROWS) {
		const row = specimen(page, id).locator("[data-check]");
		await expect(row, id).toHaveAttribute("data-check", state);
		await expect(row.locator("[data-check-word]")).toHaveText(word);
		const icon = row.locator("[data-check-icon] svg");
		await expect(icon).toHaveCount(1);
		await expect(icon).toHaveAttribute("aria-hidden", "true");
		await expect(
			row.getByRole("button", {
				name: `${word}: ${label}, rule ${rule}. See why`,
			}),
		).toBeVisible();
	}
});

test("the rule id opens the proof by keyboard", async ({ page }) => {
	await page.goto("./kit/#checkrow-fail");
	const fail = specimen(page, "fail");
	const rule = fail.getByRole("button", { name: /rule R-02/ });

	await expect(rule).toHaveText("R-02");
	await expect(rule).toHaveCSS("font-family", /IBM Plex Mono/);
	await rule.focus();
	await page.keyboard.press("Enter");
	await expect(fail.locator("[data-opened]")).toHaveText(
		"has_detectable_license from BUTTON",
	);
});

test("the evidence line is in the Machine voice", async ({ page }) => {
	await page.goto("./kit/#checkrow-evidence");
	const detail = specimen(page, "evidence").locator("[data-detail]");

	await expect(detail).toHaveText(".gitignore line 12: .kiro/");
	await expect(detail).toHaveCSS("font-family", /IBM Plex Mono/);
});

test("the inline question shows only while unknown, and answering emits once", async ({
	page,
}) => {
	await page.goto("./kit/#checkrow-unknown");
	const unknown = specimen(page, "unknown");

	await expect(
		unknown.getByText("Is the demo video under 3 minutes?"),
	).toBeVisible();
	await unknown.getByRole("radio", { name: "Yes" }).click();
	await expect(unknown.locator("[data-answered]")).toHaveText(
		"demo_video_short = true (1)",
	);
	await unknown.getByRole("radio", { name: "Yes" }).click();
	await expect(unknown.locator("[data-answered]")).toHaveText(
		"demo_video_short = true (1)",
	);
	await expect(specimen(page, "fail").getByRole("radio")).toHaveCount(0);
	await expect(specimen(page, "non-boolean").getByRole("radio")).toHaveCount(0);
});

test("a question for a non-boolean fact is not asked inline", async ({
	page,
}) => {
	await page.goto("./kit/#checkrow-unknown-not-boolean");
	const row = specimen(page, "unknown-not-boolean").locator("[data-check]");

	await expect(row.locator("[data-check-word]")).toHaveText(
		"Needs your answer",
	);
	await expect(row.getByRole("radio")).toHaveCount(0);
	await expect(row.getByRole("textbox")).toHaveCount(0);
	await expect(row).not.toContainText("Is the demo video under 3 minutes?");
	await expectNoAxeViolations(
		page,
		'[data-specimen="checkrow-unknown-not-boolean"]',
	);
});

test("the rule button's hit area stays clear of the label and the word", async ({
	page,
}) => {
	await page.goto("./kit/#checkrow-pass");

	for (const [id] of ROWS) {
		const row = specimen(page, id).locator("[data-check]");
		const button = await row
			.getByRole("button", { name: /See why$/ })
			.boundingBox();
		for (const part of ["p", "[data-check-word]"]) {
			const box = await row.locator(part).first().boundingBox();
			const overlaps =
				button &&
				box &&
				button.x < box.x + box.width &&
				box.x < button.x + button.width;
			expect(overlaps, `${id} ${part}`).toBeFalsy();
		}
	}
});
