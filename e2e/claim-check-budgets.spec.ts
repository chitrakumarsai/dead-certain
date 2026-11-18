// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:zlib
import { gzipSync } from "node:zlib";
import { SCREENS } from "./claim-check-screens";
import { expect, test } from "./kit-fixtures";

const KB = 1024;
const ASSETS = new URL("../apps/claim-check/dist/assets/", import.meta.url);

// The built app sends under 200 kB of gzipped JavaScript, not counting the
// develop chunk, which loads only when an X-ray opens (13.7).
test("the app's JavaScript is under 200 kB gzipped", async () => {
	const info = test.info();
	test.skip(info.project.name !== "1280", "reads the build once");
	const sizes = (readdirSync(ASSETS) as string[])
		.filter((f) => f.endsWith(".js"))
		.map((f) => ({
			file: f,
			gzipped: (gzipSync(readFileSync(new URL(f, ASSETS))) as Uint8Array)
				.length,
		}));
	const develop = sizes.filter((s) => s.file.startsWith("xrayDevelop"));
	const app = sizes.filter((s) => !s.file.startsWith("xrayDevelop"));
	const total = app.reduce((n, s) => n + s.gzipped, 0);
	const report = `app ${(total / KB).toFixed(1)} kB, develop chunk ${(develop.reduce((n, s) => n + s.gzipped, 0) / KB).toFixed(1)} kB (gzipped)`;
	info.annotations.push({ type: "bundle", description: report });
	console.info(report);
	expect(develop.length, "the develop chunk is split out").toBe(1);
	expect(total, report).toBeLessThan(200 * KB);
});

// No screen shifts its layout by 0.05 or more (13.8).
for (const screen of SCREENS) {
	test(`${screen.name}: layout shift below 0.05`, async ({ page }) => {
		await page.addInitScript(() => {
			const w = window as unknown as { __cls: number };
			w.__cls = 0;
			new PerformanceObserver((list) => {
				for (const e of list.getEntries() as unknown as {
					value: number;
					hadRecentInput: boolean;
				}[])
					if (!e.hadRecentInput) w.__cls += e.value;
			}).observe({ type: "layout-shift", buffered: true });
		});
		await screen.open(page);
		await page.evaluate(() => document.fonts.ready);
		const cls = await page.evaluate(
			() => (window as unknown as { __cls: number }).__cls,
		);
		expect(cls).toBeLessThan(0.05);
	});
}
