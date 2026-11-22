// @ts-expect-error TS2591: no type definitions for node:child_process
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// A Claude Code pull request stays in its lane (requirement 8.3).
const env =
	(globalThis as { process?: { env: Record<string, string | undefined> } })
		.process?.env ?? {};
const base = env.GITHUB_BASE_REF;
const FORBIDDEN = [
	/^packages\/ui\//,
	/^packages\/engine\/src\/types\.ts$/,
	/^apps\/__APP_NAME__\/(kb|rulebook|golden)\//,
	/^\.kiro\//,
];
const git = (...args: string[]): string =>
	execFileSync("git", args, { encoding: "utf8" }) as string;

describe("lanes", () => {
	it.skipIf(!env.CI || !base)(
		"no Claude Code commit in this pull request touches another lane's files",
		() => {
			// Claude Code's commits carry its co-author line; Kiro's merged commits do not.
			const shas = git(
				"log",
				"--no-merges",
				"--format=%H",
				`origin/${base}..HEAD`,
			)
				.split("\n")
				.filter(Boolean)
				.filter((sha) =>
					git("log", "-1", "--format=%B", sha).includes(
						"Co-Authored-By: Claude",
					),
				);
			const crossings = shas.flatMap((sha) =>
				git("diff-tree", "--no-commit-id", "--name-only", "-r", sha)
					.split("\n")
					.filter((file) => FORBIDDEN.some((re) => re.test(file)))
					.map((file) => `${sha.slice(0, 7)} ${file}`),
			);
			expect(crossings).toEqual([]);
		},
	);
});
