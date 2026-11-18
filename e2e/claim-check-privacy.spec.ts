import { answerInUi, REDUCED } from "./claim-check-engine";
import { CLAIM_CHECK_URL, startCheck } from "./claim-check-helpers";
import { expect, test } from "./kit-fixtures";

// The answers stay in the browser: no request after load and no storage (1.4, 1.5, 10.8).
test("a whole run makes no request after load and writes no storage", async ({
	page,
}) => {
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
	const requests: string[] = [];
	let loaded = false;
	page.on("request", (r) => {
		const url = r.url();
		// Before load the page fetches its own files; after load only its own
		// on-demand files (the develop chunk, fonts) may come, never another origin.
		const own = url.startsWith(`${CLAIM_CHECK_URL}assets/`);
		if (!url.startsWith(new URL(CLAIM_CHECK_URL).origin) || (loaded && !own))
			requests.push(url);
	});

	await startCheck(page);
	loaded = true;
	await answerInUi(page, REDUCED);
	await page.getByRole("button", { name: "See why", exact: true }).click();
	await expect(page.getByRole("tree", { name: "Proof" })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.evaluate(() => {
		location.hash = "#/rulebook";
	});
	await expect(
		page.getByRole("heading", { level: 1, name: "The sample policy" }),
	).toBeVisible();

	expect(requests).toEqual([]);
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
