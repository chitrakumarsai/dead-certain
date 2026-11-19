import { tabTo } from "./keyboard";
import { expect, test } from "./kit-fixtures";
import {
	openPreflight,
	routeGitHub,
	summary,
	undecidedReplies,
} from "./preflight-helpers";

test("start to report, an inline answer, the X-ray and the export, with no pointer (11.2, 13.10)", async ({
	page,
	context,
}) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await routeGitHub(page, undecidedReplies());
	await openPreflight(page);

	const field = page.getByRole("textbox", { name: "Repository", exact: true });
	await tabTo(page, field);
	await page.keyboard.type("chitrakumarsai/dead-certain");
	await page.keyboard.press("Enter");
	await expect(summary(page)).toBeFocused();

	// An inline answer: R-02 asks whether a licence file is at the root; 1 picks "Yes".
	const licence = page.locator("[data-check]").filter({
		has: page.getByRole("button", { name: /rule R-02\. See why$/ }),
	});
	await tabTo(page, licence.getByRole("radio").first());
	await page.keyboard.press("1");
	await expect(licence.locator("[data-check-word]")).toHaveText("Passed");

	const rule = page.getByRole("button", { name: /rule R-02\. See why$/ });
	await tabTo(page, rule);
	await page.keyboard.press("Enter");
	const tree = page.getByRole("tree", { name: "Proof" });
	await expect(tree).toBeVisible();
	await tabTo(page, tree.getByRole("treeitem").first());
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("Escape");
	await expect(tree).toHaveCount(0);
	await expect(rule).toBeFocused();

	await tabTo(
		page,
		page.getByRole("button", { name: "Copy report as Markdown" }),
	);
	await page.keyboard.press("Enter");
	expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
		/^# .* in `chitrakumarsai\/dead-certain`/,
	);
});
