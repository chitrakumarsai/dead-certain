import { afterEach, describe, expect, it, vi } from "vitest";
import { collect, type StepEvent } from "./collect";
import { parseTree } from "./parse";
import {
	fakeFetch,
	json,
	type Reply,
	recorded,
	recordedReplies,
} from "./testing/recorded";
import { requestUrls } from "./urls";

const TARGET = { owner: "chitrakumarsai", name: "dead-certain" };
const URLS = requestUrls(TARGET, "main");
const NOW = new Date("2026-11-18T12:00:00Z");
const REPLIES = recordedReplies("chitrakumarsai__dead-certain");

function run(replies: Record<string, Reply>, timeoutMs?: number) {
	const fake = fakeFetch(replies);
	const events: StepEvent[] = [];
	const result = collect(TARGET, {
		fetch: fake.fetch,
		now: () => NOW,
		onStep: (e) => events.push(e),
		...(timeoutMs === undefined ? {} : { timeoutMs }),
	});
	return { fake, events, result };
}

afterEach(() => {
	vi.useRealTimers();
});

describe("collect against the recorded responses of this repository", () => {
	it("makes the four requests of requirement 3, in order, each once", async () => {
		const { fake, result } = run(REPLIES);
		expect((await result).ok).toBe(true);
		expect(fake.calls.map((c) => c.url)).toEqual([
			URLS.metadata,
			URLS.tree,
			URLS.gitignore,
			URLS.readme,
		]);
	});

	it("sends the GitHub media types and version, omits credentials and passes an AbortSignal (3.4, 3.5, 3.12)", async () => {
		const { fake, result } = run(REPLIES);
		await result;
		const accepts = fake.calls.map((c) =>
			new Headers(c.init.headers).get("accept"),
		);
		expect(accepts).toEqual([
			"application/vnd.github+json",
			"application/vnd.github+json",
			"application/vnd.github.raw+json",
			"application/vnd.github.raw+json",
		]);
		for (const { init } of fake.calls) {
			const headers = new Headers(init.headers);
			expect(headers.get("x-github-api-version")).toBe("2022-11-28");
			expect(headers.has("authorization")).toBe(false);
			expect(init.credentials).toBe("omit");
			expect(init.cache).toBe("no-store");
			expect(init.signal).toBeInstanceOf(AbortSignal);
		}
	});

	it("reports reading, then the final status, for each step in order (4.2)", async () => {
		const { events, result } = run(REPLIES);
		await result;
		expect(events).toEqual([
			{ step: "metadata", status: "reading" },
			{ step: "metadata", status: "done" },
			{ step: "tree", status: "reading" },
			{ step: "tree", status: "done" },
			{ step: "gitignore", status: "reading" },
			{ step: "gitignore", status: "done" },
			{ step: "readme", status: "reading" },
			{ step: "readme", status: "done" },
		]);
	});

	it("returns the snapshot: metadata, tree, both files, the README's name, takenAt and the rate (3.13)", async () => {
		const result = await run(REPLIES).result;
		if (!result.ok) throw new Error("expected a snapshot");
		const s = result.snapshot;
		expect(s.version).toBe(1);
		expect(s.target).toEqual(TARGET);
		expect(s.takenAt).toBe(NOW.toISOString());
		expect(s.metadata.fullName).toBe("chitrakumarsai/dead-certain");
		expect(s.tree).toEqual({
			...parseTree(REPLIES[URLS.tree]?.body ?? ""),
			empty: false,
		});
		expect(s.gitignore).toEqual({
			text: REPLIES[URLS.gitignore]?.body,
			clipped: false,
		});
		expect(s.readme).toEqual({
			text: REPLIES[URLS.readme]?.body,
			clipped: false,
			name: "README.md",
		});
		const h = REPLIES[URLS.readme]?.headers ?? {};
		expect(s.rate).toEqual({
			remaining: Number(h["x-ratelimit-remaining"]),
			resetAt: Number(h["x-ratelimit-reset"]),
		});
	});
});

