// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./kit-fixtures";
import {
	openPreflight,
	recordedReplies,
	routeGitHub,
	summary,
} from "./preflight-helpers";

const copyButton = (page: Page) =>
	page.getByRole("button", { name: "Copy report as Markdown" });

async function copied(page: Page, context: BrowserContext): Promise<string> {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await copyButton(page).click();
	return page.evaluate(() => navigator.clipboard.readText());
}

for (const id of ["dead-certain", "dc-sample-not-ready", "dc-sample-warnings"])
	test(`${id}: the copied Markdown equals its approved fixture, every time (10.2, 10.4, 10.8)`, async ({
		page,
		context,
	}) => {
		await openPreflight(page, `#/report?sample=${id}`);
		await expect(summary(page)).toBeFocused();
		const expected = readFileSync(
			new URL(`fixtures/preflight-${id}.md`, import.meta.url),
			"utf8",
		) as string;
		expect(await copied(page, context)).toBe(expected);
		expect(await copied(page, context)).toBe(expected);
		await expect(
			page.getByRole("status").or(page.locator("[aria-live=polite]")).first(),
		).toContainText("Report copied");
	});

test("a path with Markdown syntax exports inert, in a code span (10.6, 10.7)", async ({
	page,
	context,
}) => {
	const replies = recordedReplies("dc-sample-warnings");
	const treeUrl = Object.keys(replies).find((u) =>
		u.includes("/git/trees/"),
	) as string;
	const tree = JSON.parse(replies[treeUrl]?.body ?? "{}") as {
		tree: { path: string; type: string }[];
	};
	tree.tree.push({
		path: "apps/# [x](javascript:alert(1)) <b>`",
		type: "tree",
	});
	replies[treeUrl] = {
		...(replies[treeUrl] as {
			status: number;
			headers: Record<string, string>;
			body: string;
		}),
		body: JSON.stringify(tree),
	};
	await routeGitHub(page, replies);
	await openPreflight(page, "#/report?repo=chitrakumarsai/dc-sample-warnings");
	await expect(summary(page)).toBeFocused();
	const md = await copied(page, context);
	const line = md.split("\n").find((l) => l.includes("javascript:"));
	expect(line).toMatch(/^ {2}- ``.*`` *$/);
	expect(md).not.toMatch(/^#+ .*javascript/m);
	expect(md).toContain("Checked with Pre-Flight.");
});

test("a refused clipboard shows the text, selected, to copy by hand (10.3)", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: () => Promise.reject(new Error("denied")) },
		});
	});
	await openPreflight(page, "#/report?sample=dc-sample-warnings");
	await expect(summary(page)).toBeFocused();
	await copyButton(page).click();
	const area = page.getByRole("textbox", { name: "Copy this text by hand." });
	await expect(area).toBeVisible();
	await expect(area).toHaveValue(
		/^# 2 warnings in `chitrakumarsai\/dc-sample-warnings`/,
	);
	expect(
		await area.evaluate(
			(el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart,
		),
	).toBeGreaterThan(0);
});
