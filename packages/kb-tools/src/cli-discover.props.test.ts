import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { discover } from "./cli/discover";
import { runCli } from "./index";
import { memoryHost, treeArb } from "./testkit";

// Feature: kb-tools, Property 22: Discovery finds exactly the matching files

const SUMMARY = /^(\d+) files checked, (\d+) errors, (\d+) warnings$/;

describe("Property 22: discovery finds exactly the matching files", () => {
	/**
	 * **Validates: Requirements 16.1, 16.9**
	 */
	it("checks exactly apps/<app>/kb/<name>.yaml, whatever order the host lists directories in", () => {
		fc.assert(
			fc.property(
				treeArb,
				fc.integer({ min: 0, max: 0xffffffff }),
				(tree, seed) => {
					const sortedHost = memoryHost(tree);
					const shuffledHost = memoryHost(tree, { shuffleSeed: seed });

					// Discovery returns exactly the matching files, in sorted order.
					const found = discover([], shuffledHost);
					expect(found.ok).toBe(true);
					if (found.ok) expect(found.files).toEqual(tree.kbFiles);

					const a = runCli(["validate"], sortedHost);
					const b = runCli(["validate"], shuffledHost);

					// The output does not depend on the listing order.
					expect(b.stdout).toBe(a.stdout);
					expect(b.exitCode).toBe(a.exitCode);

					// The run checked exactly the matching files.
					const lines = a.stdout.replace(/\n$/, "").split("\n");
					const match = SUMMARY.exec(lines[lines.length - 1] ?? "");
					expect(match).not.toBeNull();
					expect(Number(match?.[1])).toBe(tree.kbFiles.length);

					// Every diagnostic names a discovered file, and files appear in sorted order.
					const named = lines
						.slice(0, -1)
						.map((l) => l.slice(0, l.indexOf(": ")));
					for (const file of named) expect(tree.kbFiles).toContain(file);
					const indexes = named.map((f) => tree.kbFiles.indexOf(f));
					expect(indexes).toEqual([...indexes].sort((x, y) => x - y));
				},
			),
			{ numRuns: 100 },
		);
	});
});
