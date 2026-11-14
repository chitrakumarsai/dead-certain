import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const NOTICES = [
	["kb-mismatch", "This link was made with older rules", true],
	["kb-mismatch-no-link", "This link was made with older rules", false],
	["malformed", "This link is incomplete or damaged", false],
	["unsupported", "This link comes from a different version", false],
] as const;
const specimen = (page: Page, id: string) =>
	page.locator(`[data-specimen="stalelink-${id}"]`);

test("every failure has its own heading, body and way forward", async ({
	page,
}) => {
	await page.goto("./kit/#stalelink-kb-mismatch");

	for (const [id, heading, hasLink] of NOTICES) {
		const notice = specimen(page, id);
		await expect(notice.getByRole("heading", { level: 2 }), id).toHaveText(
			heading,
		);
		await expect(
			notice.getByRole("button", { name: "Start the check" }),
		).toBeVisible();
		await expect(
			notice.getByRole("link", { name: "Read the rules" }),
		).toHaveCount(hasLink ? 1 : 0);
		await expectNoAxeViolations(page, `[data-specimen="stalelink-${id}"]`);
	}
	await expect(specimen(page, "kb-mismatch")).toContainText(
		"Start the check again to get a verdict under the current rules.",
	);
	await expect(specimen(page, "malformed")).toContainText(
		"Check that the whole link was copied, then open it again.",
	);
	await expect(specimen(page, "unsupported")).toContainText(
		"This version of the app cannot read it.",
	);
});

test("a neutral state inside main: no alert, no dialog, no denial colour", async ({
	page,
}) => {
	await page.goto("./kit/#stalelink-kb-mismatch");

	for (const [id] of NOTICES) {
		const notice = specimen(page, id);
		await expect(
			notice.locator('[role="alert"], [role="dialog"]'),
			id,
		).toHaveCount(0);
		await expect(
			page.locator(`main [data-specimen="stalelink-${id}"]`),
		).toHaveCount(1);
		// --text-soft on paper (ink-soft), not --denied.
		await expect(notice.locator("[data-notice-icon]")).toHaveCSS(
			"color",
			"rgb(74, 90, 100)",
		);
	}
});

test("Start the check calls onStart; the heading takes focus and is announced", async ({
	page,
}) => {
	await page.goto("./kit/#stalelink-appears");
	const appears = specimen(page, "appears");

	await appears.getByRole("button", { name: "Show the notice" }).click();
	const heading = appears.getByRole("heading", {
		name: "This link is incomplete or damaged",
	});
	await expect(heading).toBeFocused();
	await expect(page.getByRole("status")).toHaveText(
		"This link is incomplete or damaged",
	);
	await appears.getByRole("button", { name: "Start the check" }).click();
	await expect(appears.locator("[data-started]")).toHaveText("1");
});
