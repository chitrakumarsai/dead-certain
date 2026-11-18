import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "./derive";
import { EXTRACTORS } from "./extractors";
import { preflightKb } from "./testing/kb";
import type { RepoSnapshot } from "./types";

const kb = preflightKb();
const RUNS = { numRuns: 300 };
const TREE_FACTS = Object.entries(EXTRACTORS)
	.filter(([, e]) => e.reads === "tree")
	.map(([f]) => f);

const pathArb = fc
	.array(
		fc.constantFrom(
			".kiro",
			"specs",
			"apps",
			"web",
			"api",
			"LICENSE",
			"package.json",
			"tasks.md",
			"README.md",
			"src",
			"COPYING",
		),
		{ minLength: 1, maxLength: 4 },
	)
	.map((parts) => parts.join("/"));
const entryArb = fc.record({
	path: pathArb,
	type: fc.constantFrom<"blob" | "tree">("blob", "tree"),
});
const textArb = fc.oneof(
	fc.string({ maxLength: 200 }),
	fc
		.array(
			fc.constantFrom(
				".kiro",
				".kiro/",
				"!.kiro/",
				"/.kiro/**",
				"**/.kiro",
				"# x",
				"## Usage",
				"Install",
				"=====",
				"[ab]",
				"node_modules/",
				"*.md",
			),
			{ maxLength: 6 },
		)
		.map((ls) => ls.join("\n")),
);

const snapshotArb: fc.Arbitrary<RepoSnapshot> = fc.record({
	version: fc.constant(1 as const),
	target: fc.constant({ owner: "o", name: "n" }),
	takenAt: fc.constant("2026-11-18T12:00:00.000Z"),
	metadata: fc.record({
		fullName: fc.constant("o/n"),
		defaultBranch: fc.constant("main"),
		private: fc.boolean(),
		archived: fc.boolean(),
		description: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
		license: fc.option(
			fc.record({
				spdxId: fc.option(
					fc.constantFrom("MIT", "Apache-2.0", "NOASSERTION", "x".repeat(300)),
					{ nil: null },
				),
			}),
			{ nil: null },
		),
		size: fc.nat(),
		pushedAt: fc.constant(null),
	}),
	tree: fc.record({
		entries: fc.array(entryArb, { maxLength: 30 }),
		truncated: fc.boolean(),
		empty: fc.boolean(),
	}),
	gitignore: fc.option(fc.record({ text: textArb, clipped: fc.boolean() }), {
		nil: null,
	}),
	readme: fc.option(
		fc.record({
			text: textArb,
			clipped: fc.boolean(),
			name: fc.constant("README.md"),
		}),
		{ nil: null },
	),
});

const nonDerived = Object.entries(kb.facts)
	.filter(([, d]) => d.derived !== true)
	.map(([f]) => f)
	.sort();

describe("deriveFacts properties", () => {
	it("is pure and typed, and every fact it does not return is unseen", () => {
		// Feature: pre-flight-app, Property 3: Derivation is pure and typed
		fc.assert(
			fc.property(snapshotArb, (s) => {
				const a = deriveFacts(s, kb);
				expect(deriveFacts(s, kb)).toEqual(a);
				expect([...Object.keys(a.facts), ...a.unseen].sort()).toEqual(
					nonDerived,
				);
				for (const [fact, value] of Object.entries(a.facts)) {
					const def = kb.facts[fact];
					expect(def?.derived).not.toBe(true);
					if (def?.type === "boolean") expect(typeof value).toBe("boolean");
					if (def?.type === "number") expect(Number.isFinite(value)).toBe(true);
					if (def?.type === "enum") expect(def.options).toContain(value);
					expect((a.evidence[fact] ?? "").length).toBeGreaterThan(0);
					expect((a.evidence[fact] ?? "").length).toBeLessThanOrEqual(200);
				}
			}),
			RUNS,
		);
	});

	it("guesses nothing from a truncated tree", () => {
		// Feature: pre-flight-app, Property 4: Nothing is guessed from a truncated tree
		fc.assert(
			fc.property(snapshotArb, (s) => {
				const d = deriveFacts(
					{ ...s, tree: { ...s.tree, truncated: true } },
					kb,
				);
				for (const fact of TREE_FACTS) {
					expect(d.facts).not.toHaveProperty(fact);
					expect(d.unseen).toContain(fact);
				}
			}),
			RUNS,
		);
	});
});
