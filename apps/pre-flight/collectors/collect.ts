import {
	type Classified,
	type CollectError,
	classify,
	parseFile,
	parseMetadata,
	parseTree,
	type RawResponse,
	type StepId,
} from "./parse";
import type { RepoSnapshot, Target } from "./types";
import { requestUrls } from "./urls";

export type { StepId };
export type StepStatus =
	| "waiting"
	| "reading"
	| "done"
	| "not_found"
	| "failed"
	| "not_run";
export type StepEvent =
	| { step: StepId; status: "reading" }
	| { step: StepId; status: "done" | "not_found" | "failed" };

export interface CollectDeps {
	/** Injected; collect never reads the global fetch. */
	fetch: typeof fetch;
	now: () => Date;
	/** Real progress only. */
	onStep: (event: StepEvent) => void;
	timeoutMs?: number;
}

export type CollectResult =
	| { ok: true; snapshot: RepoSnapshot }
	| { ok: false; error: CollectError; steps: Record<StepId, StepStatus> };

const STEPS: readonly StepId[] = ["metadata", "tree", "gitignore", "readme"];
const JSON_ACCEPT = "application/vnd.github+json";
const RAW_ACCEPT = "application/vnd.github.raw+json";
const README = /^readme(\.[^/]*)?$/i;

/** Thrown inside collect only, and always caught there. */
class Stop {
	constructor(readonly error: CollectError) {}
}

/** One request with its own timeout. A fetch that ignores the abort still loses the race. */
async function send(
	deps: CollectDeps,
	url: string,
	accept: string,
): Promise<RawResponse> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			reject(new Stop({ kind: "unreachable" }));
		}, deps.timeoutMs ?? 10_000);
	});
	try {
		return await Promise.race([
			(async () => {
				const res = await deps.fetch(url, {
					headers: { Accept: accept, "X-GitHub-Api-Version": "2022-11-28" },
					credentials: "omit",
					cache: "no-store",
					signal: controller.signal,
				});
				const headers: Record<string, string> = {};
				res.headers.forEach((value, name) => {
					headers[name.toLowerCase()] = value;
				});
				return { status: res.status, headers, body: await res.text() };
			})(),
			timeout,
		]);
	} catch (e) {
		throw e instanceof Stop ? e : new Stop({ kind: "unreachable" });
	} finally {
		clearTimeout(timer);
	}
}

const nonNegativeInt = (v: string | undefined): number | undefined =>
	v !== undefined && /^\d+$/.test(v.trim()) ? Number(v.trim()) : undefined;

/** The four requests of requirement 3, one after another, stopping at the first failure. */
export async function collect(
	target: Target,
	deps: CollectDeps,
): Promise<CollectResult> {
	const steps = Object.fromEntries(STEPS.map((s) => [s, "waiting"])) as Record<
		StepId,
		StepStatus
	>;
	const finish = (step: StepId, status: "done" | "not_found" | "failed") => {
		steps[step] = status;
		deps.onStep({ step, status });
	};
	let last: RawResponse | undefined;
	let current: StepId = "metadata";

	/** Requests one step and classifies it; a failure stops the run. */
	const step = async (
		id: StepId,
		url: string,
		accept: string,
	): Promise<[Classified, RawResponse]> => {
		current = id;
		steps[id] = "reading";
		deps.onStep({ step: id, status: "reading" });
		const res = await send(deps, url, accept);
		last = res;
		const c = classify(id, res, deps.now());
		if (
			c.kind === "not_found" ||
			c.kind === "rate_limited" ||
			c.kind === "unreadable" ||
			c.kind === "unreachable"
		)
			throw new Stop(c);
		return [c, res];
	};
	const unreadable = () => new Stop({ kind: "unreadable" });

	try {
		const first = requestUrls(target, "");
		const [, metaRes] = await step("metadata", first.metadata, JSON_ACCEPT);
		const metadata = parseMetadata(metaRes.body);
		if (metadata === null) throw unreadable();
		// A private repository answers 404 without a token; a body that says private is treated the same.
		if (metadata.private) throw new Stop({ kind: "not_found" });
		finish("metadata", "done");

		const urls = requestUrls(target, metadata.defaultBranch);
		const [treeKind, treeRes] = await step("tree", urls.tree, JSON_ACCEPT);
		let tree: RepoSnapshot["tree"] = {
			entries: [],
			truncated: false,
			empty: treeKind.kind === "empty",
		};
		if (treeKind.kind === "ok") {
			const parsed = parseTree(treeRes.body);
			if (parsed === null) throw unreadable();
			tree = { ...parsed, empty: false };
		}
		finish("tree", "done");

		const [ignoreKind, ignoreRes] = await step(
			"gitignore",
			urls.gitignore,
			RAW_ACCEPT,
		);
		const gitignore =
			ignoreKind.kind === "ok" ? parseFile(ignoreRes.body) : null;
		finish("gitignore", gitignore === null ? "not_found" : "done");

		const [readmeKind, readmeRes] = await step(
			"readme",
			urls.readme,
			RAW_ACCEPT,
		);
		// A raw README carries no file name; the root entry of the tree gives it.
		const name =
			tree.entries.find((e) => e.type === "blob" && README.test(e.path))
				?.path ?? "README";
		const readme =
			readmeKind.kind === "ok" ? { ...parseFile(readmeRes.body), name } : null;
		finish("readme", readme === null ? "not_found" : "done");

		const remaining = nonNegativeInt(last?.headers["x-ratelimit-remaining"]);
		const resetAt = nonNegativeInt(last?.headers["x-ratelimit-reset"]);
		const snapshot: RepoSnapshot = {
			version: 1,
			target,
			takenAt: deps.now().toISOString(),
			metadata,
			tree,
			gitignore,
			readme,
			...(remaining === undefined || resetAt === undefined
				? {}
				: { rate: { remaining, resetAt } }),
		};
		return { ok: true, snapshot };
	} catch (e) {
		const error: CollectError =
			e instanceof Stop ? e.error : { kind: "unreadable" };
		finish(current, error.kind === "not_found" ? "not_found" : "failed");
		for (const s of STEPS) if (steps[s] === "waiting") steps[s] = "not_run";
		return { ok: false, error, steps };
	}
}
