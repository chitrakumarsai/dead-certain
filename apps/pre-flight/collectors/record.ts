// Records the four GitHub REST responses for each bundled target into
// collectors/recorded/<owner>__<name>/<step>.json (design: "Recorded responses").
// Run by hand with `pnpm record:snapshots`: 12 unauthenticated requests, no token,
// no cookies. Re-run it when this repo's .gitignore or .kiro changes.
// Self-contained so Node 22 can run it with --experimental-strip-types.
// @ts-expect-error TS2591: no type definitions for node:fs
import { mkdirSync, writeFileSync } from "node:fs";

export const TARGETS = [
	"chitrakumarsai/dead-certain",
	"chitrakumarsai/dc-sample-not-ready",
	"chitrakumarsai/dc-sample-warnings",
] as const;

/** The only headers kept; etag and everything else are dropped. */
export const KEPT_HEADERS = [
	"content-type",
	"x-ratelimit-limit",
	"x-ratelimit-remaining",
	"x-ratelimit-reset",
	"retry-after",
] as const;

const API = "https://api.github.com";
const JSON_ACCEPT = "application/vnd.github+json";
const RAW_ACCEPT = "application/vnd.github.raw+json";
const OUT = new URL("./recorded/", import.meta.url);

export interface Recorded {
	url: string;
	status: number;
	headers: Record<string, string>;
	body: unknown;
	/** ISO time of the request (requirement 12.7). */
	recordedAt: string;
	synthetic?: true;
}

/** True when a body looks like it carries a credential: "token" then a long value. */
export const looksLikeCredential = (text: string): boolean =>
	/token["']?\s*[:=]\s*["']?[A-Za-z0-9_\-.]{21,}/i.test(text);

async function request(url: string, accept: string): Promise<Recorded> {
	const recordedAt = new Date().toISOString();
	const response = await fetch(url, {
		headers: { Accept: accept, "X-GitHub-Api-Version": "2022-11-28" },
		credentials: "omit",
		cache: "no-store",
		signal: AbortSignal.timeout(15_000),
	});
	const text = await response.text();
	if (looksLikeCredential(text))
		throw new Error(`${url}: the body looks like it holds a credential`);
	const headers: Record<string, string> = {};
	for (const name of KEPT_HEADERS) {
		const value = response.headers.get(name);
		if (value !== null) headers[name] = value;
	}
	let body: unknown = text;
	if (
		(headers["content-type"] ?? "").includes("json") &&
		accept === JSON_ACCEPT
	)
		body = JSON.parse(text);
	return { url, status: response.status, headers, body, recordedAt };
}

async function record(target: string): Promise<void> {
	const base = `${API}/repos/${target}`;
	const metadata = await request(base, JSON_ACCEPT);
	if (metadata.status !== 200)
		throw new Error(`${target}: metadata ${metadata.status}`);
	const branch = (metadata.body as { default_branch?: unknown }).default_branch;
	if (typeof branch !== "string")
		throw new Error(`${target}: no default_branch`);
	const steps: Record<string, Recorded> = {
		metadata,
		tree: await request(
			`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
			JSON_ACCEPT,
		),
		gitignore: await request(`${base}/contents/.gitignore`, RAW_ACCEPT),
		readme: await request(`${base}/readme`, RAW_ACCEPT),
	};
	const dir = new URL(`${target.replace("/", "__")}/`, OUT);
	mkdirSync(dir, { recursive: true });
	for (const [step, data] of Object.entries(steps))
		writeFileSync(
			new URL(`${step}.json`, dir),
			`${JSON.stringify(data, null, "\t")}\n`,
		);
	const left = steps.readme?.headers["x-ratelimit-remaining"] ?? "?";
	console.info(
		`${target}: ${Object.values(steps)
			.map((s) => s.status)
			.join(" ")} (${left} requests left this hour)`,
	);
}

if (
	import.meta.url ===
	`file://${(globalThis as { process?: { argv: string[] } }).process?.argv[1]}`
) {
	for (const target of TARGETS) await record(target);
}
