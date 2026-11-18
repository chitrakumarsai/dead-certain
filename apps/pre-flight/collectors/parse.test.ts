import { describe, expect, it } from "vitest";
import {
	classify,
	FILE_LIMIT,
	parseFile,
	parseMetadata,
	parseTree,
	TREE_LIMIT,
} from "./parse";
import { json, recorded } from "./testing/recorded";

const SELF = "chitrakumarsai__dead-certain";
const NOW = new Date("2026-11-18T12:00:00Z");
const NOW_S = Math.floor(NOW.getTime() / 1000);
const META = JSON.parse(recorded(`${SELF}/metadata`).body) as Record<
	string,
	unknown
>;

describe("parseMetadata", () => {
	it("reads the recorded metadata of this repository", () => {
		expect(parseMetadata(recorded(`${SELF}/metadata`).body)).toEqual({
			fullName: "chitrakumarsai/dead-certain",
			defaultBranch: "main",
			private: false,
			archived: false,
			description: META.description,
			license: { spdxId: "MIT" },
			size: META.size,
			pushedAt: META.pushed_at,
		});
	});

	it("reads a missing licence as null (dc-sample-not-ready)", () => {
		expect(
			parseMetadata(
				recorded("chitrakumarsai__dc-sample-not-ready/metadata").body,
			)?.license,
		).toBeNull();
	});

	it.each([
		["full_name", 7],
		["default_branch", null],
		["default_branch", ""],
		["default_branch", "\ud800"],
		["private", "false"],
		["archived", 0],
		["description", 42],
		["license", "MIT"],
		["license", { spdx_id: 7 }],
		["size", "12"],
		["size", -1],
		["pushed_at", 5],
	])("gives null for %s = %j (3.18)", (field, value) => {
		expect(
			parseMetadata(JSON.stringify({ ...META, [field]: value })),
		).toBeNull();
	});

	it("gives null for a missing field, a body that is not JSON, and JSON that is not an object", () => {
		const { full_name: _, ...rest } = META;
		expect(parseMetadata(JSON.stringify(rest))).toBeNull();
		expect(parseMetadata("<html>")).toBeNull();
		expect(parseMetadata("[]")).toBeNull();
		expect(parseMetadata("null")).toBeNull();
	});

	it("clips a long description to 500 characters", () => {
		const d = parseMetadata(
			JSON.stringify({ ...META, description: "d".repeat(900) }),
		);
		expect(d?.description).toHaveLength(500);
	});
});

describe("parseTree", () => {
	it("keeps only path and type from the recorded tree", () => {
		const tree = parseTree(recorded(`${SELF}/tree`).body);
		expect(tree?.truncated).toBe(false);
		expect(tree?.entries.length).toBeGreaterThan(100);
		expect(tree?.entries).toContainEqual({ path: ".kiro", type: "tree" });
		for (const entry of tree?.entries ?? [])
			expect(Object.keys(entry)).toEqual(["path", "type"]);
	});

	it("reads truncated: true (3.9)", () => {
		expect(
			parseTree(recorded("synthetic/tree-truncated").body)?.truncated,
		).toBe(true);
	});

	it("skips submodule entries and clips paths to 1,024 characters", () => {
		const tree = parseTree(
			JSON.stringify({
				truncated: false,
				tree: [
					{ path: "lib", type: "commit" },
					{ path: "p".repeat(2000), type: "blob" },
				],
			}),
		);
		expect(tree?.entries).toEqual([{ path: "p".repeat(1024), type: "blob" }]);
	});

	it("keeps the first 100,000 entries and marks a longer tree truncated", () => {
		const tree = parseTree(
			JSON.stringify({
				truncated: false,
				tree: Array.from({ length: TREE_LIMIT + 5 }, (_, i) => ({
					path: `f${i}`,
					type: "blob",
				})),
			}),
		);
		expect(tree?.entries).toHaveLength(TREE_LIMIT);
		expect(tree?.truncated).toBe(true);
	});

	it.each([
		["truncated is not a boolean", { truncated: "no", tree: [] }],
		["tree is not an array", { truncated: false, tree: {} }],
		["an entry has no path", { truncated: false, tree: [{ type: "blob" }] }],
		[
			"a path is not a string",
			{ truncated: false, tree: [{ path: 1, type: "blob" }] },
		],
		[
			"a type is not a string",
			{ truncated: false, tree: [{ path: "a", type: null }] },
		],
	])("gives null when %s (3.18)", (_, body) => {
		expect(parseTree(JSON.stringify(body))).toBeNull();
	});
});

