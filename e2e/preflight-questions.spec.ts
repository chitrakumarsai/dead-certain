import type { Page } from "@playwright/test";
import { expect, test } from "./kit-fixtures";
import {
	openPreflight,
	type Reply,
	recordedReplies,
	routeGitHub,
	summary,
} from "./preflight-helpers";

/** This repository as recorded, with R-07 and R-08 passing and the tree truncated, so tree facts are asked. */
function undecided(): Record<string, Reply> {
	const replies = recordedReplies("dead-certain");
	for (const [url, reply] of Object.entries(replies)) {
		if (url.includes("/git/trees/")) {
			const tree = JSON.parse(reply.body) as {
				tree: { path: string; type: string }[];
				truncated: boolean;
			};
			tree.tree.push({ path: "apps/pre-flight/package.json", type: "blob" });
			tree.truncated = true;
			replies[url] = { ...reply, body: JSON.stringify(tree) };
		}
		if (url.endsWith("/readme"))
			replies[url] = {
				...reply,
				body: "# dead-certain\n\n## Getting started\n",
			};
	}
	return replies;
}

const row = (page: Page, rule: string) =>
	page.locator("[data-check]").filter({
		has: page.getByRole("button", {
			name: new RegExp(`rule ${rule}\\. See why$`),
		}),
	});
const statement = (page: Page) => summary(page).locator("[data-statement]");
const list = (page: Page) =>
	page.getByRole("region", { name: "Needs your answer" });

async function openUndecided(page: Page) {
	await routeGitHub(page, undecided());
	await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
	await expect(summary(page)).toBeFocused();
	await expect(summary(page).locator("[data-state-word]")).toHaveText(
		"More answers needed",
	);
}

test("a yes/no question in a row changes the row and the summary at once (6.1, 6.2)", async ({
	page,
}) => {
	await openUndecided(page);
	const licence = row(page, "R-02");
	await expect(licence).toContainText(/Is there a file called LICENSE/);
	const before = await statement(page).textContent();
	await licence.getByRole("radio", { name: "Yes" }).click();
	await expect(licence.locator("[data-check-word]")).toHaveText("Passed");
	await expect(statement(page)).not.toHaveText(before ?? "");
	await expect(page.getByText(/loading/i)).toHaveCount(0);
});

test("a number question sits in Needs your answer and has the same effect (6.4)", async ({
	page,
}) => {
	await openUndecided(page);
	await expect(list(page)).toContainText(
		"How long is the demo video, in seconds?",
	);
	const video = list(page)
		.getByRole("listitem")
		.filter({ hasText: "How long is the demo video, in seconds?" });
	await video.getByRole("textbox").fill("120");
	await video.getByRole("button", { name: "Save answer" }).click();
	await expect(row(page, "R-09").locator("[data-check-word]")).toHaveText(
		"Passed",
	);
});

test("the rail lists an answer, and changing it asks again in its row, filled in (6.5, 6.6)", async ({
	page,
}) => {
	await openUndecided(page);
	await row(page, "R-02").getByRole("radio", { name: "Yes" }).click();
	const change = page.getByRole("button", { name: /^Change .*LICENSE/i });
	// Below 1280 px the rail folds into a "Your answers" disclosure.
	if (!(await change.isVisible()))
		await page.getByRole("button", { name: /^Your answers/ }).click();
	await change.click();
	const licence = row(page, "R-02");
	await expect(licence.getByRole("radio", { name: "Yes" })).toBeChecked();
	await licence.getByRole("radio", { name: "No" }).click();
	await expect(licence.locator("[data-check-word]")).toHaveText("Failed");
	await expect(summary(page).locator("[data-state-word]")).toHaveText(
		"Not ready",
	);
});

test("answers clear on Check another repository (6.7)", async ({ page }) => {
	await openUndecided(page);
	await row(page, "R-02").getByRole("radio", { name: "Yes" }).click();
	await page.getByRole("button", { name: "Check another repository" }).click();
	await page
		.getByRole("textbox", { name: "Repository", exact: true })
		.fill("chitrakumarsai/dead-certain");
	await page.getByRole("button", { name: "Run the checks" }).click();
	await expect(summary(page)).toBeFocused();
	await expect(
		row(page, "R-02").getByRole("radio", { name: "Yes" }),
	).not.toBeChecked();
});

test("a decided report asks nothing (6.8)", async ({ page }) => {
	await routeGitHub(page, recordedReplies("dc-sample-not-ready"));
	await openPreflight(page, "#/report?repo=chitrakumarsai/dc-sample-not-ready");
	await expect(summary(page)).toBeFocused();
	await expect(page.getByRole("radio")).toHaveCount(0);
	await expect(list(page)).toHaveCount(0);
});
