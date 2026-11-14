import type { KnowledgeBase } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText } from "../compile";
import { goldenSetArb, kbArb, renderYaml } from "../testkit";
import type { GoldenSet, Scenario } from "./model";
import { runGolden, runScenario } from "./run";

const FILE = "apps/demo/kb/demo.yaml";

const kbAndSetArb = kbArb.chain((generated) => {
	const compiled = compileText(renderYaml(generated), FILE);
	if (!compiled.ok) return fc.constant(undefined);
	const kb: KnowledgeBase = compiled.kb;
	return goldenSetArb(kb).map((set) => ({ kb, set }));
});

function deepFreeze<T>(value: T): T {
	if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

/** The scenarios of `set` in a random order, and the same set unshuffled. */
const shuffledArb = (set: GoldenSet) =>
	fc.shuffledSubarray([...set.scenarios], {
		minLength: set.scenarios.length,
		maxLength: set.scenarios.length,
	});

const byId = (results: readonly { id: string }[]) =>
	new Map(results.map((r) => [r.id, r]));

describe("Property 3: Scenario order does not matter", () => {
	// Feature: kb-golden, Property 3: Scenario order does not matter
	/** **Validates: Requirements 5.6, 11.3** */
	it("gives each scenario the same status, fired rules and differences in any order", () => {
		fc.assert(
			fc.property(
				kbAndSetArb.chain((sample) =>
					sample === undefined
						? fc.constant(undefined)
						: shuffledArb(sample.set).map((order) => ({ ...sample, order })),
				),
				(sample) => {
					if (sample === undefined) return;
					const original = runGolden(sample.kb, sample.set.scenarios, FILE);
					const shuffled = runGolden(sample.kb, sample.order, FILE);

					expect(byId(shuffled.results)).toEqual(byId(original.results));
				},
			),
			{ numRuns: 200 },
		);
	});
});

describe("Property 4: Facts order does not matter", () => {
	// Feature: kb-golden, Property 4: Facts order does not matter
	/** **Validates: Requirements 11.4** */
	it("gives a consult scenario the same result for any order of its facts", () => {
		fc.assert(
			fc.property(
				kbAndSetArb.chain((sample) => {
					if (sample === undefined) return fc.constant(undefined);
					const consult = sample.set.scenarios.filter(
						(s) => s.mode === "consult",
					);
					const pick = consult[0];
					if (pick === undefined) return fc.constant(undefined);
					return fc
						.shuffledSubarray(Object.entries(pick.facts), {
							minLength: Object.keys(pick.facts).length,
							maxLength: Object.keys(pick.facts).length,
						})
						.map((entries) => ({ kb: sample.kb, pick, entries }));
				}),
				(sample) => {
					if (sample === undefined) return;
					const permuted: Scenario = {
						...sample.pick,
						facts: Object.fromEntries(sample.entries),
					};

					expect(runScenario(sample.kb, permuted)).toEqual(
						runScenario(sample.kb, sample.pick),
					);
				},
			),
			{ numRuns: 200 },
		);
	});
});

describe("Property 8: Deterministic and pure (runner part)", () => {
	// Feature: kb-golden, Property 8: Deterministic and pure
	/** **Validates: Requirements 5.7** */
	it("returns deep-equal results twice, and changes neither the scenarios nor the knowledge base", () => {
		fc.assert(
			fc.property(kbAndSetArb, (sample) => {
				if (sample === undefined) return;
				deepFreeze(sample.kb);
				deepFreeze(sample.set);

				const first = runGolden(sample.kb, sample.set.scenarios, FILE);
				const second = runGolden(sample.kb, sample.set.scenarios, FILE);

				expect(second).toEqual(first);
			}),
			{ numRuns: 200 },
		);
	});
});
