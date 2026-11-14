import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText, validateText } from "./index";
import { renderDoc } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

const RESERVED = new Set([
	"true",
	"false",
	"and",
	"or",
	"not",
	"min",
	"max",
	"round",
	"if",
	"days_between",
	"base",
	"flag",
]);

const PROTO_NAMES = ["toString", "constructor", "prototype", "__proto__"];

/** Ordinary identifiers plus names that live on (or near) Object.prototype. */
const nameArb = fc.oneof(
	{
		weight: 3,
		arbitrary: fc
			.stringMatching(/^[a-z_][a-z0-9_]{0,9}$/)
			.filter((s) => !RESERVED.has(s) && s !== "__proto__"),
	},
	{ weight: 2, arbitrary: fc.constantFrom(...PROTO_NAMES) },
);

/**
 * A base with askable `base` and derived `flag`. `flag` reads `name`. When `defined`,
 * `name` is a second askable number fact; otherwise it is not in `facts`. Maps are built
 * with Object.fromEntries so `__proto__` stays an own key.
 */
function docReading(name: string, defined: boolean): unknown {
	const entries: [string, unknown][] = [
		["base", { type: "number", ask: "What is the base?" }],
		["flag", { type: "boolean", derived: true }],
	];
	if (defined) entries.push([name, { type: "number", ask: "What is it?" }]);
	return {
		id: "demo",
		goals: ["flag"],
		facts: Object.fromEntries(entries),
		rules: [
			{
				id: "R-1",
				cite: "c1",
				set: "flag",
				to: `${name} > 1`,
				because: "Because it is.",
			},
		],
		clauses: { c1: { title: "Clause c1", text: "Text of clause c1." } },
	};
}

function prototypeSnapshot(): string {
	return JSON.stringify([
		Object.getOwnPropertyNames(Object.prototype).sort(),
		Object.getOwnPropertyNames(Array.prototype).sort(),
		Object.getPrototypeOf(Object.prototype),
	]);
}

describe("Property 13: Names are looked up as own properties only", () => {
	// Feature: kb-tools, Property 13: Names are looked up as own properties only
	// **Validates: Requirements 5.9**
	it("reports UNKNOWN_FACT for an undefined name, even one found on Object.prototype", () => {
		fc.assert(
			fc.property(nameArb, (name) => {
				const result = validateText(renderDoc(docReading(name, false)), FILE);
				const unknown = result.diagnostics.filter(
					(d) => d.code === "UNKNOWN_FACT",
				);
				expect(unknown).toHaveLength(1);
				expect(unknown[0]?.message).toContain(name);
				expect(unknown[0]?.file).toBe(FILE);
				expect(result.ok).toBe(false);
			}),
			{ numRuns: 200 },
		);
	});

	it("validates and compiles a defined name and leaves the prototypes unchanged", () => {
		fc.assert(
			fc.property(nameArb, (name) => {
				const before = prototypeSnapshot();
				const text = renderDoc(docReading(name, true));
				const result = validateText(text, FILE);
				expect(
					result.diagnostics.filter((d) => d.severity === "error"),
				).toEqual([]);
				expect(result.ok).toBe(true);
				const compiled = compileText(text, FILE);
				expect(compiled.ok).toBe(true);
				if (compiled.ok) {
					expect(Object.hasOwn(compiled.kb.facts, name)).toBe(true);
					expect(Object.keys(compiled.kb.facts)).toEqual([
						"base",
						"flag",
						name,
					]);
					expect(compiled.json.endsWith("}\n")).toBe(true);
				}
				expect(prototypeSnapshot()).toBe(before);
				expect(({} as Record<string, unknown>).base).toBeUndefined();
			}),
			{ numRuns: 200 },
		);
	});
});
