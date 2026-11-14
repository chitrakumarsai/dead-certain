import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const SOURCES = [
	{ source: "answered", word: "You answered", shape: "square" },
	{ source: "collected", word: "Collected", shape: "ring" },
	{ source: "derived", word: "Worked out", shape: "diamond" },
] as const;

const SOFT = { paper: "rgb(74, 90, 100)", film: "rgb(143, 166, 174)" };

for (const surface of ["paper", "film"] as const) {
	for (const { source, word, shape } of SOURCES) {
		test(`${source} on ${surface}: the words "${word}" and a hidden ${shape}`, async ({
			page,
		}) => {
			const id = `sourcebadge-${source}-${surface}`;
			await page.goto(`./kit/#${id}`);
			const badge = page.locator(
				`[data-specimen="${id}"] [data-source="${source}"]`,
			);

			await expect(badge).toHaveText(word);
			await expect(badge).toHaveCSS("color", SOFT[surface]);
			const marker = badge.locator(`[data-marker="${shape}"]`);
			await expect(marker).toHaveCount(1);
			await expect(marker).toHaveAttribute("aria-hidden", "true");
			await expect(marker).toBeVisible();
			await expectNoAxeViolations(page, `[data-specimen="${id}"]`);
		});
	}
}

test("the three markers are three different shapes", async ({ page }) => {
	await page.goto("./kit/#sourcebadge-answered-paper");

	const drawings = await page
		.locator('[data-specimen$="-paper"] [data-marker]')
		.evaluateAll((all) => all.map((m) => m.innerHTML));

	expect(drawings).toHaveLength(3);
	expect(new Set(drawings).size).toBe(3);
});
