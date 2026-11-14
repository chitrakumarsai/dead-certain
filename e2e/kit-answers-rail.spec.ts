import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const STATES = ["empty", "three", "current", "skipped", "collapsed", "rail"];
const specimen = (page: Page, state: string) =>
	page.locator(`[data-specimen="answersrail-${state}"]`);
const isWide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

test("the rail specimens exist and pass axe", async ({ page }) => {
	await page.goto("./kit/#answersrail-three");

	for (const state of STATES) {
		await expect(specimen(page, state), state).toHaveCount(1);
		await expectNoAxeViolations(page, `[data-specimen="answersrail-${state}"]`);
	}
});

/** Opens the "Your answers" disclosure when the specimen shows one. */
async function reveal(page: Page, state: string): Promise<void> {
	const trigger = specimen(page, state).getByRole("button", {
		name: /^Your answers \(\d+\)$/,
	});
	if (await trigger.isVisible()) await trigger.click();
}

test("each answer is a button named for changing it", async ({ page }) => {
	await page.goto("./kit/#answersrail-three");
	await reveal(page, "three");
	const three = specimen(page, "three");

	await expect(
		three.getByRole("button", {
			name: "Change Room rent per day, currently ₹6,000",
		}),
	).toBeVisible();
	await expect(
		three.getByRole("button", { name: "Change Age, currently 64" }),
	).toBeVisible();
	await expect(three.getByRole("button", { name: /^Change / })).toHaveCount(3);

	await three.getByRole("button", { name: "Change Age, currently 64" }).click();
	await expect(three.locator("[data-changed]")).toHaveText("age");
});

test("the current answer is marked aria-current", async ({ page }) => {
	await page.goto("./kit/#answersrail-current");
	await reveal(page, "current");
	const current = specimen(page, "current");

	await expect(
		current.getByRole("button", { name: /^Change Sum insured/ }),
	).toHaveAttribute("aria-current", "true");
	await expect(
		current.locator("[aria-current]").filter({ visible: true }),
	).toHaveCount(1);
});

test("skipped notes are plain lines, announced once", async ({ page }) => {
	await page.goto("./kit/#answersrail-skipped");
	const skipped = specimen(page, "skipped");

	const reason =
		"Pre-existing condition no longer matters. The answers so far decide this without it.";
	const note = skipped.getByText(reason).filter({ visible: true });
	await expect(note).toHaveCount(0);

	await skipped.getByRole("button", { name: "Add the skipped note" }).click();
	await reveal(page, "skipped");
	await expect(note).toBeVisible();
	await expect(note).not.toHaveRole("button");
	await expect(page.getByRole("status")).toHaveText(reason);
	await page.evaluate(() => {
		const region = document.querySelector('[role="status"]');
		if (region) region.textContent = "";
	});
	// A re-render with the same note does not announce it again.
	await skipped.getByRole("button", { name: "Re-render the rail" }).click();
	await expect(page.getByRole("status")).toHaveText("");
});

test("an empty rail says No answers yet, with no loading indicator", async ({
	page,
}) => {
	await page.goto("./kit/#answersrail-empty");
	await reveal(page, "empty");
	const empty = specimen(page, "empty");

	await expect(
		empty.getByText("No answers yet.").filter({ visible: true }),
	).toBeVisible();
	await expect(
		empty.locator('[role="progressbar"], [aria-busy="true"]'),
	).toHaveCount(0);
});

test("an aside from 1024 px, a disclosure below it", async ({ page }) => {
	await page.goto("./kit/#answersrail-rail");
	const rail = specimen(page, "rail");
	const aside = rail.getByRole("complementary", { name: "Your answers" });
	const disclosure = rail.getByRole("button", { name: "Your answers (3)" });

	if (isWide(page)) {
		await expect(aside).toBeVisible();
		await expect(disclosure).toHaveCount(0);
		const box = await aside.boundingBox();
		expect(box?.width).toBe(240);
	} else {
		await expect(aside).toHaveCount(0);
		await expect(disclosure).toBeVisible();
	}
});

test("with the film open side by side the rail collapses at every width", async ({
	page,
}) => {
	await page.goto("./kit/#answersrail-collapsed");
	const collapsed = specimen(page, "collapsed");

	await expect(
		collapsed.getByRole("complementary", { name: "Your answers" }),
	).toHaveCount(0);
	await collapsed.getByRole("button", { name: "Your answers (3)" }).click();
	await expect(
		collapsed.getByRole("button", { name: /^Change Age/ }),
	).toBeVisible();
});
