/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

// Reads sources through Vite's build-time glob (no Node type definitions here).
const all: Record<string, string> = import.meta.glob("./**/*.ts", {
	eager: true,
	query: "?raw",
	import: "default",
});
const engineTypes: Record<string, string> = import.meta.glob(
	"../../engine/src/types.ts",
	{ eager: true, query: "?raw", import: "default" },
);

const HOST_FILES = new Set(["./cli/main.ts", "./cli/host-node.ts"]);

const nonTest = Object.entries(all).filter(
	([path]) => !path.endsWith(".test.ts") && !path.startsWith("./testkit/"),
);

/** Source with comments and string-literal contents blanked out. */
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

describe("source scan of packages/kb-tools/src (non-test files)", () => {
	it("finds source files to scan", () => {
		expect(nonTest.length).toBeGreaterThan(5);
	});

	it("imports no network module", () => {
		const net =
			/from\s+["'](?:node:)?(?:https?|http2|net|tls|dgram|dns)["']|\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/;
		expect(offenders(net)).toEqual([]);
	});

	it("uses no Date, Math.random or process.env outside the host files", () => {
		const nondeterminism = /\bDate\b|\bMath\.random\b|\bprocess\.env\b/;
		expect(offenders(nondeterminism, (p) => HOST_FILES.has(p))).toEqual([]);
	});

	it("imports no Node module outside the host files", () => {
		const node =
			/from\s+["']node:|\brequire\s*\(|from\s+["'](?:fs|path|os|child_process|url|util|crypto|stream|buffer)(?:\/[^"']*)?["']/;
		expect(offenders(node, (p) => HOST_FILES.has(p))).toEqual([]);
	});

	it("imports testkit from no non-test code", () => {
		expect(offenders(/["'][^"']*\btestkit\b[^"']*["']/)).toEqual([]);
	});

	it("re-declares no engine type name", () => {
		const text = Object.values(engineTypes)[0] ?? "";
		const names = [
			...text.matchAll(
				/^export\s+(?:interface|type|const|class|enum)\s+(\w+)/gm,
			),
		].map((m) => m[1] as string);
		expect(names).toContain("KnowledgeBase");
		const found = nonTest.flatMap(([path, src]) =>
			names
				.filter((n) =>
					new RegExp(
						`\\b(?:interface|class|enum|const|let|function)\\s+${n}\\b|\\btype\\s+${n}\\s*[<=]`,
					).test(code(src)),
				)
				.map((n) => `${path}: ${n}`),
		);
		expect(found).toEqual([]);
	});
});
