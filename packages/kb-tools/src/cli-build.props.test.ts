import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText } from "./compile";
import { runCli } from "./index";
import { memoryHost, treeArb } from "./testkit";

const DIST_PATH = /^\/repo\/apps\/[^/]+\/kb\/dist\/[^/]+\.json$/;

function snapshot(files: Map<string, Uint8Array>): Map<string, string> {
	const out = new Map<string, string>();
	for (const [path, bytes] of files) {
		out.set(path, new TextDecoder().decode(bytes));
	}
	return out;
}

describe("Property 20: build writes", () => {
	it("a failing run writes nothing, a passing run is repeatable, and writes stay inside kb/dist", () => {
		/**
		 * **Validates: Requirements 16.3, 16.4, 16.11, 16.12**
		 */
		fc.assert(
			fc.property(treeArb, (tree) => {
				const host = memoryHost(tree);
				const before = snapshot(host.files);

				const compiled = tree.kbFiles.map((file) => {
					const text = tree.files[file];
					return {
						file,
						result: compileText(String(text), file),
					};
				});
				const anyError = compiled.some((c) => !c.result.ok);

				const first = runCli(["build"], host);

				if (anyError) {
					expect(first.exitCode).toBe(1);
					expect(host.writes).toEqual([]);
					expect(snapshot(host.files)).toEqual(before);
					return;
				}

				expect(first.exitCode).toBe(0);
				const expected = new Map<string, string>();
				for (const { file, result } of compiled) {
					if (!result.ok) continue;
					const m = /^(apps\/[^/]+)\/kb\/([^/]+)\.yaml$/.exec(file);
					expect(m).not.toBeNull();
					expected.set(`/repo/${m?.[1]}/kb/dist/${m?.[2]}.json`, result.json);
				}

				// Exactly one write per KB_File, every one inside kb/dist.
				expect(host.writes.length).toBe(expected.size);
				expect(new Set(host.writes)).toEqual(new Set(expected.keys()));
				for (const path of host.writes) expect(path).toMatch(DIST_PATH);
				for (const [path, json] of expected) {
					expect(host.readText(path)).toBe(json);
				}

				// A second run on the unchanged tree leaves every file byte-identical.
				const afterFirst = snapshot(host.files);
				const second = runCli(["build"], host);
				expect(second.exitCode).toBe(0);
				expect(snapshot(host.files)).toEqual(afterFirst);
				expect(new Set(host.writes)).toEqual(new Set(expected.keys()));
			}),
			{ numRuns: 100 },
		);
	});
});
