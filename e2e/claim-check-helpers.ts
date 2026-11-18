import type { Page } from "@playwright/test";
import { CLAIM_CHECK_URL } from "../playwright.config";
import { expect } from "./kit-fixtures";

export { CLAIM_CHECK_URL };

/** Opens Claim Check at a fragment ("" for the start screen). */
export async function openClaimCheck(page: Page, hash = ""): Promise<void> {
	await page.goto(`${CLAIM_CHECK_URL}${hash}`);
}

/** Starts the check and waits for the first question. */
export async function startCheck(page: Page): Promise<void> {
	await openClaimCheck(page);
	await page.getByRole("button", { name: "Start the check" }).click();
	await expect(page.getByRole("heading", { level: 2 })).toBeFocused();
}

/** The question's heading, the card's h2. */
export const questionHeading = (page: Page) =>
	page.getByRole("heading", { level: 2 }).first();

/**
 * Answers the open question: a radio label ("Yes", "Accident") or text for a
 * money, number or date field, then Continue.
 */
export async function answerWith(page: Page, value: string): Promise<void> {
	const radio = page.getByRole("radio", { name: value, exact: true });
	if ((await page.getByRole("radio").count()) > 0) await radio.click();
	else await page.locator("main input").first().fill(value);
	await page.getByRole("button", { name: "Continue" }).click();
}
