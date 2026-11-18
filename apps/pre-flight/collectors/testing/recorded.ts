// Test-only: the recorded and synthetic responses as RawResponse values.
// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import type { RawResponse } from "../parse";

/** "chitrakumarsai__dead-certain/metadata" or "synthetic/rate-limit-403". */
export function recorded(path: string): RawResponse {
	const data = JSON.parse(
		readFileSync(
			new URL(`../recorded/${path}.json`, import.meta.url),
			"utf8",
		) as string,
	) as { status: number; headers: Record<string, string>; body: unknown };
	return {
		status: data.status,
		headers: data.headers,
		body: typeof data.body === "string" ? data.body : JSON.stringify(data.body),
	};
}

export const json = (
	status: number,
	body: unknown,
	headers: Record<string, string> = {},
): RawResponse => ({
	status,
	headers: { "content-type": "application/json; charset=utf-8", ...headers },
	body: JSON.stringify(body),
});

/** What a fake fetch does for one URL: answer, reject, or never settle until aborted. */
export type Reply = RawResponse | "reject" | "hang";

export interface FakeFetch {
	fetch: typeof fetch;
	calls: { url: string; init: RequestInit }[];
}

/** A fetch that replays `replies` by URL and records every call. An unknown URL rejects. */
export function fakeFetch(replies: Readonly<Record<string, Reply>>): FakeFetch {
	const calls: FakeFetch["calls"] = [];
	const fetchFn = (
		input: RequestInfo | URL,
		init: RequestInit = {},
	): Promise<Response> => {
		const url = String(input);
		calls.push({ url, init });
		const reply = replies[url];
		if (reply === undefined || reply === "reject")
			return Promise.reject(new TypeError("Failed to fetch"));
		if (reply === "hang")
			return new Promise((_, reject) =>
				init.signal?.addEventListener("abort", () =>
					reject(new DOMException("aborted", "AbortError")),
				),
			);
		return Promise.resolve(
			new Response(reply.status === 204 ? null : reply.body, {
				status: reply.status,
				headers: reply.headers,
			}),
		);
	};
	return { fetch: fetchFn as typeof fetch, calls };
}

/** The four recorded responses of a bundled repository, keyed by URL. */
export function recordedReplies(dir: string): Record<string, RawResponse> {
	const out: Record<string, RawResponse> = {};
	for (const step of ["metadata", "tree", "gitignore", "readme"]) {
		const raw = JSON.parse(
			readFileSync(
				new URL(`../recorded/${dir}/${step}.json`, import.meta.url),
				"utf8",
			) as string,
		) as { url: string };
		out[raw.url] = recorded(`${dir}/${step}`);
	}
	return out;
}
