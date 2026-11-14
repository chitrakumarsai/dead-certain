import type { Page } from "@playwright/test";
import { expect, test, waitForKit } from "./kit-fixtures";

/**
 * The accessibility and responsive sweep (task 9.5) over the gallery and every
 * static screen. Axe runs in the other specs at every width.
 */
const PAGES = [
	"./kit/",
	...["start", "question", "verdict", "xray", "preflight", "stale"].map(
		(name) => `./kit/screen.html?screen=${name}`,
	),
];
const TOUCH = 44;
const INTERACTIVE =
	'a[href], button, input, select, textarea, [role="radio"], [role="checkbox"]';

/** Visible interactive elements smaller than 44 by 44 px, with what they are. */
async function smallTargets(page: Page): Promise<string[]> {
	return page.locator(INTERACTIVE).evaluateAll((elements, touch) => {
		const out: string[] = [];
		for (const element of elements) {
			// A stretched button's hit area is its marked container (a Ledger row).
			const box = (
				element.closest("[data-hit-area]") ?? element
			).getBoundingClientRect();
			const style = getComputedStyle(element);
			// Off-screen until focused (the skip link) or not drawn at all.
			const isHidden =
				box.width <= 1 ||
				box.height <= 1 ||
				style.visibility === "hidden" ||
				style.clip === "rect(0px, 0px, 0px, 0px)" ||
				element.closest("[inert], [aria-hidden='true']") !== null;
			if (isHidden) continue;
			if (box.width < touch || box.height < touch) {
				const name = (
					element.getAttribute("aria-label") ??
					element.textContent ??
					""
				)
					.trim()
					.slice(0, 40);
				out.push(
					`${element.tagName.toLowerCase()} "${name}" ${Math.round(box.width)}x${Math.round(box.height)}`,
				);
			}
		}
		return out;
	}, TOUCH);
}

async function horizontalOverflow(page: Page): Promise<number> {
	return page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
}

for (const url of PAGES) {
	test(`${url}: every interactive element is at least 44 by 44 px`, async ({
		page,
	}) => {
		await page.goto(url);
		await page.evaluate(() => document.fonts.ready);

		expect(await smallTargets(page)).toEqual([]);
	});

	test(`${url}: no sideways scroll at 320 px or at 200% zoom`, async ({
		page,
	}, testInfo) => {
		test.skip(testInfo.project.name !== "1280", "sets its own viewport");
		// 200% zoom on a 1280 px window lays out at 640 CSS px.
		for (const width of [320, 640]) {
			await page.setViewportSize({ width, height: 800 });
			await page.goto(url);
			await page.evaluate(() => document.fonts.ready);
			const line = page.locator("[data-scan-line]");
			if ((await line.count()) > 0)
				await expect(line).toHaveClass(/\binvisible\b/);
			expect(
				await horizontalOverflow(page),
				`${url} at ${width}`,
			).toBeLessThanOrEqual(0);
		}
	});

	test(`${url}: every form field has an accessible name`, async ({ page }) => {
		await page.goto(url);

		const fields = page.locator(
			'input:not([type="hidden"]), select, textarea, [role="radiogroup"]',
		);
		for (const field of await fields.all()) {
			if (!(await field.isVisible())) continue;
			await expect(field).toHaveAccessibleName(/\S/);
		}
	});
}

test("a focused skip link is at least 44 by 44 px", async ({ page }) => {
	for (const url of ["./kit/", "./kit/screen.html?screen=start"]) {
		await page.goto(url);
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
		if (url === "./kit/") await waitForKit(page);
		await page.keyboard.press("Tab");
		const skip = page.getByRole("link", { name: "Skip to the content" });
		await expect(skip, url).toBeFocused();
		const box = await skip.boundingBox();
		expect(box?.height ?? 0, url).toBeGreaterThanOrEqual(44);
		expect(box?.width ?? 0, url).toBeGreaterThanOrEqual(44);
	}
});

test("every SourceBadge shows its word and its shape marker", async ({
	page,
}) => {
	await page.goto("./kit/");
	const badges = page.locator("[data-source]");

	expect(await badges.count()).toBeGreaterThan(10);
	for (const badge of await badges.all()) {
		await expect(badge).toHaveText(/^(You answered|Collected|Worked out)$/);
		await expect(badge.locator("svg[data-marker]")).toHaveCount(1);
	}
});
