import { expect, test } from "./kit-fixtures";
import { escapeFromTree, openLanding, proofTree, seeWhy } from "./site-helpers";

// Only its own host, and no storage or cookie (requirements 1.5, 9.5).
test("the page requests nothing from another host and writes no storage", async ({
	page,
	baseURL,
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
	const origin = new URL(baseURL ?? "").origin;
	const elsewhere: string[] = [];
	page.on("request", (r) => {
		if (!r.url().startsWith(origin)) elsewhere.push(r.url());
	});
	await openLanding(page);
	await seeWhy(page).click();
	await expect(proofTree(page)).toBeVisible();
	await escapeFromTree(page);
	await page.getByRole("button", { name: "Copy command" }).click();
	expect(elsewhere).toEqual([]);
	expect(
		await page.evaluate(
			() => (window as unknown as { __writes: string[] }).__writes,
		),
	).toEqual([]);
});
