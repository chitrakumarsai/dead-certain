import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const STATES = [
	"collapsed",
	"expanded",
	"deep",
	"shared",
	"collected",
	"unknown",
	"deciding",
	"huge",
];
const tree = (page: Page, state: string) =>
	page.locator(`[data-specimen="prooftree-${state}"]`).getByRole("tree", {
		name: "Proof",
	});
/** bone-soft, the film's --text-soft. */
const STROKE = "rgb(143, 166, 174)";

test("the proof tree specimens exist on film and pass axe", async ({
	page,
}) => {
	await page.goto("./kit/#prooftree-collapsed");

	for (const state of STATES) {
		await expect(tree(page, state), state).toHaveCount(1);
		await expect(
			page.locator(
				`[data-specimen="prooftree-${state}"] [data-surface="film"]`,
			),
		).toHaveCount(1);
		await expectNoAxeViolations(page, `[data-specimen="prooftree-${state}"]`);
	}
});

test("tree items carry level, set size, position and true expansion", async ({
	page,
}) => {
	await page.goto("./kit/#prooftree-expanded");
	const expanded = tree(page, "expanded");
	const root = expanded.locator('[data-node-id="0"]');

	await expect(root).toHaveRole("treeitem");
	await expect(root).toHaveAttribute("aria-level", "1");
	await expect(root).toHaveAttribute("aria-setsize", "1");
	await expect(root).toHaveAttribute("aria-posinset", "1");
	await expect(root).toHaveAttribute("aria-expanded", "true");
	const second = expanded.locator('[data-node-id="0.1"]');
	await expect(second).toHaveAttribute("aria-level", "2");
	await expect(second).toHaveAttribute("aria-setsize", "2");
	await expect(second).toHaveAttribute("aria-posinset", "2");
	const leaf = expanded.locator('[data-node-id="0.1.0"]');
	await expect(leaf).not.toHaveAttribute("aria-expanded", /.*/);
	await expect(
		expanded.locator('[role="group"] > [data-node-id="0.1"]'),
	).toHaveCount(1);

	const closed = tree(page, "collapsed").locator('[data-node-id="0.0.0"]');
	await expect(closed).toHaveAttribute("aria-expanded", "false");
	await expect(
		tree(page, "collapsed").locator('[data-node-id="0.0.0.0"]'),
	).toHaveCount(0);
});

test("exactly one tree item per tree is in the tab order", async ({ page }) => {
	await page.goto("./kit/#prooftree-collapsed");

	for (const state of STATES) {
		await expect(
			tree(page, state).locator('[role="treeitem"][tabindex="0"]'),
			state,
		).toHaveCount(1);
	}
});

test("joints show rule id and sentence; bone ends show label, value and source", async ({
	page,
}) => {
	await page.goto("./kit/#prooftree-expanded");
	const expanded = tree(page, "expanded");
	const joint = expanded.locator('[data-node-id="0.0"]');

	await expect(joint).toHaveAccessibleName(
		"ROOM-02 Room rent of ₹6,000 is above the limit of ₹5,000.",
	);
	await expect(joint.locator("[data-rule]").first()).toHaveCSS(
		"font-family",
		/IBM Plex Mono/,
	);
	const bone = expanded.locator('[data-node-id="0.0.0"]');
	await expect(bone).toHaveAccessibleName(
		"Room rent per day ₹6,000 You answered",
	);
	await expect(
		tree(page, "collected").locator('[data-source="collected"]').first(),
	).toHaveText("Collected");
	await expect(tree(page, "unknown")).toContainText("Not known yet");
});