describe("collect when a step does not answer 200", () => {
	it("records a .gitignore and README 404 as absent, not as an error (3.8)", async () => {
		const { events, result } = run({
			...REPLIES,
			[URLS.gitignore]: recorded("synthetic/gitignore-404"),
			[URLS.readme]: recorded("synthetic/readme-404"),
		});
		const r = await result;
		if (!r.ok) throw new Error("expected a snapshot");
		expect(r.snapshot.gitignore).toBeNull();
		expect(r.snapshot.readme).toBeNull();
		expect(
			events.filter((e) => e.status !== "reading").map((e) => e.status),
		).toEqual(["done", "done", "not_found", "not_found"]);
	});

	it("records a tree 409 as an empty repository (3.10)", async () => {
		const r = await run({
			...REPLIES,
			[URLS.tree]: recorded("synthetic/tree-empty-409"),
		}).result;
		if (!r.ok) throw new Error("expected a snapshot");
		expect(r.snapshot.tree).toEqual({
			entries: [],
			truncated: false,
			empty: true,
		});
	});

	it("records a truncated tree as truncated (3.9)", async () => {
		const r = await run({
			...REPLIES,
			[URLS.tree]: recorded("synthetic/tree-truncated"),
		}).result;
		if (!r.ok) throw new Error("expected a snapshot");
		expect(r.snapshot.tree.truncated).toBe(true);
	});

	it("stops at a failing step and leaves the later steps not_run (3.7)", async () => {
		const { fake, events, result } = run({
			...REPLIES,
			[URLS.tree]: recorded("synthetic/rate-limit-403"),
		});
		expect(await result).toEqual({
			ok: false,
			error: { kind: "rate_limited", resetAt: 1795000000 },
			steps: {
				metadata: "done",
				tree: "failed",
				gitignore: "not_run",
				readme: "not_run",
			},
		});
		expect(fake.calls).toHaveLength(2);
		expect(events.at(-1)).toEqual({ step: "tree", status: "failed" });
	});

	it("calls a metadata 404 not_found, and a public: false body not_found too", async () => {
		const missing = await run({
			...REPLIES,
			[URLS.metadata]: recorded("synthetic/metadata-404"),
		}).result;
		expect(missing).toEqual({
			ok: false,
			error: { kind: "not_found" },
			steps: {
				metadata: "not_found",
				tree: "not_run",
				gitignore: "not_run",
				readme: "not_run",
			},
		});
		const meta = JSON.parse(REPLIES[URLS.metadata]?.body ?? "{}");
		const priv = await run({
			...REPLIES,
			[URLS.metadata]: json(200, { ...meta, private: true }),
		}).result;
		expect(priv.ok === false && priv.error).toEqual({ kind: "not_found" });
	});

	it("calls a body that fails a field check unreadable (8.7)", async () => {
		const r = await run({
			...REPLIES,
			[URLS.tree]: json(200, { truncated: "no", tree: [] }),
		}).result;
		expect(r.ok === false && r.error).toEqual({ kind: "unreadable" });
	});

	it("calls a fetch that rejects unreachable (8.6)", async () => {
		const r = await run({ ...REPLIES, [URLS.gitignore]: "reject" }).result;
		expect(r).toEqual({
			ok: false,
			error: { kind: "unreachable" },
			steps: {
				metadata: "done",
				tree: "done",
				gitignore: "failed",
				readme: "not_run",
			},
		});
	});

	it("aborts a request that outlives the timeout and calls it unreachable (3.12)", async () => {
		vi.useFakeTimers();
		const { fake, result } = run(
			{ ...REPLIES, [URLS.metadata]: "hang" },
			10_000,
		);
		let settled = false;
		void result.then(() => {
			settled = true;
		});
		await vi.advanceTimersByTimeAsync(9_999);
		expect(settled).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect((await result).ok === false && (await result)).toMatchObject({
			error: { kind: "unreachable" },
		});
		expect(fake.calls[0]?.init.signal?.aborted).toBe(true);
	});

	it("records a tree 404 as an absent tree: no entries, not empty, step done", async () => {
		const { events, result } = run({ ...REPLIES, [URLS.tree]: json(404, {}) });
		const r = await result;
		if (!r.ok) throw new Error("expected a snapshot");
		expect(r.snapshot.tree).toEqual({
			entries: [],
			truncated: false,
			empty: false,
		});
		expect(events).toContainEqual({ step: "tree", status: "done" });
	});

	it("ends a fetch that ignores the abort signal as unreachable at the timeout", async () => {
		vi.useFakeTimers();
		const deaf: typeof fetch = () => new Promise<Response>(() => {});
		const result = collect(TARGET, {
			fetch: deaf,
			now: () => NOW,
			onStep: () => {},
			timeoutMs: 10_000,
		});
		await vi.advanceTimersByTimeAsync(10_000);
		expect(await result).toMatchObject({
			ok: false,
			error: { kind: "unreachable" },
		});
	});
});
