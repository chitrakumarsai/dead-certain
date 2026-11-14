import type { KnowledgeBase } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText } from "../compile";
import { goldenSetArb, kbArb, renderYaml } from "../testkit";
import { coverage } from "./coverage";
import type { ScenarioResult } from "./model";
import { runGolden } from "./run";

const FILE = "apps/demo/kb/demo.yaml";
const GOLDEN = "apps/demo/golden/main.yaml";

const kbAndSetArb = kbArb.chain((generated) => {
	const compiled = compileText(renderYaml(generated), FILE);
	if (!compiled.ok) return fc.constant(undefined);
	const kb: KnowledgeBase = compiled.kb;
	return goldenSetArb(kb).chain((set) =>
		fc
			.shuffledSubarray([...set.scenarios], {
				minLength: set.scenarios.length,
				maxLength: set.scenarios.length,
			})
			.map((order) => ({ kb, set, order })),
	);
});

describe("Property 5: Coverage is exact", () => {
	// Feature: kb-golden, Property 5: Coverage is exact
	/** **Validates: Requirements 7.1, 7.2, 11.5** */
	it("names a rule if and only if no passing scenario fires it, in rule order", () => {
		fc.assert(
			fc.property(kbAndSetArb, (sample) => {
				if (sample === undefined) return;
				const { results } = runGolden(sample.kb, sample.set.scenarios, GOLDEN);
				const { covered, diagnostics } = coverage(
					sample.kb,
					FILE,
					results,
					results.length,
				);
				const firedByPassing = new Set(
					results.filter((r) => r.status === "passed").flatMap((r) => r.fired),
				);
				const allRules = sample.kb.rules.map((rule) => rule.id);

				const uncovered = diagnostics
					.filter((d) => d.code === "RULE_NOT_COVERED")
					.map((d) => d.id);
				expect(uncovered).toEqual(
					allRules.filter((id) => !firedByPassing.has(id)),
				);
				expect(covered).toEqual(
					allRules.filter((id) => firedByPassing.has(id)),
				);
				for (const d of diagnostics) expect(d.file).toBe(FILE);
			}),
			{ numRuns: 200 },
		);
	});

	it("gives the same covered rules for any order of the scenarios (Property 3, coverage part)", () => {
		fc.assert(
			fc.property(kbAndSetArb, (sample) => {
				if (sample === undefined) return;
				const original = runGolden(sample.kb, sample.set.scenarios, GOLDEN);
				const shuffled = runGolden(sample.kb, sample.order, GOLDEN);
				const a = coverage(
					sample.kb,
					FILE,
					original.results,
					original.results.length,
				);
				const b = coverage(
					sample.kb,
					FILE,
					shuffled.results,
					shuffled.results.length,
				);

				expect(b.covered).toEqual(a.covered);
				expect(b.diagnostics).toEqual(a.diagnostics);
			}),
			{ numRuns: 200 },
		);
	});

	it("never covers a rule more when a passing scenario is replaced by a failed one", () => {
		fc.assert(
			fc.property(kbAndSetArb, fc.nat(), (sample, which) => {
				if (sample === undefined) return;
				const { results } = runGolden(sample.kb, sample.set.scenarios, GOLDEN);
				if (results.length === 0) return;
				const i = which % results.length;
				const failed: ScenarioResult[] = results.map((r, j) =>
					j === i ? { ...r, status: "failed" } : r,
				);
				const before = coverage(
					sample.kb,
					FILE,
					results,
					results.length,
				).covered;
				const after = coverage(sample.kb, FILE, failed, results.length).covered;

				for (const id of after) expect(before).toContain(id);
			}),
			{ numRuns: 200 },
		);
	});
});