test("the deciding clause is quoted once, after the tree, and stays when branches close", async ({
	page,
}) => {
	await page.goto("./kit/#prooftree-deciding");
	const specimen = page.locator('[data-specimen="prooftree-deciding"]');
	const deciding = tree(page, "deciding");
	const quote = specimen.locator("[data-deciding] > blockquote");

	// Three rules in this proof cite clause 4.2.
	await expect(deciding.locator('[role="treeitem"]')).toHaveCount(5);
	await expect(specimen.locator("blockquote")).toHaveCount(1);
	await expect(quote).toContainText("Clause 4.2");
	await expect(quote).toHaveCSS("border-left-color", "rgb(242, 193, 46)");
	await expect(deciding.locator("blockquote")).toHaveCount(0);

	// Close every branch: the quote is outside the tree, so it stays.
	for (const id of ["0.0", "0.1", "0"]) {
		await deciding
			.locator(`[data-node-id="${id}"] > [data-row] [data-toggle]`)
			.click();
	}
	await expect(deciding.locator('[data-node-id="0"]')).toHaveAttribute(
		"aria-expanded",
		"false",
	);
	await expect(quote).toBeVisible();
});

test("strokes are drawn in the film's soft text colour", async ({ page }) => {
	await page.goto("./kit/#prooftree-expanded");

	await expect(
		tree(page, "expanded").locator('[role="group"]').first(),
	).toHaveCSS("border-left-color", STROKE);
});

test("a fact under two rules gets two ids, and the 200-node tree has unique ids", async ({
	page,
}) => {
	await page.goto("./kit/#prooftree-shared");
	const shared = tree(page, "shared").locator("[data-fact='sum_insured']");

	await expect(shared).toHaveCount(2);
	const sharedIds = await shared.evaluateAll((nodes) =>
		nodes.map((node) => node.getAttribute("data-node-id")),
	);
	expect(new Set(sharedIds).size).toBe(2);

	const ids = await tree(page, "huge")
		.locator("[data-node-id]")
		.evaluateAll((nodes) =>
			nodes.map((node) => node.getAttribute("data-node-id")),
		);
	expect(ids).toHaveLength(200);
	expect(new Set(ids).size).toBe(200);
});

test("a closed parent shows a closed chevron and its hidden count, unheard", async ({
	page,
}) => {
	await page.goto("./kit/#prooftree-collapsed");
	const collapsed = tree(page, "collapsed");
	const closed = collapsed.locator('[data-node-id="0.0.0"]');
	const open = collapsed.locator('[data-node-id="0.0"]');

	await expect(closed.locator("[data-toggle]").first()).toHaveAttribute(
		"data-toggle",
		"closed",
	);
	await expect(open.locator("[data-toggle]").first()).toHaveAttribute(
		"data-toggle",
		"open",
	);
	await expect(closed.locator("[data-hidden-count]")).toHaveText("1 hidden");
	await expect(closed.locator("[data-hidden-count]")).toHaveCSS(
		"font-family",
		/IBM Plex Mono/,
	);
	await expect(
		open.locator(":scope > [data-row] [data-hidden-count]"),
	).toHaveCount(0);
	// The count is for sighted users; aria-expanded already tells screen readers.
	await expect(closed).toHaveAccessibleName(
		"ROOM-01 The room rent limit is 1% of the sum insured per day.",
	);
	await expect(
		collapsed.locator('[data-node-id="0.0.0.0"] [data-toggle]'),
	).toHaveCount(0);
});

test("clicking the chevron opens and closes a branch, with a 44 px target", async ({
	page,
}) => {
	await page.goto("./kit/#prooftree-collapsed");
	const collapsed = tree(page, "collapsed");
	const closed = collapsed.locator('[data-node-id="0.0.0"]');
	const toggle = closed.locator(":scope > [data-row] [data-toggle]");

	const box = await toggle.boundingBox();
	expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
	expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
	await toggle.click();
	await expect(closed).toHaveAttribute("aria-expanded", "true");
	await expect(collapsed.locator('[data-node-id="0.0.0.0"]')).toHaveCount(1);
	await expect(closed).toHaveAttribute("tabindex", "0");
	await toggle.click();
	await expect(closed).toHaveAttribute("aria-expanded", "false");
	await expect(
		collapsed.locator('[role="treeitem"][tabindex="0"]'),
	).toHaveCount(1);
});
