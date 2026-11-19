// Keyboard-only helpers shared by the Claim Check and Pre-Flight keyboard runs.
import type { Locator, Page } from "@playwright/test";
import { expect } from "./kit-fixtures";

/** True when the focused element, or the frame it hands its ring to, draws an outline. */
export const ringShows = (page: Page) =>
	page.evaluate(() => {
		const active = document.activeElement as HTMLElement | null;
		// A tree row draws its ring on its [data-row]; a framed field on its frame.
		const row = active?.querySelector<HTMLElement>(":scope > [data-row]");
		const candidates = [row];
		for (let el = active, i = 0; el && i < 4; i++, el = el.parentElement)
			candidates.push(el);
		return candidates.some((el) => {
			if (!el) return false;
			const s = getComputedStyle(el);
			return s.outlineStyle !== "none" && s.outlineWidth !== "0px";
		});
	});

/** Presses Tab until `target` has focus, checking the ring at every stop. */
export async function tabTo(page: Page, target: Locator) {
	for (let i = 0; i < 60; i++) {
		await page.keyboard.press("Tab");
		const here = await page.evaluate(() => {
			const el = document.activeElement;
			return `${el?.tagName} "${(el?.getAttribute("aria-label") ?? el?.textContent ?? "").trim().slice(0, 40)}"`;
		});
		if (!here.startsWith("BODY"))
			expect(await ringShows(page), `focus ring on ${here}`).toBe(true);
		if (await target.evaluate((el) => el === document.activeElement)) return;
	}
	await expect(target).toBeFocused();
}
