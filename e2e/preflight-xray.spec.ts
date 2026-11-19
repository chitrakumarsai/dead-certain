import type { Page, TestInfo } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";
import {
	openPreflight,
	recordedReplies,
	routeGitHub,
	summary,
	undecidedReplies,
} from "./preflight-helpers";

const ruleButton = (page: Page, rule: string) =>
	page.getByRole("button", { name: new RegExp(`rule ${rule}\\. See why$`) });
const tree = (page: Page) => page.getByRole("tree", { name: "Proof" });
const row = (page: Page, rule: string) =>
	page.locator("[data-check]").filter({ has: ruleButton(page, rule) });
const isReduced = (info: TestInfo) => info.project.name === "reduced-motion";

async function openNotReady(page: Page) {
	await routeGitHub(page, recordedReplies("dc-sample-not-ready"));
	await openPreflight(page, "#/report?repo=chitrakumarsai/dc-sample-not-ready");
	await expect(summary(page)).toBeFocused();
}

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

test("a failed check opens Why: <label> with its rule, collected facts, evidence and clause (7.1 to 7.6)", async ({
	page,
}) => {
	await openNotReady(page);
	await ruleButton(page, "R-02").click();
	await expect(
		page.getByRole("heading", { name: "Why: Open-source licence" }),
	).toBeFocused();
	const root = tree(page).getByRole("treeitem").first();
	await expect(root).toContainText("R-02");
	// No check rule reads a derived fact, so the only derived node is the root, shown as its rule: no "Worked out" badge appears.
	await expect(tree(page)).toContainText("Collected");
	await expect(tree(page)).not.toContainText("You answered");
	await root.focus();
	await page.getByRole("button", { name: "Show the rule" }).click();
	await expect(page.locator("[data-rule-expression]")).toContainText(
		"license_detected",
	);
	const evidence = page.getByRole("region", { name: "Evidence" });
	await expect(evidence).toContainText("GitHub detects no licence");
	await expect(evidence.locator("[data-evidence]").first()).toHaveCSS(
		"font-family",
		/Plex Mono/,
	);
	await expect(
		page.locator("[data-surface=film] blockquote").last(),
	).toContainText("Clause 1.2");
	await expect(
		page.getByRole("button", { name: "Change this answer" }),
	).toHaveCount(0);
	await expectNoAxeViolations(page);
});

test("an answered fact reads You answered, and Change this answer asks it again in its row (7.4, 7.7)", async ({
	page,
}) => {
	await routeGitHub(page, undecidedReplies());
	await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
	await expect(summary(page)).toBeFocused();
	await row(page, "R-02").getByRole("radio", { name: "Yes" }).click();
	await ruleButton(page, "R-02").click();
	await expect(tree(page)).toContainText("You answered");
	await arrowTo(page, /You answered/);
	await page.getByRole("button", { name: "Change this answer" }).click();
	await expect(tree(page)).toHaveCount(0);
	await expect(
		row(page, "R-02").getByRole("radio", { name: "Yes" }),
	).toBeChecked();
});

test("the film sits beside the paper at 1280 px and is a sheet at 390 px (7.9)", async ({
	page,
}, info) => {
	await openNotReady(page);
	await ruleButton(page, "R-05").click();
	await expect(tree(page)).toBeVisible();
	if (info.project.name === "390")
		await expect(page.getByRole("dialog")).toBeVisible();
	if (info.project.name === "1280") {
		await expect(page.getByRole("dialog")).toHaveCount(0);
		const film = await tree(page).boundingBox();
		const paper = await summary(page).boundingBox();
		expect(film && paper && film.x > paper.x + paper.width).toBe(true);
	}
});

test("arrows move, Enter expands, Escape closes and focus returns to the rule button (7.11)", async ({
	page,
}) => {
	await openNotReady(page);
	await ruleButton(page, "R-05").focus();
	await page.keyboard.press("Enter");
	const first = tree(page).getByRole("treeitem").first();
	await first.focus();
	const expanded = await first.getAttribute("aria-expanded");
	await page.keyboard.press("Enter");
	await expect(first).not.toHaveAttribute("aria-expanded", expanded ?? "");
	await page.keyboard.press("Enter");
	await page.keyboard.press("ArrowDown");
	await expect(first).not.toBeFocused();
	await page.keyboard.press("Escape");
	await expect(tree(page)).toHaveCount(0);
	await expect(ruleButton(page, "R-05")).toBeFocused();
});

test("the develop: a scan line, or a 120 ms fade under reduced motion (7.10)", async ({
	page,
}, info) => {
	await openNotReady(page);
	await ruleButton(page, "R-02").click();
	const line = page.locator("[data-scan-line]");
	const reveal = page.locator("[data-film-reveal]").first();
	if (isReduced(info)) {
		await expect(line).toHaveCount(0);
		await expect(reveal).toHaveCSS("transition-duration", "0.12s");
	} else await expect(line).toHaveCount(1);
});

test("answering while the film is open updates the proof (7.13)", async ({
	page,
}, info) => {
	test.skip(
		info.project.name !== "1280" && info.project.name !== "reduced-motion",
		"the film is a modal sheet below 1280 px",
	);
	await routeGitHub(page, undecidedReplies());
	await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
	await expect(summary(page)).toBeFocused();
	await ruleButton(page, "R-02").click();
	await expect(tree(page).getByRole("treeitem").first()).toContainText(
		"Not known yet",
	);
	await row(page, "R-02").getByRole("radio", { name: "Yes" }).click();
	await expect(tree(page)).toContainText("You answered");
	await expect(tree(page).getByRole("treeitem").first()).not.toContainText(
		"Not known yet",
	);
});
