import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { collect } from "./collect";
import type { StepId } from "./parse";
import {
	fakeFetch,
	json,
	type Reply,
	recorded,
	recordedReplies,
} from "./testing/recorded";
import type { Target } from "./types";
import { requestUrls } from "./urls";

const RUNS = { numRuns: 200 };
const NOW = new Date("2026-11-18T12:00:00Z");
const STEPS: StepId[] = ["metadata", "tree", "gitignore", "readme"];
const REPOS: Target[] = [
	{ owner: "chitrakumarsai", name: "dead-certain" },
	{ owner: "chitrakumarsai", name: "dc-sample-not-ready" },
	{ owner: "chitrakumarsai", name: "dc-sample-warnings" },
];

/** For one step: the recorded reply, a synthetic one, a rejection, or any status and body. */
const replyArb = (step: StepId) =>
	fc.oneof(
		{ weight: 4, arbitrary: fc.constant("recorded" as const) },
		fc.constantFrom<Reply>(
			recorded("synthetic/metadata-404"),
			recorded("synthetic/rate-limit-403"),
			recorded("synthetic/rate-limit-429"),
			recorded("synthetic/forbidden-403"),
			recorded("synthetic/tree-empty-409"),
			recorded("synthetic/tree-truncated"),
			"reject",
			json(200, { unexpected: step }),
		),
		fc
			.record({
				status: fc
					.integer({ min: 100, max: 599 })
					.filter((s) => s !== 101 && s !== 204 && s !== 205 && s !== 304),
				body: fc.oneof(fc.string({ maxLength: 50 }), fc.json({ maxDepth: 3 })),
				remaining: fc.option(fc.constantFrom("0", "1", "x"), {
					nil: undefined,
				}),
			})
			.map(
				({ status, body, remaining }): Reply => ({
					status,
					headers:
						remaining === undefined
							? {}
							: { "x-ratelimit-remaining": remaining },
					body,
				}),
			),
	);

const scenarioArb = fc.record({
	repo: fc.constantFrom(...REPOS),
	choices: fc.tuple(...STEPS.map(replyArb)),
});

async function runScenario(
	repo: Target,
	choices: readonly (Reply | "recorded")[],
) {
	const real = recordedReplies(`${repo.owner}__${repo.name}`);
	const urls = requestUrls(repo, "main");
	const plan = [urls.metadata, urls.tree, urls.gitignore, urls.readme];
	const replies: Record<string, Reply> = {};
	plan.forEach((url, i) => {
		const c = choices[i] ?? "recorded";
		const r = c === "recorded" ? real[url] : c;
		if (r !== undefined) replies[url] = r;
	});
	const fake = fakeFetch(replies);
	const result = await collect(repo, {
		fetch: fake.fetch,
		now: () => NOW,
		onStep: () => {},
	});
	return { plan, fake, result };
}

describe("collect properties", () => {
	it("makes the plan's requests in order, each once, stops at a failure, and repeats itself", async () => {
		// Feature: pre-flight-app, Property 10: Collection is faithful to the recorded responses
		await fc.assert(
			fc.asyncProperty(scenarioArb, async ({ repo, choices }) => {
				const a = await runScenario(repo, choices);
				const urls = a.fake.calls.map((c) => c.url);
				expect(urls).toEqual(a.plan.slice(0, urls.length));
				if (a.result.ok) expect(urls).toHaveLength(4);
				else {
					// The last request made is the step that stopped the run; every later step is not_run.
					const stopped = STEPS[urls.length - 1] as StepId;
					expect(["failed", "not_found"]).toContain(a.result.steps[stopped]);
					for (const later of STEPS.slice(urls.length))
						expect(a.result.steps[later], later).toBe("not_run");
					for (const earlier of STEPS.slice(0, urls.length - 1))
						expect(["done", "not_found"], earlier).toContain(
							a.result.steps[earlier],
						);
				}
				const b = await runScenario(repo, choices);
				expect(b.result).toEqual(a.result);
			}),
			RUNS,
		);
	});

	it("never rejects, and a rate-limit response is never not_found or unreadable", async () => {
		// Feature: pre-flight-app, Property 11: Errors are classified, never thrown
		await fc.assert(
			fc.asyncProperty(scenarioArb, async ({ repo, choices }) => {
				const { result, fake } = await runScenario(repo, choices);
				if (result.ok) return;
				expect([
					"not_found",
					"rate_limited",
					"unreachable",
					"unreadable",
				]).toContain(result.error.kind);
				const lastChoice = choices[fake.calls.length - 1];
				const lastReply = lastChoice === "recorded" ? undefined : lastChoice;
				if (
					typeof lastReply === "object" &&
					(lastReply.status === 429 ||
						(lastReply.status === 403 &&
							lastReply.headers["x-ratelimit-remaining"] === "0"))
				)
					expect(result.error.kind).toBe("rate_limited");
			}),
			RUNS,
		);
	});
});
