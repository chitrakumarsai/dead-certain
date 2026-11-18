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
