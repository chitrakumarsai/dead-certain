import { claimKb, reducedToken } from "./claim-check-engine";
import { openClaimCheck } from "./claim-check-helpers";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const clauseIds = Object.keys(claimKb.clauses);
const cited = new Set(claimKb.rules.map((r) => r.cite));
const uncited = clauseIds.filter((id) => !cited.has(id));

test("every clause appears with the rules that cite it", async ({ page }) => {
	await openClaimCheck(page, "#/rulebook");
	await expect(
		page.getByRole("heading", { level: 1, name: "The sample policy" }),
	).toBeFocused();
	await expect(page).toHaveTitle("The sample policy. Claim Check");
	for (const id of clauseIds) {
		const clause = page.locator(`[id="${id}"]`);
		await expect(clause).toContainText(`Clause ${id}`);
		for (const rule of claimKb.rules.filter((r) => r.cite === id))
			await expect(clause).toContainText(rule.id);
	}
	await expectNoAxeViolations(page);
});

test("an uncited clause says Not used in any decision", async ({ page }) => {
	test.skip(
		uncited.length === 0,
		"The real knowledge base cites every clause; the coverage unit test covers an uncited one.",
	);
	await openClaimCheck(page, "#/rulebook");
	for (const id of uncited)
		await expect(page.locator(`[id="${id}"]`)).toContainText(
			"Not used in any decision",
		);
});

test("every rule appears with its clause, and the link focuses that clause", async ({
	page,
}) => {
	await openClaimCheck(page, "#/rulebook");
	const rules = page.getByRole("list", { name: "Rules", exact: true });
	await expect(rules.getByRole("listitem")).toHaveCount(claimKb.rules.length);
	for (const rule of claimKb.rules)
		await expect(rules).toContainText(`${rule.id} cites clause ${rule.cite}`);
	await rules
		.getByRole("link", { name: /^clause 6\.1/ })
		.first()
		.click();
	await expect(page.locator('[id="6.1"]')).toBeFocused();
});

test("?clause= opens the page on that clause", async ({ page }) => {
	await openClaimCheck(page, "#/rulebook?clause=4.2");
	await expect(page.locator('[id="4.2"]')).toBeFocused();
});

test("with a verdict, Open its proof opens that rule's line on the check", async ({
	page,
}) => {
	await openClaimCheck(page, `#/?r=${reducedToken}`);
	await expect(page.getByRole("table")).toBeVisible();
	// In-page navigation, as the nav link does, so the answers stay in memory.
	await page.evaluate(() => {
		location.hash = "#/rulebook";
	});
	const copay = page.getByRole("list", { name: "Rules citing clause 6.1" });
	await copay.getByRole("link", { name: "Open its proof" }).click();
	await expect(
		page.getByRole("heading", { name: "Why: Co-payment" }),
	).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`#/\\?r=${reducedToken}$`));
});

test("an unknown route shows the 404 page with working links", async ({
	page,
}) => {
	await openClaimCheck(page, "#/nowhere");
	const heading = page.getByRole("heading", { level: 1 });
	await expect(heading).toHaveText("Page not found");
	await expect(heading).toBeFocused();
	await expect(page).toHaveTitle("Page not found. Claim Check");
	await expect(page.locator("main")).not.toContainText("!");
	await expectNoAxeViolations(page);
	await page
		.locator("main")
		.getByRole("link", { name: "Read the sample policy" })
		.click();
	await expect(
		page.getByRole("heading", { level: 1, name: "The sample policy" }),
	).toBeVisible();
	await openClaimCheck(page, "#/nowhere");
	await page
		.locator("main")
		.getByRole("link", { name: "Check a claim" })
		.click();
	await expect(
		page.getByRole("button", { name: "Start the check" }),
	).toBeVisible();
});
