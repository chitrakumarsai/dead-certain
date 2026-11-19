// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:zlib
import { gzipSync } from "node:zlib";
import { expect, test } from "./kit-fixtures";
import { SCREENS } from "./preflight-screens";

const KB = 1024;
const ASSETS = new URL("../apps/pre-flight/dist/assets/", import.meta.url);
const SAMPLE_CHUNK = /^(metadata|tree|gitignore|readme)-/;

// The main bundle stays under 200 kB gzipped (11.7), the develop and sample
// chunks apart; the samples load on demand and weigh under 60 kB (9.5).
test("Pre-Flight's JavaScript budgets", async () => {
	const info = test.info();
	test.skip(info.project.name !== "1280", "reads the build once");
	const sizes = (readdirSync(ASSETS) as string[])
		.filter((f) => f.endsWith(".js"))
		.map((file) => ({
			file,
			gz: (gzipSync(readFileSync(new URL(file, ASSETS))) as Uint8Array).length,
		}));
	const sum = (pick: (f: string) => boolean) =>
		sizes.filter((s) => pick(s.file)).reduce((n, s) => n + s.gz, 0);
	const samples = sum((f) => SAMPLE_CHUNK.test(f));
	const develop = sum((f) => f.startsWith("xrayDevelop"));
	const main = sum(
		(f) => !SAMPLE_CHUNK.test(f) && !f.startsWith("xrayDevelop"),
	);
	const report = `main ${(main / KB).toFixed(1)} kB, develop ${(develop / KB).toFixed(1)} kB, samples ${(samples / KB).toFixed(1)} kB (gzipped)`;
	info.annotations.push({ type: "bundle", description: report });
	console.info(report);
	expect(samples, "the samples are split out").toBeGreaterThan(0);
	expect(samples, report).toBeLessThan(60 * KB);
	expect(main, report).toBeLessThan(200 * KB);
});

test.describe("layout shift", () => {
	test.use({ consoleAllow: [/^Failed to load resource/] });
	// No screen shifts its layout by 0.05 or more (11.8).
	for (const screen of SCREENS)
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
			expect(
				await page.evaluate(
					() => (window as unknown as { __cls: number }).__cls,
				),
			).toBeLessThan(0.05);
		});
});
