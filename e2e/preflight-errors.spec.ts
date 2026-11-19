// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";
import {
	openPreflight,
	type Reply,
	recordedReplies,
	routeGitHub,
} from "./preflight-helpers";

// The browser logs its own line for each deliberate failing response.
test.use({ consoleAllow: [/^Failed to load resource/] });

const SELF = "chitrakumarsai/dead-certain";
const METADATA = "https://api.github.com/repos/chitrakumarsai/dead-certain";

function synthetic(name: string): Reply {
	const r = JSON.parse(
		readFileSync(
			new URL(
				`../apps/pre-flight/collectors/recorded/synthetic/${name}.json`,
				import.meta.url,
			),
			"utf8",
		) as string,
	) as {
		status: number;
		headers: Record<string, string>;
		body: unknown;
	};
	return { status: r.status, headers: r.headers, body: JSON.stringify(r.body) };
}

async function failWith(page: Page, metadata: Reply | "abort") {
	const replies = recordedReplies("dead-certain");
	if (metadata === "abort") delete replies[METADATA];
	else replies[METADATA] = metadata;
	const requests = await routeGitHub(page, replies);
	await openPreflight(page, `#/report?repo=${SELF}`);
	return requests;
}

const heading = (page: Page) => page.locator("#error-heading");

test("a 404 says private or missing, with Check another repository (8.1)", async ({
	page,
}) => {
	await failWith(page, synthetic("metadata-404"));
	await expect(heading(page)).toHaveText(
		"This repository is private or does not exist. Pre-Flight reads public repositories only.",
	);
	await expect(heading(page)).toBeFocused();
	await expect(page.locator("[data-step=metadata]")).toContainText("Not found");
	await expect(page.locator("[data-step=tree]")).toContainText("Not run");
	await expect(
		page.getByRole("button", { name: "Check another repository" }),
	).toBeVisible();
	await expect(page.locator("main")).not.toContainText("Not Found");
	await expectNoAxeViolations(page);
});

test("a rate limit with a reset time says when, in local time, and offers the samples and this snapshot (8.2, 9.6)", async ({
	page,
}) => {
	const requests = await failWith(page, synthetic("rate-limit-403"));
	await expect(heading(page)).toHaveText(
		"GitHub's limit for this browser is used up.",
	);
	const at = new Date(1795000000 * 1000).toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
	});
	await expect(
		page.getByText(`Try again after ${at}.`, { exact: true }),
	).toBeVisible();
	await expect(page.locator("main")).not.toContainText(
		"API rate limit exceeded",
	);
	const snapshot = page.getByRole("button", {
		name: /^Use the snapshot of chitrakumarsai\/dead-certain taken /,
	});
	await expect(snapshot).toBeVisible();
	await expect(
		page.getByRole("button", { name: "chitrakumarsai/dc-sample-warnings" }),
	).toBeVisible();
	await expectNoAxeViolations(page);
	await page.waitForTimeout(500);
	expect(requests).toHaveLength(1);
	await snapshot.click();
	await expect(
		page.getByText(/^Using a snapshot of chitrakumarsai\/dead-certain taken /),
	).toBeVisible();
	expect(requests).toHaveLength(1);
});

test("a rate limit without a reset time says about an hour (8.3)", async ({
	page,
}) => {
	await failWith(page, {
		status: 403,
		headers: {
			"content-type": "application/json",
			"x-ratelimit-remaining": "0",
		},
		body: "{}",
	});
	await expect(
		page.getByText("Try again in about an hour.", { exact: true }),
	).toBeVisible();
});

test("an unreachable GitHub offers Try again, which runs the collection again (8.6)", async ({
	page,
}) => {
	const requests = await failWith(page, "abort");
	await expect(heading(page)).toHaveText(
		"Pre-Flight could not reach GitHub. Check your connection and try again.",
	);
	await page.waitForTimeout(500);
	expect(requests).toHaveLength(1);
	await page.getByRole("button", { name: "Try again" }).click();
	await expect.poll(() => requests.length).toBe(2);
});

test("a 500 and a body that is not JSON are unreadable (8.7)", async ({
	page,
}) => {
	await failWith(page, {
		status: 500,
		headers: { "content-type": "application/json" },
		body: "{}",
	});
	await expect(heading(page)).toHaveText(
		"GitHub sent a response Pre-Flight could not read. Try again later.",
	);
	await page.goto("about:blank");
	await failWith(page, {
		status: 200,
		headers: { "content-type": "text/html" },
		body: "<html>oops</html>",
	});
	await expect(heading(page)).toHaveText(
		"GitHub sent a response Pre-Flight could not read. Try again later.",
	);
	await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
	await expectNoAxeViolations(page);
});
