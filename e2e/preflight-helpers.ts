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
			headers: { ...reply.headers, "access-control-allow-origin": "*" },
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
