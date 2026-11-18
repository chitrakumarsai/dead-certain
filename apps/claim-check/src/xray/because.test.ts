import { answer, explain, type ProofNode, start } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { realKb } from "../testing/realKb";
import { withPrintedBecause } from "./because";

const kb = realKb();
const REDUCED = {
	claimed: 2_00_000_00,
	cause: "accident",
	treatment: "other",
	treated_outside_india: false,
	annexure_items: 2_000_00,
	room_rent_per_day: 6_000_00,
	sum_insured: "five_lakh",
	room_days: 5,
	age: 65,
	paid_this_year: 0,
};
const s = Object.entries(REDUCED).reduce(
	(acc, [f, v]) => answer(acc, f, v),
	start(kb),
);

const sentences = (n: ProofNode): string[] => [
	...(n.because ? [n.because] : []),
	...n.children.flatMap(sentences),
];

describe("withPrintedBecause", () => {
	it("prints money in the rule sentences", () => {
		const all = sentences(
			withPrintedBecause(explain(s, "copayment_deduction"), s),
		);
		expect(all).toContain(
			"A policyholder aged 61 or over pays 20% of the admissible claim of ₹1,65,000.",
		);
		expect(all.join(" ")).not.toMatch(/\d{6,}/);
	});

	it("keeps every other field of the tree", () => {
		const raw = explain(s, "outcome");
		const strip = (n: ProofNode): unknown => ({
			...n,
			because: undefined,
			children: n.children.map(strip),
		});
		expect(strip(withPrintedBecause(raw, s))).toEqual(strip(raw));
	});
});
