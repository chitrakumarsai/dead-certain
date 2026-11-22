// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:zlib
import { gzipSync } from "node:zlib";
import { expect, test } from "./kit-fixtures";
import { openLanding } from "./site-helpers";

const KB = 1024;
const DIST = new URL("../apps/site/dist/", import.meta.url);

// The page's own JavaScript, as it loads it, under 200 kB gzipped without the
// develop chunk (requirements 9.1, 9.6).
test("the landing page's JavaScript is under 200 kB gzipped", async ({
	page,
}, info) => {
	test.skip(info.project.name !== "1280", "reads the build once");
	const scripts = new Set<string>();
	page.on("request", (r) => {
		const path = new URL(r.url()).pathname;
		if (path.endsWith(".js")) scripts.add(path.replace("/dead-certain/", ""));
	});
	await openLanding(page);
	await page.waitForLoadState("networkidle");
	const sizes = [...scripts].map((file) => ({
		file,
		gzipped: (gzipSync(readFileSync(new URL(file, DIST))) as Uint8Array).length,
	}));
	const page_ = sizes.filter((s) => !s.file.includes("xrayDevelop"));
	const total = page_.reduce((n, s) => n + s.gzipped, 0);
	const report = `landing page ${(total / KB).toFixed(1)} kB gzipped over ${page_.length} files`;
	info.annotations.push({ type: "bundle", description: report });
	console.info(report);
	expect(total, report).toBeLessThan(200 * KB);
});

// Layout shift under 0.05, fonts included (requirement 9.2).
test("layout shift below 0.05", async ({ page }) => {
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
	await openLanding(page);
	const cls = await page.evaluate(
		() => (window as unknown as { __cls: number }).__cls,
	);
	expect(cls).toBeLessThan(0.05);
});
