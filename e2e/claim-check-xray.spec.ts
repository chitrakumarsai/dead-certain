import type { Page, TestInfo } from "@playwright/test";
import { reducedToken as token } from "./claim-check-engine";
import { openClaimCheck, questionHeading } from "./claim-check-helpers";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const isReduced = (info: TestInfo) => info.project.name === "reduced-motion";

async function openVerdict(page: Page) {
	await openClaimCheck(page, `#/?r=${token}`);
	await expect(page.getByRole("table")).toBeVisible();
}
const seeWhy = (page: Page) =>
	page.getByRole("button", { name: "See why", exact: true });
const tree = (page: Page) => page.getByRole("tree", { name: "Proof" });

/** Moves the tree's active row down with the arrow keys until `name` has focus. */
async function arrowTo(page: Page, name: RegExp) {
	const target = tree(page).getByRole("treeitem", { name });
	await tree(page).getByRole("treeitem").first().focus();
	for (let i = 0; i < 20; i++) {
		if (await target.evaluate((el) => el === document.activeElement)) return;
		await page.keyboard.press("ArrowDown");
	}
	await expect(target).toBeFocused();
}

test("See why opens the proof titled Why, with its rule, badges and deciding clause", async ({
	page,
}) => {
	await openVerdict(page);
	await seeWhy(page).click();
	await expect(
		page.getByRole("heading", { name: "Why", exact: true }),
	).toBeFocused();
	await expect(tree(page)).toBeVisible();
	await expect(tree(page).getByRole("treeitem").first()).toContainText(
		"OUT-03",
	);
	await expect(
		page
			.locator("[data-surface=film] blockquote, [data-surface=film] figure")
			.last(),
	).toBeVisible();
	await expectNoAxeViolations(page);
});

test("a ledger row opens Why: <label>, and its rule sits behind Show the rule", async ({
	page,
}) => {
	await openVerdict(page);
	await page
		.getByRole("table")
		.getByRole("button", { name: /Co-payment/ })
		.click();
	await expect(
		page.getByRole("heading", { name: "Why: Co-payment" }),
	).toBeVisible();
	const root = tree(page).getByRole("treeitem").first();
	await expect(root).toContainText("20% of the admissible claim of ₹1,65,000");
	await root.focus();
	await page.getByRole("button", { name: "Show the rule" }).click();
	await expect(page.locator("[data-rule-expression]")).toContainText(
		"copayment_applies",
	);
});

test("answered facts read You answered, and Change this answer shows the question", async ({
	page,
}) => {
	await openVerdict(page);
	await page
		.getByRole("table")
		.getByRole("button", { name: /Co-payment/ })
		.click();
	// Only the active row shows its actions.
	await arrowTo(page, /^Age at admission 65 You answered/);
	await page.getByRole("button", { name: "Change this answer" }).click();
	await expect(tree(page)).toHaveCount(0);
	await expect(questionHeading(page)).toBeVisible();
	await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});

test("the film sits beside the sheet at 1280 px and is a sheet at 390 px", async ({
	page,
}, info) => {
	await openVerdict(page);
	await seeWhy(page).click();
	await expect(tree(page)).toBeVisible();
	const dialog = page.getByRole("dialog");
	if (info.project.name === "390") await expect(dialog).toBeVisible();
	if (info.project.name === "1280") {
		await expect(dialog).toHaveCount(0);
		const film = await tree(page).boundingBox();
		const sheet = await page.getByRole("table").boundingBox();
		expect(film && sheet && film.x > sheet.x + sheet.width).toBe(true);
	}
});

test("arrows move, Enter expands, Escape closes and focus returns to the opener", async ({
	page,
}) => {
	await openVerdict(page);
	await seeWhy(page).focus();
	await page.keyboard.press("Enter");
	await expect(
		page.getByRole("heading", { name: "Why", exact: true }),
	).toBeFocused();
	const first = tree(page).getByRole("treeitem").first();
	await first.focus();
	const expanded = await first.getAttribute("aria-expanded");
	await page.keyboard.press("Enter");
	await expect(first).not.toHaveAttribute("aria-expanded", expanded ?? "");
	await page.keyboard.press("Enter");
	await expect(first).toHaveAttribute("aria-expanded", expanded ?? "");
	await page.keyboard.press("ArrowDown");
	await expect(first).not.toBeFocused();
	await page.keyboard.press("Escape");
	await expect(tree(page)).toHaveCount(0);
	await expect(seeWhy(page)).toBeFocused();
});

test("the develop: a scan line, or a 120 ms fade under reduced motion", async ({
	page,
}, info) => {
	await openVerdict(page);
	await seeWhy(page).click();
	const line = page.locator("[data-scan-line]");
	const reveal = page.locator("[data-film-reveal]").first();
	if (isReduced(info)) {
		await expect(line).toHaveCount(0);
		await expect(reveal).toHaveCSS("transition-duration", "0.12s");
	} else {
		await expect(line).toHaveCount(1);
		const clip = await reveal.evaluate((el) => getComputedStyle(el).clipPath);
		expect(clip).not.toBe("inset(0px 0% 0% 0px)");
	}
});

test("a change that removes the open line closes the panel", async ({
	page,
}) => {
	await openVerdict(page);
	await page
		.getByRole("table")
		.getByRole("button", { name: /Co-payment/ })
		.click();
	await arrowTo(page, /^Age at admission/);
	await page.getByRole("button", { name: "Change this answer" }).click();
	await page.locator("main input").first().fill("40");
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page.getByRole("table")).toBeVisible();
	await expect(page.getByRole("table").getByText("Co-payment")).toHaveCount(0);
	await expect(tree(page)).toHaveCount(0);
});
