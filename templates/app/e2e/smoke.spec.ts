import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

// The new app's smoke test (requirement 6.6). It answers whatever the rules ask,
// so it still passes after the starter rules are replaced.
const URL = "http://localhost:__APP_PORT__/dead-certain/__APP_NAME__/";
const MAX_QUESTIONS = 40;

/** Answers the open question with its first option, or 1, or a fixed date. */
async function answerAny(page: Page): Promise<void> {
	const radios = page.locator("main").getByRole("radio");
	if ((await radios.count()) > 0) await radios.first().check();
	else {
		const input = page.locator("main input").first();
		const type = await input.getAttribute("type");
		await input.fill(type === "date" ? "2024-01-01" : "1");
	}
	await page.getByRole("button", { name: "Continue" }).click();
}

test("__APP_NAME__: start, every question, the verdict and its proof", async ({
	page,
}) => {
	await page.goto(URL);
	await page.getByRole("button", { name: "Start", exact: true }).click();
	const seeWhy = page.getByRole("button", { name: "See why", exact: true });
	for (let asked = 0; !(await seeWhy.isVisible()); asked++) {
		expect(asked, "the rules reach a verdict").toBeLessThan(MAX_QUESTIONS);
		await answerAny(page);
	}
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await expectNoAxeViolations(page);

	await seeWhy.click();
	await expect(page.locator("[data-clause-heading]").first()).toBeVisible();
	await expectNoAxeViolations(page);
});
