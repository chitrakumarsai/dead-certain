import { expect, test } from "./kit-fixtures";
import { openLanding, proofTree, seeWhy } from "./site-helpers";

/**
 * Screenshots for the pull request, not assertions: every static screen and
 * every gallery section at the project's width, saved to evidence/<project>/.
 * CI uploads that folder as the "screenshots" artifact on every run.
 */
const SCREENS = ["start", "question", "verdict", "xray", "preflight", "stale"];

test.beforeEach(({ page: _page }, testInfo) => {
	test.skip(
		testInfo.project.name === "reduced-motion",
		"the 1280 project already covers this width",
	);
});

const outDir = (project: string) => `evidence/${project}`;

test("screenshots of every static screen", async ({ page }, testInfo) => {
	for (const name of SCREENS) {
		await page.goto(`./kit/screen.html?screen=${name}`);
		await page.evaluate(() => document.fonts.ready);
		// Let the X-ray develop finish so the film is fully shown.
		const line = page.locator("[data-scan-line]");
		if ((await line.count()) > 0)
			await expect(line).toHaveClass(/\binvisible\b/);
		await page.screenshot({
			path: `${outDir(testInfo.project.name)}/screen-${name}.png`,
			fullPage: true,
		});
	}
});

test("screenshots of every gallery section", async ({ page }, testInfo) => {
	await page.goto("./kit/");
	await page.evaluate(() => document.fonts.ready);
	const sections = page.locator("main > section[aria-labelledby]");
	const count = await sections.count();
	expect(count).toBeGreaterThan(10);

	for (let i = 0; i < count; i++) {
		const section = sections.nth(i);
		const id = (await section.getAttribute("aria-labelledby")) ?? `${i}`;
		const file = `section-${String(i + 1).padStart(2, "0")}-${id.replace(/-heading$/, "")}.png`;
		await section.screenshot({
			path: `${outDir(testInfo.project.name)}/${file}`,
		});
	}
});

test("screenshots of the landing page and its 404", async ({
	page,
}, testInfo) => {
	const dir = outDir(testInfo.project.name);
	await openLanding(page);
	await page.screenshot({ path: `${dir}/site-landing.png`, fullPage: true });

	await seeWhy(page).click();
	await expect(proofTree(page)).toBeVisible();
	await expect(page.locator("[data-scan-line]")).toHaveClass(/\binvisible\b/);
	await page.screenshot({ path: `${dir}/site-landing-proof.png` });

	await page.goto("404.html");
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: `${dir}/site-404.png`, fullPage: true });
});
