import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

// ui-kit task 12.3: the theme toggle, its stored choice and the boot script.
const KIT = "./kit/";
const theme = (page: Page) =>
	page.evaluate(() => document.documentElement.dataset.theme ?? null);

const bodyBackground = (page: Page) =>
	page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const DARK_ROOM = "rgb(7, 19, 26)";
const LIGHTBOX = "rgb(237, 242, 243)";

test.use({ colorScheme: "dark" });

test("with nothing stored the room follows the system, and dark is the default", async ({
	page,
}) => {
	await page.goto(KIT);

	expect(await theme(page)).toBeNull();
	expect(await bodyBackground(page)).toBe(DARK_ROOM);
	await expect(
		page.getByRole("button", { name: /^Dark theme\. Switch to light theme$/ }),
	).toBeVisible();
});

test("the choice persists across a reload and is applied before first paint", async ({
	page,
}) => {
	await page.goto(KIT);
	await page.getByRole("button", { name: /^Dark theme/ }).click();
	await expect(
		page.getByRole("button", { name: "Light theme. Switch to dark theme" }),
	).toBeFocused();
	expect(await bodyBackground(page)).toBe(LIGHTBOX);
	expect(await page.evaluate(() => localStorage.getItem("dc-theme"))).toBe(
		"light",
	);

	// The boot script runs before any stylesheet, so the first paint is light.
	await page.addInitScript(() => {
		document.addEventListener(
			"readystatechange",
			() => {
				(window as unknown as { firstTheme?: string }).firstTheme ??=
					document.documentElement.dataset.theme;
			},
			{ once: true },
		);
	});
	await page.reload();
	expect(
		await page.evaluate(
			() => (window as unknown as { firstTheme?: string }).firstTheme,
		),
	).toBe("light");
	expect(await bodyBackground(page)).toBe(LIGHTBOX);
	await expectNoAxeViolations(page);
});

test("when storage throws the page still renders and follows the system", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, "localStorage", {
			get() {
				throw new Error("storage is blocked");
			},
		});
	});
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));

	await page.goto(KIT);
	await page.getByRole("button", { name: /^Dark theme/ }).click();

	expect(await bodyBackground(page)).toBe(LIGHTBOX);
	expect(errors).toEqual([]);
});

test("the boot script is the first thing in every page's head", async ({
	page,
}) => {
	for (const path of ["./", KIT, "./404.html"]) {
		await page.goto(path);
		const first = await page.evaluate(
			() => document.head.firstElementChild?.textContent ?? "",
		);
		expect(first, path).toContain('localStorage.getItem("dc-theme")');
	}
});

test("switching the theme moves nothing on the page", async ({ page }) => {
	await page.goto(KIT);
	await page.evaluate(() => {
		(window as unknown as { shift: number }).shift = 0;
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				(window as unknown as { shift: number }).shift += (
					entry as unknown as { value: number }
				).value;
			}
		}).observe({ type: "layout-shift" });
	});

	await page.getByRole("button", { name: /^Dark theme/ }).click();
	await page.getByRole("button", { name: /^Light theme/ }).click();

	expect(
		await page.evaluate(() => (window as unknown as { shift: number }).shift),
	).toBe(0);
});

// ui-kit 13.3, requirements 36.1 and 38.3: the phone header carries the toggle too.
for (const width of [320, 390]) {
	test(`at ${width} px the header toggle is reachable, 44 px and switches the theme`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 800 });
		await page.goto("./");
		const toggle = page
			.getByRole("banner")
			.getByRole("button", { name: /^Dark theme\. Switch to light theme$/ });

		await expect(toggle).toBeVisible();
		const box = await toggle.boundingBox();
		expect(box?.width).toBeGreaterThanOrEqual(44);
		expect(box?.height).toBeGreaterThanOrEqual(44);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - innerWidth,
			),
		).toBe(0);

		await toggle.focus();
		await page.keyboard.press("Enter");
		expect(await theme(page)).toBe("light");
		await expect(
			page
				.getByRole("banner")
				.getByRole("button", { name: /^Light theme\. Switch to dark theme$/ }),
		).toBeFocused();
		await expectNoAxeViolations(page, "header");
	});
}
