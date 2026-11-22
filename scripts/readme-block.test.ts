// @ts-expect-error TS2591: no type definitions for node:child_process
import { spawnSync } from "node:child_process";
// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { extractBlock } from "./readme-block.ts";

const ROOT = new URL("../", import.meta.url).pathname as string;
const COMMANDS = ["pnpm install", "pnpm new-app my-app", "pnpm install"];
const SECTION = [
	"## Add a third app",
	"",
	"Some words.",
	"",
	"```sh",
	...COMMANDS,
	"```",
	"",
	"### Run it",
	"",
	"```sh",
	"pnpm --filter @dead-certain/my-app dev",
	"```",
].join("\n");

const run = (...args: string[]) =>
	spawnSync(
		"node",
		["--experimental-strip-types", `${ROOT}scripts/readme-block.ts`, ...args],
		{ encoding: "utf8" },
	) as { status: number; stdout: string; stderr: string };

describe("extractBlock", () => {
	it("reads the three commands from the real README", () => {
		expect(extractBlock(fs.readFileSync(`${ROOT}README.md`, "utf8"))).toEqual(
			COMMANDS,
		);
	});

	it("finds the block wherever the section moves", () => {
		const moved = `# Title\n\n## Other\n\n\`\`\`sh\necho no\n\`\`\`\n\n${SECTION}\n\n## Later\n`;
		expect(extractBlock(moved)).toEqual(COMMANDS);
	});

	it("is null with no heading, or no block before the next section", () => {
		expect(extractBlock("# Title\n\n```sh\npnpm install\n```\n")).toBeNull();
		expect(
			extractBlock(
				"## Add a third app\n\nNo block.\n\n## Next\n\n```sh\nx\n```\n",
			),
		).toBeNull();
		expect(extractBlock("## Add a third app\n\n```sh\nunclosed\n")).toBeNull();
	});

	it("reads a README with Windows line endings", () => {
		expect(extractBlock(SECTION.replaceAll("\n", "\r\n"))).toEqual(COMMANDS);
	});
});

describe("readme-block.ts <name>", () => {
	it("prints the commands with my-app replaced", () => {
		const r = run("ci-probe");
		expect(r.status).toBe(0);
		expect(r.stdout).toBe(
			"pnpm install\npnpm new-app ci-probe\npnpm install\n",
		);
	});

	it("refuses a name a shell could misread", () => {
		expect(run("x; rm -rf /").status).toBe(2);
		expect(run().status).toBe(2);
	});
});
