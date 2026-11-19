import type { FactValue } from "@dead-certain/engine";
import type { Page } from "@playwright/test";
import { answerText, factAsked, REDUCED } from "./claim-check-engine";
import { openClaimCheck, questionHeading } from "./claim-check-helpers";
import { tabTo } from "./keyboard";
import { expect, test } from "./kit-fixtures";

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
