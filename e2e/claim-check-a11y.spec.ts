import { SCREENS } from "./claim-check-screens";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";
import { horizontalOverflow, smallTargets } from "./sweep";

// Axe, touch targets and reflow on every screen (requirements 13.1 and 13.3).
for (const screen of SCREENS) {
	test(`${screen.name}: no axe violations and every target is at least 44 px`, async ({
		page,
	}) => {
		await screen.open(page);
		await page.evaluate(() => document.fonts.ready);
		await expectNoAxeViolations(page);
		expect(await smallTargets(page)).toEqual([]);
	});

	test(`${screen.name}: no sideways scroll at 320 px or at 200% zoom`, async ({
		page,
	}, info) => {
		test.skip(info.project.name !== "1280", "sets its own viewport");
		// 200% zoom on a 1280 px window lays out at 640 CSS px.
		for (const width of [320, 640]) {
			await page.setViewportSize({ width, height: 800 });
			// A new fragment alone would not reload the app.
			await page.goto("about:blank");
			await screen.open(page);
			await page.evaluate(() => document.fonts.ready);
			expect(await horizontalOverflow(page), `${width} px`).toBeLessThanOrEqual(
				0,
			);
		}
	});
}
