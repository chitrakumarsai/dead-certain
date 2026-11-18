import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { memoryHost, type TreeSpec, treeArb } from "../testkit";
import { discover, discoverGolden } from "./discover";

const APPS = ["claim-check", "pre-flight", "demo", "x_app", "other"] as const;
const STEMS = ["main", "extra", "a", "b-2"] as const;
const DIRS_AND_EXTRAS = ["golden/notes.md", "golden/sub/inner.yaml"] as const;

/** A tree plus golden files, and what was added. */
const withGoldenArb = treeArb.chain((tree) =>
	fc
		.uniqueArray(
			fc.tuple(fc.constantFrom(...APPS), fc.constantFrom(...STEMS)),
			{ maxLength: 6, selector: ([app, stem]) => `${app}/${stem}` },
		)
		.chain((pairs) =>
			fc.subarray([...DIRS_AND_EXTRAS], {}).map((extras) => {
				const golden: Record<string, string> = {};
				for (const [app, stem] of pairs) {
					golden[`apps/${app}/golden/${stem}.yaml`] = "kb: x\nscenarios: []\n";
				}
				for (const extra of extras) golden[`apps/${APPS[0]}/${extra}`] = "x";
				const files = { ...tree.files, ...golden };
				return {
					tree,
					plus: { ...tree, files } satisfies TreeSpec,
					goldenFiles: Object.keys(golden)
						.filter((f) => /^apps\/[^/]+\/golden\/[^/]+\.yaml$/.test(f))
						.sort(),
				};
			}),
		),
);

describe("Property 6: Golden files do not change validation (discovery part)", () => {
	// Feature: kb-golden, Property 6: Golden files do not change validation
	/** **Validates: Requirements 1.1, 1.4, 11.6** */
	it("gives validate and build the same files with and without golden files, none under golden/", () => {
		fc.assert(
			fc.property(withGoldenArb, ({ tree, plus }) => {
				const before = discover([], memoryHost(tree));
				const after = discover([], memoryHost(plus));

				expect(after).toEqual(before);
				if (after.ok) {
					for (const file of after.files) {
						expect(file).not.toContain("/golden/");
					}
				}
			}),
			{ numRuns: 200 },
		);
	});

	it("finds exactly the golden files, none under kb/, and no golden file is a KB file", () => {
		fc.assert(
			fc.property(
				withGoldenArb,
				fc.integer({ min: 0, max: 0xffffffff }),
				(sample, seed) => {
					const found = discoverGolden(
						[],
						memoryHost(sample.plus, { shuffleSeed: seed }),
					);

					expect(found.ok).toBe(true);
					if (!found.ok) return;
					expect(found.files).toEqual(
						sample.goldenFiles.filter(
							(f) =>
								/^apps\/[^/]+\/golden\/[^/]+\.yaml$/.test(f) &&
								!f.includes("/sub/"),
						),
					);
					for (const file of found.files) expect(file).not.toContain("/kb/");
					const kb = discover([], memoryHost(sample.plus));
					if (kb.ok) {
						for (const file of kb.files)
							expect(found.files).not.toContain(file);
					}
				},
			),
			{ numRuns: 200 },
		);
	});
});
