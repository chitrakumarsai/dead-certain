import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const specimen = (page: Page, id: string) =>
	page.locator(`[data-specimen="prooftree-${id}"]`);
const tree = (page: Page, id: string) =>
	specimen(page, id).getByRole("tree", { name: "Proof" });
const node = (page: Page, id: string, nodeId: string) =>
	tree(page, id).locator(`[data-node-id="${nodeId}"]`);

test("the keyboard specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#prooftree-keys-joint");

	for (const id of ["keys-joint", "keys-bone", "actions"]) {
		await expect(tree(page, id), id).toHaveCount(1);
		await expectNoAxeViolations(page, `[data-specimen="prooftree-${id}"]`);
	}
});

test("each key moves the active node, and focus follows it", async ({
	page,
}) => {
	await page.goto("./kit/#prooftree-keys-joint");
	const at = (nodeId: string) => node(page, "keys-joint", nodeId);
	await at("0.0").focus();

	await page.keyboard.press("ArrowDown");
	await expect(at("0.0.0")).toBeFocused();
	await expect(at("0.0.0")).toHaveAttribute("tabindex", "0");
	await expect(at("0.0")).toHaveAttribute("tabindex", "-1");

	await page.keyboard.press("ArrowUp");
	await expect(at("0.0")).toBeFocused();

	await page.keyboard.press("ArrowLeft");
	await expect(at("0.0")).toHaveAttribute("aria-expanded", "false");
	await expect(at("0.0")).toBeFocused();

	await page.keyboard.press("ArrowRight");
	await expect(at("0.0")).toHaveAttribute("aria-expanded", "true");
	await page.keyboard.press("ArrowRight");
	await expect(at("0.0.0")).toBeFocused();

	await page.keyboard.press("ArrowLeft");
	await expect(at("0.0")).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(at("0.0")).toHaveAttribute("aria-expanded", "false");
	await page.keyboard.press("Enter");
	await expect(at("0.0")).toHaveAttribute("aria-expanded", "true");

	await page.keyboard.press("End");
	await expect(at("0.1.0")).toBeFocused();
	await page.keyboard.press("Home");
	await expect(at("0")).toBeFocused();
	await expect(
		tree(page, "keys-joint").locator('[role="treeitem"][tabindex="0"]'),
	).toHaveCount(1);
});

test("Tab reaches the active node's actions, then leaves the tree", async ({
	page,
}) => {
	await page.goto("./kit/#prooftree-keys-joint");
	const keys = tree(page, "keys-joint");
	await node(page, "keys-joint", "0.0").focus();

	await expect(keys.getByRole("button", { name: "Show the rule" })).toHaveCount(
		1,
	);
	await page.keyboard.press("Tab");
	await expect(
		keys.getByRole("button", { name: "Show the rule" }),
	).toBeFocused();
	await page.keyboard.press("Tab");
	const isInTree = await keys.evaluate((el) =>
		el.contains(document.activeElement),
	);
	expect(isInTree).toBe(false);
});

test("keys pressed on an action do not move the tree", async ({ page }) => {
	await page.goto("./kit/#prooftree-keys-joint");
	const keys = tree(page, "keys-joint");
	await node(page, "keys-joint", "0.0").focus();
	await page.keyboard.press("Tab");

	await page.keyboard.press("ArrowDown");
	await expect(node(page, "keys-joint", "0.0")).toHaveAttribute(
		"tabindex",
		"0",
	);
	await page.keyboard.press("Enter");
	await expect(node(page, "keys-joint", "0.0")).toHaveAttribute(
		"aria-expanded",
		"true",
	);
	await expect(keys.locator("[data-rule-expression]")).toHaveText(
		"rent_over_cap = room_rent_per_day > room_rent_cap",
	);
	await expect(keys.locator("[data-rule-expression]")).toHaveCSS(
		"font-family",
		/IBM Plex Mono/,
	);
});

test("an answered fact offers Change this answer while active", async ({
	page,
}) => {
	await page.goto("./kit/#prooftree-keys-bone");
	const bone = specimen(page, "keys-bone");
	await node(page, "keys-bone", "0.0.0").focus();

	await page.keyboard.press("Tab");
	await expect(
		bone.getByRole("button", { name: "Change this answer" }),
	).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(bone.locator("[data-changed]")).toHaveText("room_rent_per_day");

	await node(page, "keys-bone", "0.0.0").focus();
	await page.keyboard.press("ArrowUp");
	await expect(
		bone.getByRole("button", { name: "Change this answer" }),
	).toHaveCount(0);
});

test("Escape anywhere in the tree fires onEscape", async ({ page }) => {
	await page.goto("./kit/#prooftree-actions");
	const actions = specimen(page, "actions");
	await node(page, "actions", "0").focus();

	await page.keyboard.press("Escape");
	await expect(actions.locator("[data-escaped]")).toHaveText("1");
	await page.keyboard.press("Tab");
	await page.keyboard.press("Escape");
	await expect(actions.locator("[data-escaped]")).toHaveText("2");
});
