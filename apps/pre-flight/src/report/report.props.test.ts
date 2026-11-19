import type { FactValue, ProofNode } from "@dead-certain/engine";
import { verdictStateFrom } from "@dead-certain/ui";
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import type { Derived } from "../../collectors/derive";
import { EXTRACTORS } from "../../collectors/extractors";
import { preflightKb } from "../../collectors/testing/kb";
import { recordedSnapshot } from "../../collectors/testing/snapshots";
import type { RepoSnapshot } from "../../collectors/types";
import { CHECKLIST, GOAL } from "../checklists";
import { buildReport, type ReportView } from "./audit";
import { relabelSources } from "./sources";

const kb = preflightKb();
const RUNS = { numRuns: 150 };
let snapshot: RepoSnapshot;
beforeAll(async () => {
	snapshot = await recordedSnapshot("dead-certain");
});

/** A value of the fact's type: a boolean, or a small count or length. */
const valueFor = (fact: string): fc.Arbitrary<FactValue> =>
	kb.facts[fact]?.type === "boolean"
		? fc.boolean()
		: fc.integer({ min: 0, max: 400 });
const nonDerived = Object.entries(kb.facts)
	.filter(([, d]) => d.derived !== true)
	.map(([f]) => f);
const collectible = Object.keys(EXTRACTORS);

const factsArb = (names: readonly string[]) =>
	fc
		.subarray([...names])
		.chain((chosen) =>
			chosen.length === 0
				? fc.constant({} as Record<string, FactValue>)
				: fc
						.tuple(...chosen.map(valueFor))
						.map((vs) =>
							Object.fromEntries(chosen.map((f, i) => [f, vs[i] as FactValue])),
						),
		);
const derivedArb: fc.Arbitrary<Derived> = factsArb(collectible).map(
	(facts) => ({
		facts,
		evidence: Object.fromEntries(
			Object.keys(facts).map((f) => [f, `evidence for ${f}`]),
		),
		unseen: nonDerived.filter((f) => !(f in facts)),
	}),
);

const build = (derived: Derived, answers: Record<string, FactValue>) =>
	buildReport({ kb, checklist: CHECKLIST, snapshot, derived, answers });
const values = (r: ReportView) =>
	r.groups.flatMap((g) =>
		g.checks.map((c) => [c.item.fact, c.item.value] as const),
	);

describe("report properties", () => {
	it("uses collected values over answers, and an unneeded answer changes nothing", () => {
		// Feature: pre-flight-app, Property 6: Collected values win and answers do not leak
		fc.assert(
			fc.property(derivedArb, factsArb(nonDerived), (derived, answers) => {
				const r = build(derived, answers);
				for (const [f, v] of Object.entries(derived.facts))
					expect(r.facts[f]).toBe(v);
				for (const f of Object.keys(answers).filter(
					(x) => x in derived.facts,
				)) {
					const { [f]: _, ...rest } = answers;
					expect(values(build(derived, rest))).toEqual(values(r));
				}
			}),
			RUNS,
		);
	});

	it("relabels sources only", () => {
		// Feature: pre-flight-app, Property 7: Relabelling changes sources only
		const leafArb = fc.record({
			fact: fc.constantFrom("a", "b", "c", "d"),
			value: fc.option(fc.boolean(), { nil: undefined }),
			source: fc.constantFrom<ProofNode["source"]>(
				"answered",
				"collected",
				"derived",
			),
			children: fc.constant([] as ProofNode[]),
		});
		const { tree } = fc.letrec<{ tree: ProofNode }>((tie) => ({
			tree: fc.oneof(
				{ depthSize: "small", withCrossShrink: true },
				leafArb,
				fc.record({
					fact: fc.constantFrom("x", "y"),
					value: fc.option(fc.boolean(), { nil: undefined }),
					source: fc.constant<ProofNode["source"]>("derived"),
					rule: fc.constantFrom("R-1", "R-2"),
					clause: fc.constantFrom("1.1", "2.2"),
					children: fc.array(tie("tree"), { maxLength: 3 }),
				}),
			),
		}));
		fc.assert(
			fc.property(tree, fc.subarray(["a", "b", "c", "d", "x"]), (t, chosen) => {
				const set = new Set(chosen);
				const check = (before: ProofNode, after: ProofNode) => {
					const { source: s1, children: c1, ...rest1 } = before;
					const { source: s2, children: c2, ...rest2 } = after;
					expect(rest2).toEqual(rest1);
					expect(c2).toHaveLength(c1.length);
					if (s1 === "answered")
						expect(s2).toBe(set.has(before.fact) ? "collected" : "answered");
					else expect(s2).toBe(s1);
					c1.forEach((c, i) => {
						check(c, c2[i] as ProofNode);
					});
				};
				check(t, relabelSources(t, set));
			}),
			RUNS,
		);
	});

	it("takes the summary from the goal and counts only decided rows", () => {
		// Feature: pre-flight-app, Property 8: The summary is the engine's, not the app's
		fc.assert(
			fc.property(derivedArb, factsArb(nonDerived), (derived, answers) => {
				const r = build(derived, answers);
				expect(r.summary.state).toBe(
					verdictStateFrom(r.verdict.goals[GOAL], r.verdict.needed.length),
				);
				const rows = r.groups.flatMap((g) => g.checks);
				const failed = (sev: string) =>
					rows.filter((c) => c.item.value === false && c.severity === sev)
						.length;
				if (r.summary.state === "ready")
					expect(failed("blocker") + failed("warning")).toBe(0);
				if (r.summary.state === "not_ready") {
					const b = failed("blocker");
					const w = failed("warning");
					expect(b + w).toBeGreaterThan(0);
					if (b > 0) expect(r.summary.sentence).toContain(`${b} blocker`);
					if (w > 0) expect(r.summary.sentence).toContain(`${w} warning`);
				}
			}),
			RUNS,
		);
	});

	it("an inline answer changes only rows whose proof holds it, and undoing it restores the report", () => {
		// Feature: pre-flight-app, Property 9: An inline answer changes only what depends on it
		fc.assert(
			fc.property(
				derivedArb,
				factsArb(nonDerived),
				fc.boolean(),
				fc.integer({ min: 0, max: 400 }),
				(derived, answers, b, n) => {
					const before = build(derived, answers);
					const q = before.verdict.needed[0];
					if (q === undefined) return;
					const value: FactValue = kb.facts[q.fact]?.type === "boolean" ? b : n;
					const after = build(derived, { ...answers, [q.fact]: value });
					const holds = (proof: ProofNode): boolean =>
						proof.fact === q.fact || proof.children.some(holds);
					const beforeRows = before.groups.flatMap((g) => g.checks);
					const afterRows = after.groups.flatMap((g) => g.checks);
					beforeRows.forEach((row, i) => {
						if (!holds(row.proof))
							expect(afterRows[i]?.item.value).toBe(row.item.value);
					});
					expect(build(derived, answers)).toEqual(before);
				},
			),
			RUNS,
		);
	});
});
