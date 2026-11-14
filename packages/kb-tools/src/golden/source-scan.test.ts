/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

// Reads sources through Vite's build-time glob (no Node type definitions here).
const all: Record<string, string> = import.meta.glob("./*.ts", {
	eager: true,
	query: "?raw",
	import: "default",
});

const sources = Object.entries(all).filter(
	([path]) => !path.endsWith(".test.ts"),
);

/** Source with comments blanked out. */
function code(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("the golden loader, checker and runner need no Node API (Requirement 12, criterion 4)", () => {
	it("finds the golden source files", () => {
		expect(sources.map(([path]) => path).sort()).toEqual([
			"./check.ts",
			"./coverage.ts",
			"./index.ts",
			"./load.ts",
			"./model.ts",
			"./run.ts",
			"./schema.ts",
			"./values.ts",
		]);
	});

	it("imports no node: module and no fs, path or process", () => {
		const node =
			/from\s+["'](?:node:[^"']+|fs|path|os|child_process|process|url|util|zlib|crypto)["']|\bprocess\.|\brequire\s*\(/;
		const offenders = sources
			.filter(([, text]) => node.test(code(text)))
			.map(([path]) => path);

		expect(offenders).toEqual([]);
	});

	it("imports no network module, and reads no clock, random source or environment", () => {
		const bad =
			/from\s+["'](?:https?|http2|net|tls|dgram|dns)["']|\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bDate\b|\bMath\.random\b|\bperformance\.now\b/;
		const offenders = sources
			.filter(([, text]) => bad.test(code(text)))
			.map(([path]) => path);

		expect(offenders).toEqual([]);
	});

	it("touches no file: it takes no Host", () => {
		const offenders = sources
			.filter(([, text]) =>
				/\bHost\b|readFile|writeFile|readDir/.test(code(text)),
			)
			.map(([path]) => path);

		expect(offenders).toEqual([]);
	});
});
