import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateRaw, validateText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";

const KEYS = [
	"__proto__",
	"constructor",
	"prototype",
	"kb",
	"app",
	"facts",
	"rules",
	"questions",
	"id",
	"type",
	"set",
	"to",
	"when",
	"clause",
	"label",
	"values",
	"fallback",
	"clauses",
];

const keyArb = fc.oneof(fc.constantFrom(...KEYS), fc.string({ maxLength: 12 }));

const leafArb = fc.oneof(
	fc.constant(null),
	fc.constant(undefined),
	fc.boolean(),
	fc.integer(),
	fc.double(),
	fc.constantFrom(Number.NaN, Infinity, -Infinity, -0),
	fc.string({ maxLength: 40 }),
	fc.string({ minLength: 5000, maxLength: 6000 }),
	fc.bigInt(),
);

// JSON-like values: wrong types, nulls, arrays for objects, __proto__ keys.
const rawArb: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
	node: fc.oneof(
		{ depthSize: "small", withCrossShrink: true },
		leafArb,
		fc.array(tie("node"), { maxLength: 5 }),
		fc.array(fc.tuple(keyArb, tie("node")), { maxLength: 6 }).map((entries) => {
			const o: Record<string, unknown> = {};
			for (const [k, v] of entries) {
				Object.defineProperty(o, k, {
					value: v,
					enumerable: true,
					writable: true,
					configurable: true,
				});
			}
			return o;
		}),
	),
})).node;

function deepNest(depth: number, kind: "array" | "object"): unknown {
	let v: unknown = "x";
	for (let i = 0; i < depth; i++) {
		v = kind === "array" ? [v] : { when: v, to: v };
	}
	return v;
}

function run<T>(fn: () => T): { threw: false; value: T } | { threw: true } {
	try {
		return { threw: false, value: fn() };
	} catch {
		return { threw: true };
	}
}

function expectTotalAndDeterministic<T>(fn: () => T) {
	const a = run(fn);
	expect(a.threw).toBe(false);
	const b = run(fn);
	expect(b.threw).toBe(false);
	if (!a.threw && !b.threw) {
		expect(b.value).toEqual(a.value);
	}
}

describe("Property 1: Validation is total and deterministic", () => {
	// Feature: kb-tools, Property 1: Validation is total and deterministic
	// **Validates: Requirements 17.1, 17.2, 17.6**
	it("validateText never throws on arbitrary strings and is deterministic", () => {
		fc.assert(
			fc.property(
				fc.oneof(
					fc.string({ maxLength: 300 }),
					fc.string({ unit: "binary", maxLength: 300 }),
					fc
						.uint8Array({ maxLength: 200 })
						.map((b) => new TextDecoder("utf-8").decode(b)),
					fc
						.array(
							fc.constantFrom(
								"a: 1",
								"- b",
								"{",
								"[",
								"&x ",
								"*x",
								"!!str ",
								"? ",
								"---",
								"...",
								"__proto__: 1",
								"\t",
								"'",
								'"',
								"|",
								">",
								"#c",
								"kb:",
								"rules:",
								"facts:",
							),
							{ maxLength: 20 },
						)
						.map((parts) => parts.join("\n")),
				),
				(text) => {
					expectTotalAndDeterministic(() => validateText(text, FILE));
				},
			),
			{ numRuns: 200 },
		);
	});

	it("validateRaw never throws on arbitrary JSON-like values and is deterministic", () => {
		fc.assert(
			fc.property(rawArb, (value) => {
				expectTotalAndDeterministic(() => validateRaw(value, FILE));
			}),
			{ numRuns: 200 },
		);
	});

	it("handles very long strings and deep nesting", () => {
		for (const kind of ["array", "object"] as const) {
			for (const depth of [50, 500, 5000]) {
				expectTotalAndDeterministic(() =>
					validateRaw(deepNest(depth, kind), FILE),
				);
			}
		}
		const long = "a".repeat(200_000);
		expectTotalAndDeterministic(() => validateText(long, FILE));
		expectTotalAndDeterministic(() => validateText(`a: ${long}`, FILE));
		expectTotalAndDeterministic(() =>
			validateText("[".repeat(5000) + "]".repeat(5000), FILE),
		);
		expectTotalAndDeterministic(() => validateRaw(long, FILE));
		expectTotalAndDeterministic(() =>
			validateRaw(JSON.parse('{"__proto__":{"rules":[]}}'), FILE),
		);
	});
});
