import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	classify,
	parseFile,
	parseMetadata,
	parseTree,
	type StepId,
} from "./parse";

const RUNS = { numRuns: 300 };
const NOW = new Date("2026-11-18T12:00:00Z");
const stepArb = fc.constantFrom<StepId>(
	"metadata",
	"tree",
	"gitignore",
	"readme",
);

/** JSON nested deeper than any recursive parser's stack should need to handle. */
const deepJson = fc
	.integer({ min: 1, max: 20_000 })
	.map((n) => `${"[".repeat(n)}${"]".repeat(n)}`);

const bodyArb = fc.oneof(
	fc.string({ unit: "binary", maxLength: 300 }),
	fc.json({ maxDepth: 6 }),
	deepJson,
	fc
		.record(
			{
				full_name: fc.anything(),
				default_branch: fc.anything(),
				private: fc.anything(),
				tree: fc.anything(),
				truncated: fc.anything(),
			},
			{ requiredKeys: [] },
		)
		.map((o) => JSON.stringify(o) ?? "null"),
);

const headerValue = fc.oneof(
	fc.string({ maxLength: 12 }),
	fc.integer({ min: -10, max: 2_000_000_000 }).map(String),
	fc.constant("0"),
);
const headersArb = fc.dictionary(
	fc.constantFrom(
		"x-ratelimit-remaining",
		"x-ratelimit-reset",
		"retry-after",
		"content-type",
	),
	headerValue,
);
const statusArb = fc.oneof(
	fc.integer({ min: 100, max: 599 }),
	fc.constantFrom(200, 403, 404, 409, 429),
);

describe("Property 11 for classify and the parsers", () => {
	it("never throws, and a rate-limit response is never not_found or unreadable", () => {
		// Feature: pre-flight-app, Property 11: Errors are classified, never thrown
		fc.assert(
			fc.property(
				stepArb,
				statusArb,
				headersArb,
				bodyArb,
				(step, status, headers, body) => {
					const result = classify(step, { status, headers, body }, NOW);
					expect([
						"ok",
						"absent",
						"empty",
						"not_found",
						"rate_limited",
						"unreadable",
					]).toContain(result.kind);
					const limited =
						status === 429 ||
						(status === 403 &&
							(headers["x-ratelimit-remaining"]?.trim() === "0" ||
								headers["retry-after"] !== undefined));
					if (limited) expect(result.kind).toBe("rate_limited");
					if (result.kind === "rate_limited" && result.resetAt !== undefined)
						expect(
							Number.isSafeInteger(result.resetAt) && result.resetAt > 0,
						).toBe(true);
					// The parsers answer with a value or null; they never throw.
					parseMetadata(body);
					parseTree(body);
					expect(typeof parseFile(body).clipped).toBe("boolean");
				},
			),
			RUNS,
		);
	});
});
