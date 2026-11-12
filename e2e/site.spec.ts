import { expect, test } from "@playwright/test";

test("placeholder page shows the tagline", async ({ page }) => {
	await page.goto("./");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"LLMs guess. The dead are certain.",
	);
});
