import { PRE_FLIGHT_URL } from "../playwright.config";
import { test } from "./kit-fixtures";

/**
 * Screenshots for the gate pull request, not assertions: the Pre-Flight
 * screens at each project's width, saved to evidence/<project>/ beside the
 * kit's and Claim Check's. Screens join this list as their tasks land.
 */
const SCREENS = [{ name: "start", hash: "" }];

for (const screen of SCREENS) {
	test(`evidence: Pre-Flight ${screen.name}`, async ({ page }, info) => {
		test.skip(
			info.project.name === "reduced-motion",
			"no motion on this screen yet",
		);
		await page.goto(`${PRE_FLIGHT_URL}${screen.hash}`);
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({
			path: `evidence/${info.project.name}/preflight-${screen.name}.png`,
			fullPage: true,
		});
	});
}
