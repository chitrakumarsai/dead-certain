import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bodyOf } from "./testkit/body";
import { TOY_KB, workspaceOf } from "./testkit/workspaces";
import { consult } from "./tools/consult";
import { explainFact } from "./tools/explain";
import { validateKbs } from "./tools/validate";

const REFS = ["a/toy", "b/other"];
const { ws, host } = workspaceOf(
	{ "a/toy": TOY_KB, "b/other": TOY_KB },
	{
		"secret.yaml": "id: secret",
		"apps/a/kb/dist/toy.yaml": "id: dist",
		"apps/a/notes.yaml": "id: notes",
		"apps/a/kb/readme.md": "text",
		"apps/c/kb/x.yml": "id: yml",
	},
);
const ALLOWED = new Set([
	"/ws/pnpm-workspace.yaml",
	"/ws/apps/a/kb/toy.yaml",
	"/ws/apps/b/kb/other.yaml",
]);

const pathy = fc
	.array(
		fc.constantFrom(
			"..",
			".",
			"a",
			"b",
			"toy",
			"other",
			"apps",
			"kb",
			"dist",
			"secret",
			"/",
			"\\",
			"%2e%2e",
			"",
			"~",
			"toy.yaml",
			"secret.yaml",
		),
		{ maxLength: 7 },
	)
	.map((parts) => parts.join("/"));

const refArb = fc.oneof(
	pathy,
	fc.string({ maxLength: 30 }),
	fc.string({ unit: "binary", maxLength: 20 }),
	fc.constantFrom(...REFS),
	fc.constantFrom(...REFS).map((r) => `${r}/`),
	fc.constantFrom(...REFS).map((r) => ` ${r}`),
);

describe("mcp-server reach", () => {
	// Feature: mcp-server, Property 6: A KB_Ref reaches only a discovered file
	// **Validates: Requirements 2.8, 6.6, 7.1, 8.6**
	it("reads only discovered KB_Files and pnpm-workspace.yaml, and refuses every other ref", () => {
		let refused = 0;
		fc.assert(
			fc.property(refArb, (ref) => {
				host.reads.length = 0;
				const results = [
					consult(ws, { kb: ref }),
					explainFact(ws, { kb: ref, fact: "payable" }),
					validateKbs(ws, { kb: ref }),
				];
				for (const read of host.reads) expect(ALLOWED.has(read)).toBe(true);
				if (!REFS.includes(ref)) {
					refused++;
					for (const r of results) {
						expect(r.isError).toBe(true);
						expect(bodyOf(r).error.code).toBe("UNKNOWN_KB");
					}
					expect(host.reads).toEqual([]);
				}
			}),
			{ numRuns: 300 },
		);
		expect(refused).toBeGreaterThan(200);
	});
});
