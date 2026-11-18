import type { FactValue } from "@dead-certain/engine";
import type { Locator, Page } from "@playwright/test";
import { answerText, factAsked, REDUCED } from "./claim-check-engine";
import { openClaimCheck, questionHeading } from "./claim-check-helpers";
import { expect, test } from "./kit-fixtures";

/** True when the focused element, or the frame it hands its ring to, draws an outline. */
const ringShows = (page: Page) =>
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
async function tabTo(page: Page, target: Locator) {
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

/** Answers the open question with the keyboard alone. */
async function answerByKeyboard(page: Page, text: string) {
	const radios = page.locator("main").getByRole("radio");
	if ((await radios.count()) > 0) {
		await tabTo(
			page,
			radios.and(page.locator("[tabindex='0'], input:not([tabindex])")).first(),
		);
		const want = page.getByRole("radio", { name: text, exact: true });
		// While focus is in the group, 1 to 9 choose by position.
		const names = await radios.evaluateAll((all) =>
			all.map(
				(r) => r.getAttribute("aria-label") ?? r.textContent?.trim() ?? "",
			),
		);
		const at = await radios.evaluateAll(
			(all, w) => all.indexOf(w as HTMLElement),
			await want.elementHandle(),
		);
		expect(at, `${text} among ${names.join(", ")}`).toBeGreaterThanOrEqual(0);
		await page.keyboard.press(String(at + 1));
		await expect(want).toBeChecked();
	} else {
		await tabTo(page, page.locator("main input").first());
		await page.keyboard.press("ControlOrMeta+A");
		await page.keyboard.type(text);
	}
	await tabTo(page, page.getByRole("button", { name: "Continue" }));
	await page.keyboard.press("Enter");
}

test("start to verdict, into the X-ray and out, and a rail change, with no pointer", async ({
	page,
}) => {
	await openClaimCheck(page);
	await tabTo(page, page.getByRole("button", { name: "Start the check" }));
	await page.keyboard.press("Enter");

	const verdictShown = page.getByRole("table");
	for (let i = 0; i < 20 && (await verdictShown.count()) === 0; i++) {
		await expect(questionHeading(page)).toBeFocused();
		const fact = factAsked((await questionHeading(page).textContent()) ?? "");
		await answerByKeyboard(page, answerText(fact, REDUCED[fact] as FactValue));
		await expect(questionHeading(page).or(verdictShown).first()).toBeVisible();
	}
	await expect(verdictShown).toBeVisible();

	const seeWhy = page.getByRole("button", { name: "See why", exact: true });
	await tabTo(page, seeWhy);
	await page.keyboard.press("Enter");
	const tree = page.getByRole("tree", { name: "Proof" });
	await expect(tree).toBeVisible();
	await tabTo(page, tree.getByRole("treeitem").first());
	await page.keyboard.press("ArrowDown");
	await expect(tree.getByRole("treeitem").first()).not.toBeFocused();
	await page.keyboard.press("Escape");
	await expect(tree).toHaveCount(0);
	await expect(seeWhy).toBeFocused();

	// The rail: change the age, so the co-payment goes.
	const change = page.getByRole("button", { name: /^Change Age at admission/ });
	const disclosure = page.getByRole("button", { name: /^Your answers/ });
	if ((await change.count()) === 0 || !(await change.isVisible())) {
		await tabTo(page, disclosure);
		await page.keyboard.press("Enter");
	}
	await tabTo(page, change);
	await page.keyboard.press("Enter");
	await expect(questionHeading(page)).toBeFocused();
	await answerByKeyboard(page, "40");
	await expect(verdictShown).toBeVisible();
	await expect(verdictShown.getByText("Co-payment")).toHaveCount(0);
});
