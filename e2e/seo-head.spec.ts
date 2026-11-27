import { expect, test } from "@playwright/test";
import { PAGES, type PageKey } from "../packages/ui/src/site";
import { CLAIM_CHECK_URL, PRE_FLIGHT_URL } from "../playwright.config";

// seo requirements 3.3 and 4: after the scripts run, each page's head holds each
// tag once, and the start screens keep the title the build wrote.
const PAGE_URLS: [PageKey, string][] = [
	["home", "./"],
	["claimCheck", CLAIM_CHECK_URL],
	["preFlight", PRE_FLIGHT_URL],
	["kit", "./kit/"],
	["notFound", "./404.html"],
];

for (const [key, url] of PAGE_URLS)
	test(`${key}: one of each head tag, and the built title after load`, async ({
		page,
	}) => {
		await page.goto(url);
		await expect(page.locator("#root")).not.toBeEmpty();
		const count = (selector: string) =>
			page.locator(`head ${selector}`).count();

		expect(await count("title")).toBe(1);
		expect(await count('meta[name="description"]')).toBe(1);
		expect(await count('meta[name="robots"]')).toBe(1);
		expect(await count('meta[name="theme-color"]')).toBe(2);
		expect(await count('link[rel="icon"]')).toBe(1);
		expect(await count('link[rel="apple-touch-icon"]')).toBe(1);
		const index = PAGES[key].index;
		expect(await count('meta[property="og:image"]')).toBe(index ? 1 : 0);
		expect(await count('link[rel="canonical"]')).toBe(index ? 1 : 0);
		expect(await count('meta[property="og:title"]')).toBe(index ? 1 : 0);
		expect(await count('script[type="application/ld+json"]')).toBe(
			key === "kit" || key === "notFound" ? 0 : 1,
		);
		// The kit's screen fixture renames its tab; the indexable start screens must not.
		if (index) await expect(page).toHaveTitle(PAGES[key].title);
	});
