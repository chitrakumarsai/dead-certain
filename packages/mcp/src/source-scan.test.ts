/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

// Read through Vite's build-time glob: there are no Node type definitions here.
const sources: Record<string, string> = import.meta.glob("./**/*.ts", {
	eager: true,
	query: "?raw",
	import: "default",
});
const launcher: Record<string, string> = import.meta.glob("../bin/start.mjs", {
	eager: true,
	query: "?raw",
	import: "default",
});

const nonTest = Object.entries(sources).filter(
	([path]) => !path.endsWith(".test.ts") && !path.startsWith("./testkit/"),
);

/** Source with comments blanked out. */
function code(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function offenders(
	pattern: RegExp,
	skip: (path: string) => boolean = () => false,
): string[] {
	return nonTest
		.filter(([path]) => !skip(path))
		.filter(([, text]) => pattern.test(code(text)))
		.map(([path]) => path);
}

describe("source scan of packages/mcp/src (non-test files)", () => {
	it("finds source files to scan", () => {
		expect(nonTest.length).toBeGreaterThan(8);
		expect(Object.keys(launcher)).toEqual(["../bin/start.mjs"]);
	});

	it("never writes to standard output or logs", () => {
		expect(offenders(/\bconsole\.log\b|\bprocess\.stdout\b/)).toEqual([]);
	});

	it("starts no child process, opens no network connection, reads no environment", () => {
		expect(offenders(/child_process/)).toEqual([]);
		expect(offenders(/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/)).toEqual(
			[],
		);
		expect(
			offenders(/from\s+["'](?:node:)?(?:https?|http2|net|tls|dgram|dns)["']/),
		).toEqual([]);
		expect(offenders(/\bprocess\.env\b/)).toEqual([]);
	});

	it("writes no file", () => {
		expect(
			offenders(
				/\b(?:writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rmSync|unlink|rename|createWriteStream)\b/,
			),
		).toEqual([]);
	});

	it("imports node:* in host.ts only (main.ts uses none)", () => {
		const node =
			/from\s+["']node:|\brequire\s*\(\s*["']node:|\bimport\s*\(\s*["']node:/;
		expect(
			offenders(node, (path) => path === "./host.ts" || path === "./main.ts"),
		).toEqual([]);
		expect(
			offenders(node, (path) => path !== "./host.ts" && path !== "./main.ts"),
		).toEqual(["./host.ts"]);
	});

	it("keeps bin/start.mjs as the only file that names child_process", () => {
		const text = Object.values(launcher)[0] ?? "";
		expect(code(text)).toMatch(/child_process/);
		expect(offenders(/child_process/)).toEqual([]);
	});

	it("keeps the dependency list to what requirement 7.4 allows", () => {
		const pkg: Record<string, string> = import.meta.glob("../package.json", {
			eager: true,
			query: "?raw",
			import: "default",
		});
		const parsed = JSON.parse(Object.values(pkg)[0] ?? "{}") as {
			dependencies: Record<string, string>;
		};
		expect(Object.keys(parsed.dependencies).sort()).toEqual([
			"@dead-certain/engine",
			"@dead-certain/kb-tools",
			"@modelcontextprotocol/sdk",
			"zod",
		]);
		for (const [name, version] of Object.entries(parsed.dependencies)) {
			if (!name.startsWith("@dead-certain/"))
				expect(version).toMatch(/^\d+\.\d+\.\d+$/);
		}
	});
});