describe("parseFile", () => {
	it("keeps a recorded .gitignore whole", () => {
		const text = recorded(`${SELF}/gitignore`).body;
		expect(parseFile(text)).toEqual({ text, clipped: false });
	});

	it("keeps the first 65,536 bytes and never splits a character (3.11)", () => {
		const big = parseFile("é".repeat(FILE_LIMIT));
		expect(big.clipped).toBe(true);
		expect(new TextEncoder().encode(big.text).length).toBeLessThanOrEqual(
			FILE_LIMIT,
		);
		expect(big.text).toBe("é".repeat(FILE_LIMIT / 2));
		expect(parseFile("a".repeat(FILE_LIMIT))).toEqual({
			text: "a".repeat(FILE_LIMIT),
			clipped: false,
		});
	});
});

describe("classify", () => {
	it("calls a 200 ok, for every step", () => {
		for (const step of ["metadata", "tree", "gitignore", "readme"] as const)
			expect(classify(step, recorded(`${SELF}/${step}`), NOW)).toEqual({
				kind: "ok",
			});
	});

	it("calls a 404 not_found for metadata and absent for the other steps (3.8)", () => {
		expect(
			classify("metadata", recorded("synthetic/metadata-404"), NOW),
		).toEqual({ kind: "not_found" });
		expect(
			classify("gitignore", recorded("synthetic/gitignore-404"), NOW),
		).toEqual({ kind: "absent" });
		expect(classify("readme", recorded("synthetic/readme-404"), NOW)).toEqual({
			kind: "absent",
		});
		expect(classify("tree", json(404, {}), NOW)).toEqual({ kind: "absent" });
	});

	it("calls a tree 409 an empty repository (3.10)", () => {
		expect(classify("tree", recorded("synthetic/tree-empty-409"), NOW)).toEqual(
			{ kind: "empty" },
		);
		expect(classify("metadata", json(409, {}), NOW)).toEqual({
			kind: "unreadable",
		});
	});

	it("reads a 403 with no requests left as rate_limited, reset from the header (8.2)", () => {
		expect(classify("tree", recorded("synthetic/rate-limit-403"), NOW)).toEqual(
			{
				kind: "rate_limited",
				resetAt: 1795000000,
			},
		);
	});

	it("reads a 429 as rate_limited, reset from retry-after (8.2)", () => {
		expect(
			classify("metadata", recorded("synthetic/rate-limit-429"), NOW),
		).toEqual({
			kind: "rate_limited",
			resetAt: NOW_S + 60,
		});
	});

	it("reads a 403 with only retry-after as rate_limited", () => {
		expect(
			classify("readme", json(403, {}, { "retry-after": "30" }), NOW),
		).toEqual({
			kind: "rate_limited",
			resetAt: NOW_S + 30,
		});
	});

	it("leaves resetAt out when neither header gives a time (8.3)", () => {
		expect(classify("metadata", json(429, {}), NOW)).toEqual({
			kind: "rate_limited",
		});
		expect(
			classify(
				"metadata",
				json(
					403,
					{},
					{
						"x-ratelimit-remaining": "0",
						"x-ratelimit-reset": "soon",
						"retry-after": "-5",
					},
				),
				NOW,
			),
		).toEqual({ kind: "rate_limited" });
	});

	it("calls a 403 without rate-limit signs unreadable, not rate_limited (8.7)", () => {
		expect(
			classify("metadata", recorded("synthetic/forbidden-403"), NOW),
		).toEqual({ kind: "unreadable" });
	});

	it("calls any other failing status unreadable (8.7)", () => {
		for (const status of [301, 400, 401, 410, 422, 500, 502, 503])
			expect(classify("tree", json(status, {}), NOW), String(status)).toEqual({
				kind: "unreadable",
			});
	});
});
