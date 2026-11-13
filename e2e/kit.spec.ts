import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

test("kit page has a clean console and no axe violations", async ({
	page,
}, testInfo) => {
	await page.goto("./kit/");
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

	await expectNoAxeViolations(page);
	// Evidence for the pull request. test-results/ is git-ignored.
	await page.screenshot({
		path: testInfo.outputPath("kit.png"),
		fullPage: true,
	});
});

for (const level of ["warn", "error"] as const) {
	test(`the console gate fails a test that logs console.${level}`, async ({
		page,
	}) => {
		test.fail(true, "the gate must turn this test red");
		await page.goto("./kit/");

		await page.evaluate((method) => console[method]("gate probe"), level);
	});
}

test("the reduced-motion project, and only it, reduces motion", async ({
	page,
}, testInfo) => {
	await page.goto("./kit/");

	const reduced = await page.evaluate(
		() => matchMedia("(prefers-reduced-motion: reduce)").matches,
	);

	expect(reduced).toBe(testInfo.project.name === "reduced-motion");
});

test("kit gallery shell has a heading, a skip link and an empty main", async ({
	page,
}) => {
	await page.goto("./kit/");

	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"Component kit",
	);
	await page.keyboard.press("Tab");
	await expect(
		page.getByRole("link", { name: "Skip to the content" }),
	).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.locator("main#content")).toBeFocused();
	await expect(page.locator("main#content")).toBeEmpty();
});

test("kit page loads the tokens: lightbox background and a token focus ring", async ({
	page,
}) => {
	await page.goto("./kit/");

	await expect(page.locator("body")).toHaveCSS(
		"background-color",
		"rgb(237, 242, 243)",
	);
	await page.keyboard.press("Tab");
	const skipLink = page.getByRole("link", { name: "Skip to the content" });
	await expect(skipLink).toHaveCSS("outline-color", "rgb(31, 111, 235)");
	await expect(skipLink).toHaveCSS("outline-width", "2px");
	await expect(skipLink).toHaveCSS("outline-offset", "2px");
});

test("kit page uses the Tailwind theme: token type and spacing classes apply", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 800 });
	await page.goto("./kit/");
	const heading = page.getByRole("heading", { level: 1 });

	await expect(heading).toHaveCSS("font-size", "21px");
	await expect(heading).toHaveCSS("line-height", "28px");
	await expect(heading).toHaveCSS("font-weight", "600");

	await page.setViewportSize({ width: 768, height: 800 });
	await expect(heading).toHaveCSS("font-size", "24px");
	await expect(heading).toHaveCSS("line-height", "32px");
});

test("forced colors keeps the focus ring as an outline", async ({ page }) => {
	await page.emulateMedia({ forcedColors: "active" });
	await page.goto("./kit/");

	await page.keyboard.press("Tab");
	const skipLink = page.getByRole("link", { name: "Skip to the content" });
	await expect(skipLink).toHaveCSS("outline-style", "solid");
	await expect(skipLink).toHaveCSS("outline-width", "2px");
});
