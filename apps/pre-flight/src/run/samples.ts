// The bundled samples (requirement 9). A sample is built on demand from the
// committed recorded responses by running the collector over them with a
// replay fetch, so it makes no request and matches a live run of the same
// responses exactly. The files load lazily, in their own chunk.
import { collect } from "../../collectors/collect";
import type { RepoSnapshot, Target } from "../../collectors/types";

export interface Sample {
	id: string;
	target: Target;
}

const OWNER = "chitrakumarsai";
export const SAMPLES: readonly Sample[] = [
	"dead-certain",
	"dc-sample-not-ready",
	"dc-sample-warnings",
].map((name) => ({ id: name, target: { owner: OWNER, name } }));

const FILES = import.meta.glob<{ default: unknown }>(
	"../../collectors/recorded/chitrakumarsai__*/*.json",
);

interface RecordedFile {
	url: string;
	status: number;
	headers: Record<string, string>;
	body: unknown;
	recordedAt: string;
}

/** A sample's snapshot, or undefined for an unknown id. */
export async function loadSample(
	id: string,
): Promise<RepoSnapshot | undefined> {
	const sample = SAMPLES.find((s) => s.id === id);
	if (sample === undefined) return undefined;
	const dir = `../../collectors/recorded/${OWNER}__${id}/`;
	const files = await Promise.all(
		["metadata", "tree", "gitignore", "readme"].map(async (step) => {
			const load = FILES[`${dir}${step}.json`];
			if (load === undefined) throw new Error(`sample ${id} has no ${step}`);
			return (await load()).default as RecordedFile;
		}),
	);
	const byUrl = new Map(files.map((f) => [f.url, f]));
	const replay = (input: RequestInfo | URL): Promise<Response> => {
		const f = byUrl.get(String(input));
		if (f === undefined) return Promise.reject(new TypeError("not recorded"));
		const body = typeof f.body === "string" ? f.body : JSON.stringify(f.body);
		return Promise.resolve(
			new Response(body, { status: f.status, headers: f.headers }),
		);
	};
	const takenAt = new Date(files[0]?.recordedAt ?? 0);
	const result = await collect(sample.target, {
		fetch: replay as typeof fetch,
		now: () => takenAt,
		onStep: () => {},
	});
	return result.ok ? result.snapshot : undefined;
}
