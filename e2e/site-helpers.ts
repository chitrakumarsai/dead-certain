import type { Page } from "@playwright/test";

/** The landing page's statement for golden scenario G-01. */
export const STATEMENT = "₹1,32,000 of ₹2,10,000 will be paid";

export const seeWhy = (page: Page) =>
	page.getByRole("button", { name: "See why", exact: true });

export const proofTree = (page: Page) =>
	page.getByRole("tree", { name: "Proof" });

/** Opens the landing page and waits for the fonts. */
export async function openLanding(page: Page): Promise<void> {
	await page.goto("./");
	await page.evaluate(() => document.fonts.ready);
}

/**
 * Escape from inside the proof tree, as the kit handles it at every width
 * (at 1280 px the side film's heading does not take Escape).
 */
export async function escapeFromTree(page: Page): Promise<void> {
	await proofTree(page).getByRole("treeitem").first().focus();
	await page.keyboard.press("Escape");
}
