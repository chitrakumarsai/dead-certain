// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import { audit } from "@dead-certain/engine";
import { loadGolden } from "@dead-certain/kb-tools";
import { describe, expect, it } from "vitest";
import { claimKb } from "../testing/claimKb";
import { AMOUNT_GOAL, CLAIMED_FACT, HERO_FACTS, STATE_GOAL } from "./config";

// The hero is golden scenario G-01, and must stay it (requirements 2.5, 8.1, 8.2).
const file = new URL(
	"../../../../claim-check/golden/scenarios.yaml",
	import.meta.url,
);
const golden = loadGolden(
	readFileSync(file, "utf8") as string,
	"scenarios.yaml",
);
if (!golden.ok)
	throw new Error("apps/claim-check/golden/scenarios.yaml does not load");
const g01 = golden.set.scenarios.find((s) => s.id === "G-01");
const expected = g01 !== undefined && "goals" in g01.expect ? g01.expect : null;

describe("the hero claim", () => {
	const kb = claimKb();

	it("is G-01's facts", () => {
		expect(g01).toBeDefined();
		expect(HERO_FACTS).toEqual(g01?.facts);
	});

	it("gives G-01's goals and all eight line items", () => {
		const verdict = audit(kb, HERO_FACTS);
		expect(verdict.goals).toEqual(expected?.goals);
		const items = Object.fromEntries(
			verdict.lineItems.map((item) => [item.fact, item.value]),
		);
		expect(items).toEqual(expected?.lineItems);
		expect(verdict.needed).toEqual([]);
	});

	it("names facts and goals the knowledge base has, with the types assumed", () => {
		expect(kb.goals).toEqual(expect.arrayContaining([AMOUNT_GOAL, STATE_GOAL]));
		expect(kb.facts[AMOUNT_GOAL]?.type).toBe("money");
		expect(kb.facts[STATE_GOAL]?.type).toBe("enum");
		expect(kb.facts[CLAIMED_FACT]?.type).toBe("money");
		for (const fact of Object.keys(HERO_FACTS))
			expect(kb.facts[fact]?.ask, fact).toBeDefined();
	});
});
