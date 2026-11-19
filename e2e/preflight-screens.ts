// Every Pre-Flight screen, reached through the interface, for the sweeps of task 20.
import type { Page } from "@playwright/test";
import { expect } from "./kit-fixtures";
import {
	openPreflight,
	type Reply,
	recordedReplies,
	routeGitHub,
	summary,
	undecidedReplies,
} from "./preflight-helpers";

const METADATA = "https://api.github.com/repos/chitrakumarsai/dead-certain";

const live = (replies: Record<string, Reply>) => async (page: Page) => {
	await routeGitHub(page, replies);
	await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
	await expect(summary(page)).toBeFocused();
};

const failing = (reply: Reply | "abort") => async (page: Page) => {
	const replies = recordedReplies("dead-certain");
	if (reply === "abort") delete replies[METADATA];
	else replies[METADATA] = reply;
	await routeGitHub(page, replies);
	await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
	await expect(page.locator("#error-heading")).toBeFocused();
};

const json = { "content-type": "application/json" };

/** A screen, and whether reaching it makes the browser log a failed request. */
export const SCREENS: {
	name: string;
	failsARequest?: true;
	open: (page: Page) => Promise<void>;
}[] = [
	{ name: "start", open: (page) => openPreflight(page) },
	{
		name: "steps",
		open: async (page) => {
			await page.route("https://api.github.com/**", () => {});
			await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
			await expect(page.locator("[data-step=metadata]")).toContainText(
				"Reading",
			);
		},
	},
	{
		name: "report, not ready",
		open: async (page) => {
			await routeGitHub(page, recordedReplies("dc-sample-not-ready"));
			await openPreflight(
				page,
				"#/report?repo=chitrakumarsai/dc-sample-not-ready",
			);
			await expect(summary(page)).toBeFocused();
		},
	},
	{ name: "report, undecided", open: live(undecidedReplies()) },
	{
		name: "report from a sample",
		open: async (page) => {
			await openPreflight(page, "#/report?sample=dc-sample-warnings");
			await expect(summary(page)).toBeFocused();
		},
	},
	{
		name: "x-ray",
		open: async (page) => {
			await live(recordedReplies("dead-certain"))(page);
			await page.getByRole("button", { name: /rule R-08\. See why$/ }).click();
			await expect(page.getByRole("tree", { name: "Proof" })).toBeVisible();
		},
	},
	{
		name: "error: not found",
		failsARequest: true,
		open: failing({ status: 404, headers: json, body: "{}" }),
	},
	{
		name: "error: rate limited",
		failsARequest: true,
		open: failing({
			status: 403,
			headers: {
				...json,
				"x-ratelimit-remaining": "0",
				"x-ratelimit-reset": "1795000000",
			},
			body: "{}",
		}),
	},
	{ name: "error: unreachable", failsARequest: true, open: failing("abort") },
	{
		name: "error: unreadable",
		failsARequest: true,
		open: failing({ status: 500, headers: json, body: "{}" }),
	},
];

/** This repository with a very long path and a very long .gitignore line, for the reflow check. */
export function longLines(): Record<string, Reply> {
	const replies = recordedReplies("dead-certain");
	for (const [url, reply] of Object.entries(replies)) {
		if (url.includes("/git/trees/")) {
			const tree = JSON.parse(reply.body) as {
				tree: { path: string; type: string }[];
			};
			tree.tree.push({
				path: `apps/${"very-long-directory-name-".repeat(12)}end`,
				type: "tree",
			});
			replies[url] = { ...reply, body: JSON.stringify(tree) };
		}
		if (url.endsWith("/.gitignore"))
			replies[url] = {
				...reply,
				body: `${reply.body}\n${"a-very-long-ignored-path-segment/".repeat(10)}.kiro/\n`,
			};
	}
	return replies;
}
