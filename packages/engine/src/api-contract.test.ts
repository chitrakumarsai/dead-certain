// Requirement 1 (public API surface) and Requirement 23 (zero runtime dependencies).
// Node's fs, path, crypto and url serve this test file only. The repo has no
// @types/node, so the imports are untyped (the same approach as sha256.test.ts).
// @ts-expect-error TS2591: no type definitions for node:crypto
import { createHash } from "node:crypto";
// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:path
import { dirname, join, relative, resolve, sep } from "node:path";
// @ts-expect-error TS2591: no type definitions for node:url
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as engine from "./index";
import type { EngineApi } from "./types";

const SRC = dirname(fileURLToPath(import.meta.url));
const PKG_JSON = join(SRC, "..", "package.json");

function listSourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "testkit" || entry.name === "node_modules") continue;
			out.push(...listSourceFiles(full));
		} else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
			out.push(full);
		}
	}
	return out.sort();
}

/** Remove block and line comments; string contents are kept. */
function stripComments(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const sourceFiles = listSourceFiles(SRC);
const rel = (f: string) => relative(SRC, f).split(sep).join("/");

describe("public exports (Requirement 1.1, 1.3, 1.4)", () => {
	it("exports the eight engine functions", () => {
		for (const name of [
			"start",
			"next",
			"answer",
			"audit",
			"explain",
			"whatIf",
			"encode",
			"decode",
		] as const) {
			expect(typeof (engine as Record<string, unknown>)[name], name).toBe(
				"function",
			);
		}
	});

	it("keeps the rule-language exports and UNKNOWN", () => {
		expect(typeof engine.parse).toBe("function");
		expect(typeof engine.print).toBe("function");
		expect(typeof engine.evaluate).toBe("function");
		expect(typeof engine.UNKNOWN).toBe("symbol");
	});

	it("exports EngineError and its code type", () => {
		expect(typeof engine.EngineError).toBe("function");
		const e = new engine.EngineError("UNKNOWN_FACT", "x");
		expect(e).toBeInstanceOf(Error);
		expectTypeOf<engine.ErrorCode>().toBeString();
	});

	it("has no unexpected value exports", () => {
		expect(Object.keys(engine).sort()).toEqual(
			[
				"EngineError",
				"UNKNOWN",
				"answer",
				"audit",
				"decode",
				"encode",
				"evaluate",
				"explain",
				"next",
				"parse",
				"print",
				"start",
				"whatIf",
			].sort(),
		);
	});
});

describe("EngineApi type check (Requirement 1.2)", () => {
	it("an object of the eight exports satisfies EngineApi", () => {
		const api = {
			start: engine.start,
			next: engine.next,
			answer: engine.answer,
			audit: engine.audit,
			explain: engine.explain,
			whatIf: engine.whatIf,
			encode: engine.encode,
			decode: engine.decode,
		} satisfies EngineApi;
		expectTypeOf(api).toExtend<EngineApi>();
		expect(Object.keys(api)).toHaveLength(8);
	});
});

describe("package.json (Requirements 1.5, 23.1)", () => {
	const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8")) as Record<
		string,
		unknown
	>;

	it("has no dependencies entry", () => {
		expect(Object.hasOwn(pkg, "dependencies")).toBe(false);
	});

	it("pins fast-check to exactly 4.10.2 in devDependencies", () => {
		const dev = pkg.devDependencies as Record<string, string>;
		expect(dev["fast-check"]).toBe("4.10.2");
	});
});

describe("source scan (Requirements 1.6, 1.7)", () => {
	it("finds source files to scan, excluding tests and testkit", () => {
		const names = sourceFiles.map(rel);
		expect(names).toContain("api.ts");
		expect(names).toContain("lang/evaluate.ts");
		expect(names.some((n) => n.includes("testkit/"))).toBe(false);
		expect(names.some((n) => n.endsWith(".test.ts"))).toBe(false);
	});

	const importRe =
		/(?:^|\s)(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']|(?:^|\s)import\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

	function specifiers(code: string): string[] {
		return [...code.matchAll(importRe)].map(
			(m) => (m[1] ?? m[2] ?? m[3] ?? m[4]) as string,
		);
	}

	it("imports only relative paths that stay inside packages/engine/src", () => {
		const bad: string[] = [];
		for (const file of sourceFiles) {
			for (const spec of specifiers(
				stripComments(readFileSync(file, "utf8")),
			)) {
				if (!spec.startsWith("./") && !spec.startsWith("../")) {
					bad.push(`${rel(file)}: non-relative import "${spec}"`);
					continue;
				}
				const target = resolve(dirname(file), spec);
				const inside = relative(SRC, target);
				if (inside.startsWith("..") || resolve(SRC, inside) !== target) {
					bad.push(`${rel(file)}: "${spec}" resolves outside src`);
				}
			}
		}
		expect(bad).toEqual([]);
	});

	const forbidden: Array<[string, RegExp]> = [
		["node: specifier", /["']node:/],
		[
			"Node built-in import",
			/\bfrom\s*["'](?:fs|path|os|util|url|stream|events|child_process|crypto|buffer|assert|http|https|net|zlib|worker_threads|perf_hooks|timers|readline|v8|vm)(?:\/[^"']*)?["']/,
		],
		["process", /\bprocess\b\s*[.[]/],
		["Buffer", /\bBuffer\b/],
		["Date.now", /\bDate\s*\.\s*now\b/],
		["new Date()", /\bnew\s+Date\s*\(\s*\)/],
		["performance", /\bperformance\s*\./],
		["Math.random", /\bMath\s*\.\s*random\b/],
		[
			"crypto global",
			/\bcrypto\s*\.\s*(?:getRandomValues|randomUUID|subtle)\b/,
		],
		["timers", /\b(?:setTimeout|setInterval|setImmediate|queueMicrotask)\b/],
	];

	it("uses no Node-only module or global, clock or random source", () => {
		const hits: string[] = [];
		for (const file of sourceFiles) {
			const code = stripComments(readFileSync(file, "utf8"));
			for (const [label, re] of forbidden) {
				if (re.test(code)) hits.push(`${rel(file)}: ${label}`);
			}
		}
		expect(hits).toEqual([]);
	});
});

describe("types.ts contract (Requirement 23.8)", () => {
	// SHA-256 of types.ts as committed with the rule-language spec, before this spec.
	const RULE_LANGUAGE_SHA256 =
		"b220b1e3900521092217191be25ea662e86640b714d1b8f80155f7143ebffd4b";

	it("differs from the rule-language version only by the label property", () => {
		const text = readFileSync(join(SRC, "types.ts"), "utf8");
		const labelBlock =
			/^[ \t]*\/\*\* Display name for ledger lines\. Falls back to a name derived from the fact\. \*\/\r?\n[ \t]*readonly label\?: string;\r?\n/gm;
		expect(text.match(labelBlock)).toHaveLength(1);
		const withoutLabel = text.replace(labelBlock, "");
		const hash = createHash("sha256").update(withoutLabel).digest("hex");
		expect(hash).toBe(RULE_LANGUAGE_SHA256);
	});
});
