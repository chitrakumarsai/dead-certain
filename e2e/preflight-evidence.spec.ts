import { expect, test } from "./kit-fixtures";
import { openPreflight, summary } from "./preflight-helpers";
import { SCREENS } from "./preflight-screens";

/**
 * Screenshots for the gate pull request, not assertions: every Pre-Flight
 * screen at each project's width, saved to evidence/<project>/ beside the
 * kit's and Claim Check's. The reduced-motion project shoots the X-ray only.
 */
test.use({ consoleAllow: [/^Failed to load resource/] });

const file = (name: string) =>
	`preflight-${name
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/-$/, "")
		.toLowerCase()}.png`;

for (const screen of SCREENS)
	test(`evidence: Pre-Flight ${screen.name}`, async ({ page }, info) => {
		test.skip(
			info.project.name === "reduced-motion" && screen.name !== "x-ray",
			"reduced motion changes only the X-ray",
		);
		await screen.open(page);
		await page.evaluate(() => document.fonts.ready);
		const line = page.locator("[data-scan-line]");
		if ((await line.count()) > 0)
			await expect(line).toHaveClass(/\binvisible\b/);
		await page.screenshot({
			path: `evidence/${info.project.name}/${file(screen.name)}`,
			fullPage: true,
		});
	});

test("evidence: Pre-Flight export by hand", async ({ page }, info) => {
	test.skip(info.project.name === "reduced-motion", "no motion here");
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: () => Promise.reject(new Error("denied")) },
		});
	});
	await openPreflight(page, "#/report?sample=dc-sample-not-ready");
	await expect(summary(page)).toBeFocused();
	await page.getByRole("button", { name: "Copy report as Markdown" }).click();
	await page
		.getByRole("textbox", { name: "Copy this text by hand." })
		.scrollIntoViewIfNeeded();
	await page.screenshot({
		path: `evidence/${info.project.name}/preflight-export.png`,
		fullPage: true,
	});
});
