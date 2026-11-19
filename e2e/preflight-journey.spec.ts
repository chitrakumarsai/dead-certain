// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./kit-fixtures";
import {
	openPreflight,
	recordedReplies,
	routeGitHub,
	summary,
} from "./preflight-helpers";
import { type CheckFixture, readChecks } from "./preflight-journey-read";

interface Fixture {
	repo: string;
	state: string;
	sentence: string;
	checks: CheckFixture[];
}

async function expectReport(page: Page, f: Fixture) {
	await expect(summary(page)).toBeFocused();
	await expect(summary(page).locator("[data-state-word]")).toHaveText(f.state);
	await expect(summary(page).locator("[data-statement]")).toHaveText(
		f.sentence,
	);
	expect(await readChecks(page)).toEqual(f.checks);
}

for (const id of [
	"dead-certain",
	"dc-sample-not-ready",
	"dc-sample-warnings",
]) {
	const fixture = JSON.parse(
		readFileSync(
			new URL(`fixtures/preflight-${id}.json`, import.meta.url),
			"utf8",
		) as string,
	) as Fixture;

	test(`${id}: a live run and its sample give the approved report (13.1 to 13.4)`, async ({
		page,
	}) => {
		const base = `https://api.github.com/repos/${fixture.repo}`;
		const sent: { url: string; auth: string | undefined }[] = [];
		page.on("request", (r) => {
			if (r.url().startsWith("https://api.github.com/"))
				sent.push({ url: r.url(), auth: r.headers().authorization });
		});
		await routeGitHub(page, recordedReplies(id));
		await openPreflight(page);
		await page
			.getByRole("textbox", { name: "Repository", exact: true })
			.fill(fixture.repo);
		await page.getByRole("button", { name: "Run the checks" }).click();
		await expectReport(page, fixture);
		expect(sent.map((s) => s.url)).toEqual([
			base,
			`${base}/git/trees/main?recursive=1`,
			`${base}/contents/.gitignore`,
			`${base}/readme`,
		]);
		expect(sent.every((s) => s.auth === undefined)).toBe(true);

		await page
			.getByRole("button", { name: "Check another repository" })
			.click();
		await page.getByRole("button", { name: fixture.repo, exact: true }).click();
		await expectReport(page, fixture);
		expect(sent).toHaveLength(4);
	});
}
