import { expect, test } from "./kit-fixtures";
import {
	openPreflight,
	PRE_FLIGHT_URL,
	routeGitHub,
	summary,
	undecidedReplies,
} from "./preflight-helpers";

// No storage, no cookie, no request to any host but api.github.com, no Authorization header (1.5, 1.6).
test("a whole run writes no storage and sends nothing but the four GitHub requests", async ({
	page,
	context,
}) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.addInitScript(() => {
		const log: string[] = [];
		(window as unknown as { __writes: string[] }).__writes = log;
		const setItem = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key: string, value: string) {
			log.push(`storage ${key}`);
			setItem.call(this, key, value);
		};
		const cookie = Object.getOwnPropertyDescriptor(
			Document.prototype,
			"cookie",
		);
		Object.defineProperty(document, "cookie", {
			get: () => cookie?.get?.call(document),
			set: (v: string) => log.push(`cookie ${v}`),
		});
		const open = indexedDB.open.bind(indexedDB);
		indexedDB.open = (name: string, version?: number) => {
			log.push(`indexedDB ${name}`);
			return open(name, version);
		};
	});
	const bad: string[] = [];
	page.on("request", (r) => {
		const url = r.url();
		if (
			!url.startsWith(PRE_FLIGHT_URL) &&
			!url.startsWith("https://api.github.com/")
		)
			bad.push(url);
		if (r.headers().authorization !== undefined)
			bad.push(`Authorization on ${url}`);
	});
	await routeGitHub(page, undecidedReplies());
	await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
	await expect(summary(page)).toBeFocused();
	await page.locator("[data-check]").first().waitFor();
	await page.getByRole("radio", { name: "Yes" }).first().click();
	await page.getByRole("button", { name: /rule R-02\. See why$/ }).click();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Copy report as Markdown" }).click();
	await page.getByRole("button", { name: "Check another repository" }).click();
	await page
		.getByRole("button", { name: "chitrakumarsai/dc-sample-warnings" })
		.click();
	await expect(summary(page)).toBeFocused();

	expect(bad).toEqual([]);
	expect(
		await page.evaluate(
			() => (window as unknown as { __writes: string[] }).__writes,
		),
	).toEqual([]);
	expect(
		await page.evaluate(() => [
			localStorage.length,
			sessionStorage.length,
			document.cookie,
		]),
	).toEqual([0, 0, ""]);
});
