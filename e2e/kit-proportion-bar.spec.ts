import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const TOTAL = 210_000_00;
const BARS = [
	["all-paid", "₹2,10,000 paid."],
	["one-cut", "₹1,72,000 paid. ₹38,000 cut for room rent above the limit."],
	[
		"many-cuts",
		"₹1,30,000 paid. ₹38,000 cut for room rent above the limit. ₹29,500 cut for co-payment at age 61 or over. ₹12,500 cut for consumables the policy does not cover.",
	],
	[
		"all-cut",
		"₹0 paid. ₹2,10,000 cut for illness began in the waiting period.",
	],
	["zero-parts", "Nothing paid or cut yet."],
] as const;

const bar = (page: Page, state: string) =>
	page.locator(`[data-specimen="proportionbar-${state}"] [role="img"]`);

test("the bar specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#proportionbar-all-paid");

	for (const [state] of BARS) {
		await expect(bar(page, state), state).toHaveCount(1);
		await expectNoAxeViolations(
			page,
			`[data-specimen="proportionbar-${state}"]`,
		);
	}
});

test("each bar reads every part in words and amounts", async ({ page }) => {
	await page.goto("./kit/#proportionbar-all-paid");

	for (const [state, label] of BARS) {
		await expect(bar(page, state), state).toHaveAttribute("aria-label", label);
	}
});

test("flex-grow values sum to the total, none negative", async ({ page }) => {
	await page.goto("./kit/#proportionbar-all-paid");

	for (const [state] of BARS) {
		const grows = await bar(page, state)
			.locator("[data-part]")
			.evaluateAll((items) =>
				items.map((item) => Number(getComputedStyle(item).flexGrow)),
			);
		expect(
			grows.reduce((sum, grow) => sum + grow, 0),
			state,
		).toBe(TOTAL);
		expect(
			grows.every((grow) => grow >= 0),
			state,
		).toBe(true);
	}
});

test("parts keep 2 px, cuts are hatched, and gaps are 2 px", async ({
	page,
}) => {
	await page.goto("./kit/#proportionbar-many-cuts");
	const many = bar(page, "many-cuts");

	await expect(many).toHaveCSS("column-gap", "2px");
	for (const part of await many
		.locator('[data-part="paid"], [data-part="cut"]')
		.all()) {
		await expect(part).toHaveCSS("min-width", "2px");
	}
	const cuts = many.locator('[data-part="cut"]');
	await expect(cuts).toHaveCount(3);
	const patternId = await many.locator("pattern").getAttribute("id");
	for (const cut of await cuts.all()) {
		await expect(cut.locator("rect")).toHaveAttribute(
			"fill",
			`url(#${patternId})`,
		);
	}
	await expect(many.locator('[data-part="paid"] rect')).toHaveCount(0);
});

test("zero-value parts are read but not drawn", async ({ page }) => {
	await page.goto("./kit/#proportionbar-all-cut");

	await expect(bar(page, "all-cut").locator('[data-part="paid"]')).toHaveCount(
		0,
	);
	await expect(bar(page, "all-cut").locator('[data-part="cut"]')).toHaveCount(
		1,
	);
	await expect(
		bar(page, "zero-parts").locator('[data-part="remainder"]'),
	).toHaveCount(1);
});
