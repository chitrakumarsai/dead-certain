import { audit, explain, type ProofNode } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { claimKb } from "../testing/claimKb";
import { valueArb } from "../testing/valueArb";
import { withPrintedBecause } from "./because";
import { HERO_FACTS } from "./config";
import { heroModel } from "./model";

const kb = claimKb();

/** HERO_FACTS with one askable fact given another valid value. */
const perturbed = fc.constantFrom(...Object.keys(HERO_FACTS)).chain((fact) => {
	const def = kb.facts[fact];
	if (def === undefined) throw new Error(`no definition for ${fact}`);
	return valueArb(def).map((value) => ({ ...HERO_FACTS, [fact]: value }));
});

const strip = (n: ProofNode): unknown => ({
	fact: n.fact,
	value: n.value,
	rule: n.rule,
	source: n.source,
	children: n.children.map(strip),
});

const nodes = (n: ProofNode): ProofNode[] => [n, ...n.children.flatMap(nodes)];

describe("hero properties", () => {
	it("relays the engine", () => {
		// Feature: landing-page, Property 1: The hero relays the engine
		fc.assert(
			fc.property(perturbed, (facts) => {
				const model = heroModel(kb, facts);
				if ("kind" in model) return;
				const verdict = audit(kb, facts);
				expect(model.verdict).toEqual(verdict);
				expect(model.ledger.items).toEqual(
					verdict.lineItems.filter(
						(i) => i.role === "deduction" && i.value !== 0,
					),
				);
			}),
			{ numRuns: 100 },
		);
	});

	it("adds up or refuses", () => {
		// Feature: landing-page, Property 2: The ledger adds up or the page refuses
		fc.assert(
			fc.property(perturbed, (facts) => {
				const model = heroModel(kb, facts);
				if ("kind" in model) {
					expect(["ledger_mismatch", "engine_error", "kb_mismatch"]).toContain(
						model.reason,
					);
					return;
				}
				const cut = model.ledger.items.reduce(
					(sum, i) => sum + (i.value as number),
					0,
				);
				expect(model.ledger.claimed.value - cut).toBe(
					model.ledger.payable.value,
				);
			}),
			{ numRuns: 100 },
		);
	});

	it("prints money as money in every proof sentence", () => {
		// Feature: landing-page, Property 5: Proof sentences print money as money
		const facts = [
			...kb.goals,
			...Object.keys(kb.facts).filter((f) => kb.facts[f]?.role),
		];
		fc.assert(
			fc.property(perturbed, fc.constantFrom(...facts), (answers, fact) => {
				const model = heroModel(kb, answers);
				if ("kind" in model) return;
				const raw = explain(model.session, fact);
				const printed = withPrintedBecause(raw, model.session);
				expect(strip(printed)).toEqual(strip(raw));
				for (const n of nodes(printed))
					if (kb.facts[n.fact]?.type === "money" && n.because !== undefined)
						expect(n.because, n.fact).not.toMatch(/\d{7,}/);
			}),
			{ numRuns: 100 },
		);
	});
});
