// Test-only: snapshots made by running collect over the recorded responses.
import { collect } from "../collect";
import type { RepoSnapshot } from "../types";
import { fakeFetch, recordedReplies } from "./recorded";

export async function recordedSnapshot(name: string): Promise<RepoSnapshot> {
	const result = await collect(
		{ owner: "chitrakumarsai", name },
		{
			fetch: fakeFetch(recordedReplies(`chitrakumarsai__${name}`)).fetch,
			now: () => new Date("2026-11-18T12:00:00Z"),
			onStep: () => {},
		},
	);
	if (!result.ok) throw new Error(`${name}: ${result.error.kind}`);
	return result.snapshot;
}
