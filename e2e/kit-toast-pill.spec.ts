import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

// ui-kit 14.1: Toast and Pill, plus the Kbd specimens added with them.
const specimen = (page: Page, id: string) =>
	page.locator(`[data-specimen="${id}"]`);

test("the toast is read out through the page's one live region", async ({
	page,
}) => {
	await page.goto("./kit/#toast-confirmed");
	const confirmed = specimen(page, "toast-confirmed");

	await confirmed
		.getByRole("button", { name: "Show the confirmed toast" })
		.click();

	await expect(confirmed.locator("[data-toast]")).toContainText("Link copied.");
	await expect(page.locator("[aria-live]")).toHaveCount(1);
	await expect(page.locator("[aria-live]")).toHaveText("Link copied.");
	await expect(
		page.locator("[data-toast] [role], [data-toast][role]"),
	).toHaveCount(0);
	await expectNoAxeViolations(page, '[data-specimen^="toast-"]');
});

test("only a confirmed action pulses, and reduced motion drops the pulse", async ({
	page,
}, testInfo) => {
	await page.goto("./kit/#toast-confirmed");

	await expect(
		specimen(page, "toast-notice").locator("[data-toast]"),
	).not.toHaveClass(/\bpulse-confirm\b/);
	await specimen(page, "toast-confirmed")
		.getByRole("button", { name: "Show the confirmed toast" })
		.click();
	const toast = specimen(page, "toast-confirmed").locator("[data-toast]");

	await expect(toast).toHaveClass(/\bpulse-confirm\b/);
	expect(
		await toast.evaluate((el) => getComputedStyle(el, "::after").animationName),
	).toBe(testInfo.project.name === "reduced-motion" ? "none" : "dc-pulse");
});

test("Dismiss is a 44 px button, and focus moves to the button that replaces it", async ({
	page,
}) => {
	await page.goto("./kit/#toast-notice");
	const notice = specimen(page, "toast-notice");
	const dismiss = notice.getByRole("button", { name: "Dismiss" });

	const box = await dismiss.boundingBox();
	expect(box?.width).toBeGreaterThanOrEqual(44);
	expect(box?.height).toBeGreaterThanOrEqual(44);
	await dismiss.click();

	await expect(notice.locator("[data-toast]")).toHaveCount(0);
	await expect(
		notice.getByRole("button", { name: "Show the notice" }),
	).toBeFocused();
});

test("a pill has a 999 px radius and is not a control", async ({ page }) => {
	await page.goto("./kit/#pill-room");

	for (const id of ["pill-room", "pill-paper"]) {
		const pills = specimen(page, id).locator("span.rounded-pill");
		await expect(pills, id).toHaveCount(2);
		for (const pill of await pills.all()) {
			await expect(pill).toHaveCSS("border-radius", "999px");
		}
		await expect(specimen(page, id).getByRole("button"), id).toHaveCount(0);
	}
	// The wax tone is a fill with plain text, never wax text.
	const wax = specimen(page, "pill-room").getByText("New");
	await expect(wax).not.toHaveCSS("color", "rgb(242, 193, 46)");
});

test("on paper, a key and a pill take paper's ink edges", async ({ page }) => {
	await page.goto("./kit/#kbd-paper");

	await expect(specimen(page, "kbd-paper").locator("kbd")).toHaveCSS(
		"border-top-color",
		"rgba(19, 34, 44, 0.18)",
	);
	await expect(specimen(page, "kbd-room").locator("kbd").first()).toHaveCSS(
		"font-size",
		"13px",
	);
});
