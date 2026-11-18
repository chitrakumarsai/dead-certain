// Layout checks shared by the kit sweep and the Claim Check sweep.
import type { Page } from "@playwright/test";

const TOUCH = 44;
const INTERACTIVE =
	'a[href], button, input, select, textarea, [role="radio"], [role="checkbox"]';

/** Visible interactive elements smaller than 44 by 44 px, with what they are. */
export async function smallTargets(page: Page): Promise<string[]> {
	return page.locator(INTERACTIVE).evaluateAll((elements, touch) => {
		const out: string[] = [];
		for (const element of elements) {
			// A stretched button's hit area is its marked container (a Ledger row).
			const box = (
				element.closest("[data-hit-area]") ?? element
			).getBoundingClientRect();
			const style = getComputedStyle(element);
			// Off-screen until focused (the skip link) or not drawn at all.
			const isHidden =
				box.width <= 1 ||
				box.height <= 1 ||
				style.visibility === "hidden" ||
				style.clip === "rect(0px, 0px, 0px, 0px)" ||
				element.closest("[inert], [aria-hidden='true']") !== null;
			if (isHidden) continue;
			if (box.width < touch || box.height < touch) {
				const name = (
					element.getAttribute("aria-label") ??
					element.textContent ??
					""
				)
					.trim()
					.slice(0, 40);
				out.push(
					`${element.tagName.toLowerCase()} "${name}" ${Math.round(box.width)}x${Math.round(box.height)}`,
				);
			}
		}
		return out;
	}, TOUCH);
}

export async function horizontalOverflow(page: Page): Promise<number> {
	return page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
}
