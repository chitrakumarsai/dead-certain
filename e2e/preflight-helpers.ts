// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";
import { PRE_FLIGHT_URL } from "../playwright.config";
import { expect } from "./kit-fixtures";

export { PRE_FLIGHT_URL };

const RECORDED = new URL(
	"../apps/pre-flight/collectors/recorded/",
	import.meta.url,
);

/** The CORS headers GitHub sends, so the page can read the rate-limit headers as it can in production. */
export const GITHUB_CORS = {
	"access-control-allow-origin": "*",
	"access-control-expose-headers":
		"ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset",
};

export interface Reply {
	status: number;
	headers: Record<string, string>;
	body: string;
}

/** The recorded replies of one repository ("dead-certain"), keyed by URL. */
export function recordedReplies(name: string): Record<string, Reply> {
	const dir = new URL(`chitrakumarsai__${name}/`, RECORDED);
	const out: Record<string, Reply> = {};
	for (const file of readdirSync(dir) as string[]) {
		const r = JSON.parse(
			readFileSync(new URL(file, dir), "utf8") as string,
		) as {
			url: string;
			status: number;
			headers: Record<string, string>;
			body: unknown;
		};
		out[r.url] = {
			status: r.status,
			headers: r.headers,
			body: typeof r.body === "string" ? r.body : JSON.stringify(r.body),
		};
	}
	return out;
}

/**
 * Answers api.github.com from `replies` and records each request URL. Any
 * other host, or an unrecorded URL, fails the test (design: End-to-end).
 */
export async function routeGitHub(
	page: Page,
	replies: Record<string, Reply>,
): Promise<string[]> {
	const requests: string[] = [];
	await page.route("https://api.github.com/**", (route: Route) => {
		const url = route.request().url();
		requests.push(url);
		const reply = replies[url];
		if (reply === undefined) return route.abort();
		return route.fulfill({
			status: reply.status,
			headers: { ...reply.headers, ...GITHUB_CORS },
			body: reply.body,
		});
	});
	page.on("request", (r) => {
		const url = r.url();
		expect(
			url.startsWith(PRE_FLIGHT_URL) ||
				url.startsWith("https://api.github.com/"),
			`request to ${url}`,
		).toBe(true);
	});
	return requests;
}

export async function openPreflight(page: Page, hash = ""): Promise<void> {
	await page.goto(`${PRE_FLIGHT_URL}${hash}`);
}

/** The report's summary heading. */
export const summary = (page: Page) => page.locator("#summary h1");

/** This repository as recorded, with R-07 and R-08 passing and the tree truncated, so tree facts are asked. */
export function undecidedReplies(): Record<string, Reply> {
	const replies = recordedReplies("dead-certain");
	for (const [url, reply] of Object.entries(replies)) {
		if (url.includes("/git/trees/")) {
			const tree = JSON.parse(reply.body) as {
				tree: { path: string; type: string }[];
				truncated: boolean;
			};
			tree.tree.push({ path: "apps/pre-flight/package.json", type: "blob" });
			tree.truncated = true;
			replies[url] = { ...reply, body: JSON.stringify(tree) };
		}
		if (url.endsWith("/readme"))
			replies[url] = {
				...reply,
				body: "# dead-certain\n\n## Getting started\n",
			};
	}
	return replies;
}
