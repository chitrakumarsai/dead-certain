import type { Page, TestInfo } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const specimen = (page: Page, id: string) =>
	page.locator(`[data-specimen="xraystage-${id}"]`);
const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1280;
const isReduced = (info: TestInfo) => info.project.name === "reduced-motion";
/** The stage's film: in an XrayStage specimen at 1280 and up, the dialog below. */
const FILM =
	'[data-specimen^="xraystage-"] [data-film-panel], [role="dialog"][data-film-panel]';
/** The film heading: in the specimen at 1280 and up, in the dialog below. */
const filmHeading = (page: Page, name: string | RegExp) =>
	page.locator(FILM).getByRole("heading", { name, exact: true });

test("the stage specimens exist and pass axe while closed", async ({
	page,
}) => {
	await page.goto("./kit/#xraystage-closed");

	for (const id of ["closed", "vanishing"]) {
		await expect(specimen(page, id), id).toHaveCount(1);
		await expectNoAxeViolations(page, `[data-specimen="xraystage-${id}"]`);
	}
});

test("See why opens the film beside the sheet or as a bottom sheet, and focuses its heading", async ({
	page,
}) => {
	await page.goto("./kit/#xraystage-closed");
	const stage = specimen(page, "closed");

	await stage.getByRole("button", { name: "See why", exact: true }).click();

	await expect(filmHeading(page, "Why")).toBeFocused();
	await expect(page.getByRole("status")).toHaveText("Why");
	if (isWide(page)) {
		await expect(stage.locator("[data-xray-stage]")).toHaveAttribute(
			"data-film",
			"side",
		);
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expectNoAxeViolations(page, '[data-specimen="xraystage-closed"]');
	} else {
		await expect(page.getByRole("dialog", { name: "Why" })).toBeVisible();
	}
});

test("the develop: a scan line, or a 120 ms fade under reduced motion", async ({
	page,
}, testInfo) => {
	await page.goto("./kit/#xraystage-closed");
	const stage = specimen(page, "closed");

	await stage.getByRole("button", { name: "See why", exact: true }).click();

	const line = stage.locator("[data-scan-line]");
	if (isReduced(testInfo)) {
		await expect(line).toHaveCount(0);
		const reveal = page.locator("[data-film-reveal]").first();
		await expect(reveal).toHaveCSS("transition-property", "opacity");
		await expect(reveal).toHaveCSS("transition-duration", "0.12s");
	} else {
		await expect(line).toHaveCount(1);
		// Part-way through the 500 ms develop, the film is still partly clipped.
		const clip = await page
			.locator("[data-film-reveal]")
			.first()
			.evaluate((el) => getComputedStyle(el).clipPath);
		expect(clip).not.toBe("inset(0px 0% 0% 0px)");
		await expect(line).toHaveAttribute(
			"data-direction",
			isWide(page) ? "across" : "down",
		);
	}
});

test("closing returns focus to the opener", async ({ page }) => {
	await page.goto("./kit/#xraystage-closed");
	const stage = specimen(page, "closed");
	const opener = stage.getByRole("button", { name: "See why", exact: true });

	await opener.click();
	await expect(filmHeading(page, "Why")).toBeFocused();
	await page.locator(FILM).getByRole("button", { name: "Close" }).click();

	await expect(opener).toBeFocused();
	await expect(stage.locator("[data-xray-stage]")).not.toHaveAttribute(
		"data-film",
		"side",
	);
});

test("Escape in the proof tree closes and returns focus", async ({ page }) => {
	await page.goto("./kit/#xraystage-closed");
	const opener = specimen(page, "closed").getByRole("button", {
		name: "See why",
		exact: true,
	});

	await opener.click();
	await page.locator(FILM).locator('[role="treeitem"][tabindex="0"]').focus();
	await page.keyboard.press("Escape");

	await expect(opener).toBeFocused();
});

test("a ledger row opens its line, and another row swaps it at once", async ({
	page,
}) => {
	await page.goto("./kit/#xraystage-closed");
	const stage = specimen(page, "closed");
	const row = (name: RegExp) => stage.getByRole("button", { name });

	await row(/^Room rent above the limit/).click();
	await expect(
		filmHeading(page, "Why: Room rent above the limit"),
	).toBeFocused();

	if (!isWide(page)) return; // below 1280 the bottom sheet covers the ledger
	await row(/^Co-payment at age 61 or over/).click();
	const heading = filmHeading(page, "Why: Co-payment at age 61 or over");
	await expect(heading).toBeFocused();
	await expect(page.getByRole("status")).toHaveText(
		"Why: Co-payment at age 61 or over",
	);
	await expect(
		page.locator(FILM).locator('[data-node-id="0"]'),
	).toHaveAttribute("data-fact", "copay_deduction");
});

test("closing after the opener has gone lands on the sheet heading", async ({
	page,
}) => {
	await page.goto("./kit/#xraystage-vanishing");
	const stage = specimen(page, "vanishing");

	await stage.getByRole("button", { name: "See why, then go" }).click();
	await expect(filmHeading(page, "Why")).toBeFocused();
	await expect(
		stage.getByRole("button", { name: "See why, then go" }),
	).toHaveCount(0);
	await page.locator(FILM).getByRole("button", { name: "Close" }).click();

	await expect(
		stage.getByRole("heading", { name: "Claim verdict, opener goes" }),
	).toBeFocused();
});

test("resizing across 1280 px keeps the proof tree's state", async ({
	page,
}, testInfo) => {
	test.skip(testInfo.project.name !== "1280", "drives the viewport itself");
	await page.goto("./kit/#xraystage-closed");
	await specimen(page, "closed")
		.getByRole("button", { name: "See why", exact: true })
		.click();
	const closed = page.locator(FILM).locator('[data-node-id="0.0.0"]');
	await closed.locator(":scope > [data-row] [data-toggle]").click();
	await expect(closed).toHaveAttribute("aria-expanded", "true");

	await page.setViewportSize({ width: 1000, height: 900 });
	await expect(page.getByRole("dialog", { name: "Why" })).toBeVisible();
	await expect(
		page.locator('[role="dialog"] [data-node-id="0.0.0"]'),
	).toHaveAttribute("aria-expanded", "true");

	await page.setViewportSize({ width: 1280, height: 900 });
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(
		page.locator(FILM).locator('[data-node-id="0.0.0"]'),
	).toHaveAttribute("aria-expanded", "true");
});

test("the film is hidden in print", async ({ page }) => {
	await page.goto("./kit/#xraystage-closed");
	await specimen(page, "closed")
		.getByRole("button", { name: "See why", exact: true })
		.click();
	await expect(filmHeading(page, "Why")).toBeFocused();

	await page.emulateMedia({ media: "print" });

	for (const film of await page.locator(FILM).all()) {
		await expect(film).toBeHidden();
	}
});
