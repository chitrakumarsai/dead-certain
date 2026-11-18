import { SCREENS } from "./claim-check-screens";
import { expect, test } from "./kit-fixtures";

/**
 * Screenshots for the gate pull request, not assertions: the Claim Check
 * screens at each project's width, saved to evidence/<project>/ beside the
 * kit's. The reduced-motion project shoots the X-ray only.
 */
const SHOWN = ["start", "enum question", "verdict", "x-ray", "rulebook"];

for (const screen of SCREENS.filter((s) => SHOWN.includes(s.name))) {
	test(`evidence: ${screen.name}`, async ({ page }, info) => {
		const project = info.project.name;
		test.skip(
			project === "reduced-motion" && screen.name !== "x-ray",
			"reduced motion changes only the X-ray",
		);
		await screen.open(page);
		await page.evaluate(() => document.fonts.ready);
		const line = page.locator("[data-scan-line]");
		if ((await line.count()) > 0)
			await expect(line).toHaveClass(/\binvisible\b/);
		await page.screenshot({
			path: `evidence/${project}/claim-check-${screen.name.replace(/ /g, "-")}.png`,
			fullPage: true,
		});
	});
}
