import { expect, expectNoAxeViolations, test } from "./kit-fixtures";
import {
	openPreflight,
	recordedReplies,
	routeGitHub,
	summary,
} from "./preflight-helpers";

const field = (page: import("@playwright/test").Page) =>
	page.getByRole("textbox", { name: "Repository", exact: true });
const run = (page: import("@playwright/test").Page) =>
	page.getByRole("button", { name: "Run the checks" });

test("the start screen has its heading, lines, field, button and samples (2.1, 2.2, 2.7, 2.9)", async ({
	page,
}) => {
	await openPreflight(page);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"Check a repository before you submit it",
	);
	await expect(
		page.getByText(
			"Pre-Flight reads public repositories only. Nothing you enter leaves your browser except requests to GitHub.",
		),
	).toBeVisible();
	await expect(field(page)).toBeVisible();
	await expect(run(page)).toBeVisible();
	const samples = page
		.getByRole("region", { name: "Try a sample" })
		.getByRole("button");
	await expect(samples).toHaveText([
		"chitrakumarsai/dead-certain",
		"chitrakumarsai/dc-sample-not-ready",
		"chitrakumarsai/dc-sample-warnings",
	]);
	await expectNoAxeViolations(page);
});

test("every accepted form goes to the same report address (2.3, 2.8)", async ({
	page,
}) => {
	await routeGitHub(page, recordedReplies("dead-certain"));
	for (const form of [
		"chitrakumarsai/dead-certain",
		"github.com/chitrakumarsai/dead-certain",
		"https://github.com/chitrakumarsai/dead-certain/",
		"https://github.com/chitrakumarsai/dead-certain.git",
		"  https://github.com/chitrakumarsai/dead-certain/tree/main/src  ",
	]) {
		await openPreflight(page);
		await field(page).fill(form);
		await run(page).click();
		await expect(page, form).toHaveURL(
			/#\/report\?repo=chitrakumarsai%2Fdead-certain$/,
		);
	}
});

test("Enter in the field submits", async ({ page }) => {
	await routeGitHub(page, recordedReplies("dead-certain"));
	await openPreflight(page);
	await field(page).fill("chitrakumarsai/dead-certain");
	await field(page).press("Enter");
	await expect(page).toHaveURL(/#\/report\?repo=/);
});

test("empty and bad input show their messages and make no request (2.5, 2.6)", async ({
	page,
}) => {
	const requests = await routeGitHub(page, {});
	await openPreflight(page);
	await run(page).click();
	await expect(
		page.getByText("Enter a repository as owner/name or a GitHub URL."),
	).toBeVisible();
	await expect(field(page)).toHaveAttribute("aria-invalid", "true");
	await field(page).fill("https://gitlab.com/a/b");
	await run(page).click();
	await expect(
		page.getByText(
			"This is not a GitHub repository. Use owner/name or a github.com URL.",
		),
	).toBeVisible();
	await expect(page).not.toHaveURL(/report/);
	expect(requests).toEqual([]);
});

test("a sample button goes to the sample's report and makes no request (2.10)", async ({
	page,
}) => {
	const requests = await routeGitHub(page, {});
	await openPreflight(page);
	await page
		.getByRole("button", { name: "chitrakumarsai/dc-sample-warnings" })
		.click();
	await expect(page).toHaveURL(/#\/report\?sample=dc-sample-warnings$/);
	await expect(summary(page)).toContainText(
		"2 warnings in chitrakumarsai/dc-sample-warnings",
	);
	expect(requests).toEqual([]);
});

test("no uppercase text and no arrow in a button (2.11)", async ({ page }) => {
	await openPreflight(page);
	const found = await page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>("body *")]
			.filter(
				(el) =>
					getComputedStyle(el).textTransform === "uppercase" ||
					(el.tagName === "BUTTON" && /[←→↑↓»«›‹]/.test(el.textContent ?? "")),
			)
			.map((el) => el.tagName),
	);
	expect(found).toEqual([]);
});
