import { expect, test } from "./kit-fixtures";

// A knowledge base that fails the shape check: the notice, and the rest of the
// page still there (requirements 1.4, 8.5). The compiled JSON is inlined in a
// JS chunk, so the route empties its goals there.
test("a broken knowledge base shows the notice and keeps the page", async ({
	page,
}) => {
	let replaced = false;
	await page.route("**/assets/*.js", async (route) => {
		const response = await route.fetch();
		const body = await response.text();
		const broken = body.replace(/goals:\[[^\]]*\]/, "goals:[]");
		replaced ||= broken !== body;
		await route.fulfill({ response, body: broken });
	});
	await page.goto("./");
	expect(replaced, "found the knowledge base in a chunk").toBe(true);
	await expect(
		page.getByRole("heading", {
			name: "The sample verdict could not be loaded. Reload the page, or open Claim Check to see a verdict.",
		}),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "See why" })).toHaveCount(0);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"LLMs guess. The dead are certain.",
	);
	for (const name of [
		"From rulebook to verdict",
		"Two apps on the same engine",
		"Build a third app",
	])
		await expect(page.getByRole("heading", { name })).toBeVisible();
	await expect(page.getByRole("contentinfo")).toHaveText(
		"No guesses were made in the production of this verdict.",
	);
});
