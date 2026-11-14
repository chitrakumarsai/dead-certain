import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { loadGolden, loadGoldenRaw } from "./load";

const FILE = "apps/demo/golden/main.yaml";

const KEYS = [
	"__proto__",
	"constructor",
	"kb",
	"scenarios",
	"id",
	"title",
	"mode",
	"facts",
	"expect",
	"goals",
	"line_items",
	"needed",
	"fires",
	"ask",
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
	fc.constant(Symbol("s")),
	fc.constant(() => 1),
);

/** JSON-like values with golden key names: wrong types, nulls, lists for mappings. */
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

/** Golden-shaped values with one random hole, so the deep checks run too. */
const shapedArb: fc.Arbitrary<unknown> = fc
	.tuple(rawArb, rawArb, rawArb, rawArb)
	.map(([facts, goals, extra, title]) => ({
		kb: "demo",
		scenarios: [
			{
				id: "G-01",
				title,
				facts,
				expect: { goals, ...(extra as object) },
			},
		],
	}));

function run<T>(fn: () => T): { threw: false; value: T } | { threw: true } {
	try {
		return { threw: false, value: fn() };
	} catch {
		return { threw: true };
	}
}

describe("Property 7: Total (loader part)", () => {
	// Feature: kb-golden, Property 7: Total
	it("loadGolden never throws on arbitrary strings", () => {
		fc.assert(
			fc.property(
				fc.oneof(
					fc.string({ maxLength: 300 }),
					fc.string({ unit: "binary", maxLength: 300 }),
					fc
						.array(
							fc.constantFrom(
								"kb: x",
								"scenarios:",
								"  - id: a",
								"    title: t",
								"    facts: {}",
								"    expect:",
								"      goals: {}",
								"- b",
								"{",
								"[",
								"&x ",
								"*x",
								"__proto__: 1",
								"\t",
								"'",
								"#c",
							),
							{ maxLength: 20 },
						)
						.map((parts) => parts.join("\n")),
				),
				(text) => {
					expect(run(() => loadGolden(text, FILE)).threw).toBe(false);
				},
			),
			{ numRuns: 200 },
		);
	});

	it("loadGoldenRaw never throws on arbitrary raw values, and is deterministic", () => {
		fc.assert(
			fc.property(fc.oneof(rawArb, shapedArb), (value) => {
				const a = run(() => loadGoldenRaw(value, FILE));
				const b = run(() => loadGoldenRaw(value, FILE));
				expect(a.threw).toBe(false);
				expect(b.threw).toBe(false);
				if (a.threw || b.threw) return;
				expect(b.value).toEqual(a.value);
				// Either a set with no diagnostics, or diagnostics and no set.
				if (a.value.ok) {
					expect(a.value.diagnostics).toEqual([]);
				} else {
					expect(a.value.diagnostics.length).toBeGreaterThan(0);
					expect("set" in a.value).toBe(false);
				}
			}),
			{ numRuns: 300 },
		);
	});

	it("returns diagnostics for a BigInt where a fact value belongs", () => {
		const result = loadGoldenRaw(
			{
				kb: "x",
				scenarios: [
					{ id: "a", title: "t", facts: { f: 0n }, expect: { goals: {} } },
				],
			},
			FILE,
		);

		expect(result.ok).toBe(false);
		expect(result.diagnostics[0]?.message).toContain("Found '0n'");
	});

	it("returns diagnostics for a cycle, a symbol and a function in a fact value", () => {
		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		for (const bad of [cycle, Symbol("s"), () => 1]) {
			const result = loadGoldenRaw(
				{
					kb: "x",
					scenarios: [
						{ id: "a", title: "t", facts: { f: bad }, expect: { goals: {} } },
					],
				},
				FILE,
			);

			expect(result.ok).toBe(false);
		}
	});
});
