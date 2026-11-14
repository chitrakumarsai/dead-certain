import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const HEADLINES = [
	["paid", "Paid in full", "₹2,10,000 of ₹2,10,000 will be paid"],
	["reduced", "Paid in part", "₹1,42,500 of ₹2,10,000 will be paid"],
	["denied", "Not paid", "₹0 of ₹2,10,000 will be paid"],
	["ready", "Ready", "Every check passes in owner/name"],
	["not_ready", "Not ready", "2 blockers and 1 warning in owner/name"],
	["undecided", "More answers needed", "2 more answers are needed to decide"],
] as const;
const SIZES = ["verdict", "summary"] as const;

const id = (state: string, size: string) =>
	`verdictheadline-${state.replace("_", "-")}-${size}`;
const specimen = (page: Page, specimenId: string) =>
	page.locator(`[data-specimen="${specimenId}"]`);
const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768;

test("the headline specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#verdictheadline-paid-verdict");

	for (const [state] of HEADLINES) {
		for (const size of SIZES) {
			await expect(
				specimen(page, id(state, size)),
				id(state, size),
			).toHaveCount(1);
			await expectNoAxeViolations(page, `[data-specimen="${id(state, size)}"]`);
		}
	}
});

test("one heading reads the word, a full stop, then the statement", async ({
	page,
}) => {
	await page.goto("./kit/#verdictheadline-paid-verdict");

	for (const [state, word, statement] of HEADLINES) {
		for (const size of SIZES) {
			const heading = specimen(page, id(state, size)).getByRole("heading", {
				level: 2,
			});
			await expect(heading, id(state, size)).toHaveCount(1);
			await expect(heading).toHaveAccessibleName(`${word}. ${statement}`);
			await expect(heading).toHaveText(`${word}. ${statement}`);
		}
	}
});

test("every state shows its word beside an icon hidden from assistive technology", async ({
	page,
}) => {
	await page.goto("./kit/#verdictheadline-paid-verdict");

	for (const [state, word] of HEADLINES) {
		const heading = specimen(page, id(state, "verdict")).getByRole("heading", {
			level: 2,
		});
		const icon = heading.locator("svg");
		await expect(icon, state).toHaveCount(1);
		await expect(icon).toHaveAttribute("aria-hidden", "true");
		await expect(heading.locator("[data-state-word]")).toHaveText(word);
		await expect(heading).toHaveAttribute("data-state", state);
	}
});

test("verdict is 48/56 from 768 px and 36/44 below; summary is always 36/44", async ({
	page,
}) => {
	await page.goto("./kit/#verdictheadline-reduced-verdict");
	const statement = (size: string) =>
		specimen(page, id("reduced", size)).locator("[data-statement]");

	await expect(statement("verdict")).toHaveCSS(
		"font-size",
		isWide(page) ? "48px" : "36px",
	);
	await expect(statement("verdict")).toHaveCSS(
		"line-height",
		isWide(page) ? "56px" : "44px",
	);
	await expect(statement("summary")).toHaveCSS("font-size", "36px");
	await expect(statement("summary")).toHaveCSS("line-height", "44px");
	await expect(statement("verdict")).toHaveCSS(
		"font-variant-numeric",
		"lining-nums tabular-nums",
	);
});

test("a headline that appears takes focus and is announced", async ({
	page,
}) => {
	await page.goto("./kit/#verdictheadline-appears");
	const appears = specimen(page, "verdictheadline-appears");

	await appears.getByRole("button", { name: "Show the verdict" }).click();

	const heading = appears.getByRole("heading", { name: /^Paid in part\. / });
	await expect(heading).toBeFocused();
	await expect(heading).toHaveAttribute("tabindex", "-1");
	await expect(page.getByRole("status")).toHaveText(
		"Paid in part. ₹1,42,500 of ₹2,10,000 will be paid",
	);
});
