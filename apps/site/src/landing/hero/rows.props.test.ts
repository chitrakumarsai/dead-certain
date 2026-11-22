import { explain, type ProofNode } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { claimKb } from "../testing/claimKb";
import { valueArb } from "../testing/valueArb";
import { HERO_FACTS } from "./config";
import { heroModel } from "./model";

const kb = claimKb();
const nodes = (n: ProofNode): ProofNode[] => [n, ...n.children.flatMap(nodes)];

const perturbed = fc.constantFrom(...Object.keys(HERO_FACTS)).chain((fact) => {
	const def = kb.facts[fact];
	if (def === undefined) throw new Error(`no definition for ${fact}`);
	return valueArb(def).map((value) => ({ ...HERO_FACTS, [fact]: value }));
});

describe("ledger row proofs", () => {
	it("every row's proof agrees with the row and cites a real clause", () => {
		// Feature: landing-page, Property 3: Every ledger row has a proof that agrees
		fc.assert(
			fc.property(perturbed, (facts) => {
				const model = heroModel(kb, facts);
				if ("kind" in model) return;
				for (const row of model.ledger.items) {
					const root = explain(model.session, row.fact);
					expect(root.value, row.fact).toBe(row.value);
					const all = nodes(root);
					expect(
						all.some((n) => n.rule !== undefined),
						row.fact,
					).toBe(true);
					expect(
						all.some((n) => n.clause !== undefined && kb.clauses[n.clause]),
						row.fact,
					).toBe(true);
				}
			}),
			{ numRuns: 100 },
		);
	});
});
