import { expect, expectNoAxeViolations, test } from "./kit-fixtures";
import { openPreflight, routeGitHub, summary } from "./preflight-helpers";
import { longLines, SCREENS } from "./preflight-screens";
import { horizontalOverflow, smallTargets } from "./sweep";

test.use({ consoleAllow: [/^Failed to load resource/] });

// Axe and touch targets on every screen (11.1, 11.3).
for (const screen of SCREENS)
	test(`${screen.name}: no axe violations and every target is at least 44 px`, async ({
		page,
	}) => {
		await screen.open(page);
		await page.evaluate(() => document.fonts.ready);
		await expectNoAxeViolations(page);
		expect(await smallTargets(page)).toEqual([]);
	});

// No sideways scroll at 320 px or at 200% zoom, with a very long path and .gitignore line (11.4).
test("no sideways scroll at 320 px or at 200% zoom, even with very long lines", async ({
	page,
}, info) => {
	test.skip(info.project.name !== "1280", "sets its own viewport");
	for (const width of [320, 640]) {
		await page.setViewportSize({ width, height: 800 });
		await page.goto("about:blank");
		await routeGitHub(page, longLines());
		await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
		await expect(summary(page)).toBeFocused();
		await page.evaluate(() => document.fonts.ready);
		expect(await horizontalOverflow(page), `${width} px`).toBeLessThanOrEqual(
			0,
		);
		await page.unrouteAll();
	}
});
