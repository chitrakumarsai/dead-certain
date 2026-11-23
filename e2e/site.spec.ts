import { expect, test } from "./kit-fixtures";
import {
	escapeFromTree,
	openLanding,
	proofTree,
	STATEMENT,
	seeWhy,
} from "./site-helpers";

// The landing page, at 390, 768, 1280 and reduced motion (requirement 9.4).

test("one level-1 heading, the tagline", async ({ page }) => {
	await openLanding(page);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"LLMs guess. The dead are certain.",
	);
});

test("the hero shows G-01's statement and its four deductions with their clauses", async ({
	page,
}) => {
	await openLanding(page);
	await expect(page.getByText(STATEMENT, { exact: true })).toBeVisible();
	const ledger = page.getByRole("table");
	for (const [label, clause] of [
		["Annexure 1 items", "5.3"],
		["Room rent over the limit", "4.2"],
		["Other charges reduced for room rent", "4.2"],
		["Co-payment", "6.1"],
	] as const)
		await expect(
			ledger.getByRole("row").filter({ hasText: label }),
		).toContainText(clause);
});

test("See why opens the proof; Escape closes it and returns focus", async ({
	page,
}) => {
	await openLanding(page);
	await seeWhy(page).click();
	await expect(
		page.getByRole("heading", { name: "Why", exact: true }),
	).toBeVisible();
	await expect(proofTree(page)).toBeVisible();
	const side = await page.locator("[data-film=side]").count();
	expect(side, "side by side only from 1280 px").toBe(
		(page.viewportSize()?.width ?? 0) >= 1280 ? 1 : 0,
	);
	await expect(page.getByRole("button", { name: /change/i })).toHaveCount(0);
	await escapeFromTree(page);
	await expect(proofTree(page)).toHaveCount(0);
	await expect(seeWhy(page)).toBeFocused();
});

test("a ledger row opens its own proof and focus returns to the row", async ({
	page,
}) => {
	await openLanding(page);
	const row = page.getByRole("button", { name: /Room rent over the limit/ });
	await row.click();
	await expect(
		page.getByRole("heading", { name: "Why: Room rent over the limit" }),
	).toBeVisible();
	await escapeFromTree(page);
	await expect(row).toBeFocused();
});

test("with reduced motion there is no scan line", async ({ page }, info) => {
	test.skip(info.project.name !== "reduced-motion", "reduced motion only");
	await openLanding(page);
	await seeWhy(page).click();
	await expect(proofTree(page)).toBeVisible();
	await expect(page.locator("[data-scan-line]")).toHaveCount(0);
});

test("Tab follows the reading order from the top of the page", async ({
	page,
}) => {
	await openLanding(page);
	const order = [
		"Skip to the content",
		"See why",
		"Check your own claim",
		"Answers used for this claim",
		"Read clause 4.2 in the rulebook",
		"Open the proof above",
		"The .kiro folder",
		"Copy command",
		'Read "Add a third app" in the README',
	];
	const seen: string[] = [];
	for (let i = 0; i < 40 && !seen.includes(order.at(-1) ?? ""); i++) {
		await page.keyboard.press("Tab");
		seen.push(
			await page.evaluate(
				() => document.activeElement?.textContent?.trim() ?? "",
			),
		);
	}
	const at = order.map((name) => seen.indexOf(name));
	expect(
		at.every((n) => n >= 0),
		seen.join(" | "),
	).toBe(true);
	expect([...at].sort((a, b) => a - b)).toEqual(at);
});

test("every link goes where it says", async ({ page }) => {
	await openLanding(page);
	const repo = "https://github.com/chitrakumarsai/dead-certain";
	const main = page.getByRole("main");
	for (const [name, href] of [
		["Check your own claim", "/dead-certain/claim-check/"],
		[
			"Read clause 4.2 in the rulebook",
			"/dead-certain/claim-check/#/rulebook?clause=4.2",
		],
		["The .kiro folder", `${repo}/tree/main/.kiro`],
		['Read "Add a third app" in the README', `${repo}#add-a-third-app`],
	] as const)
		await expect(main.getByRole("link", { name, exact: true })).toHaveAttribute(
			"href",
			href,
		);
	const cards = page.getByRole("region", {
		name: "Two apps on the same engine",
	});
	await expect(
		cards.getByRole("link", { name: "Claim Check" }),
	).toHaveAttribute("href", "/dead-certain/claim-check/");
	await expect(cards.getByRole("link", { name: "Pre-Flight" })).toHaveAttribute(
		"href",
		"/dead-certain/pre-flight/",
	);
	// Below 768 px the nav sits behind Menu.
	const menu = page.getByRole("button", { name: "Menu" });
	if (await menu.isVisible()) await menu.click();
	const nav = page.getByRole("navigation", { name: "Main" });
	for (const [name, href] of [
		["Component kit", "/dead-certain/kit/"],
		["Source", repo],
	] as const)
		await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute(
			"href",
			href,
		);
});

test("Copy command copies and announces Copied", async ({ page, context }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await openLanding(page);
	await page.getByRole("button", { name: "Copy command" }).click();
	await expect(
		page.locator("[aria-live]").filter({ hasText: "Copied" }),
	).toHaveCount(1);
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		"pnpm new-app my-app",
	);
});

test("without a clipboard, Copy command selects the command and says so", async ({
	page,
}) => {
	await page.addInitScript(() =>
		Object.defineProperty(navigator, "clipboard", { value: undefined }),
	);
	await openLanding(page);
	await page.getByRole("button", { name: "Copy command" }).click();
	await expect(
		page.getByText("Copy unavailable. The command is selected.").first(),
	).toBeVisible();
	expect(await page.evaluate(() => String(window.getSelection()))).toBe(
		"pnpm new-app my-app",
	);
});

test("the 404 page has its heading and the link home", async ({ page }) => {
	await page.goto("404.html");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"Page not found",
	);
	await expect(
		page.getByRole("link", { name: "Go to the Dead Certain home page" }),
	).toHaveAttribute("href", "/dead-certain/");
});
