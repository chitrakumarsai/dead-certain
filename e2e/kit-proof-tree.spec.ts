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

test("the deciding clause is quoted under its rule sentence, once", async ({
	page,
}) => {
	await page.goto("./kit/#prooftree-deciding");
	const deciding = tree(page, "deciding");

	await expect(deciding.locator("blockquote")).toHaveCount(1);
	await expect(deciding.locator("blockquote")).toHaveCSS(
		"border-left-color",
		"rgb(242, 193, 46)",
	);
	// Only the root of the deep proof cites clause 1.2.
	await expect(
		deciding.locator('[data-node-id="0"] > [data-deciding] > blockquote'),
	).toContainText("Clause 1.2");
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
