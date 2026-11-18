import {
	answer,
	type FactValue,
	next,
	type Session,
	start,
	type Verdict,
} from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { realKb } from "../testing/realKb";
import { ledgerFrom, partsFrom } from "./parts";
import { statementFor, stateOf } from "./statement";

const kb = realKb();
const play = (answers: Record<string, FactValue>): [Session, Verdict] => {
	const s = Object.entries(answers).reduce(
		(acc, [f, v]) => answer(acc, f, v),
		start(kb),
	);
	const step = next(s);
	if (step.kind !== "verdict") throw new Error("expected a verdict");
	return [s, step];
};

const REDUCED = {
	claimed: 250_000_00,
	cause: "accident",
	treatment: "other",
	treated_outside_india: false,
	annexure_items: 2_000_00,
	room_rent_per_day: 6_000_00,
	sum_insured: "five_lakh",
	room_days: 5,
	age: 40,
	paid_this_year: 0,
};

describe("verdict parts", () => {
	it("sums the parts to the claimed amount and leaves out zero lines", () => {
		const [s, verdict] = play(REDUCED);
		const ledger = ledgerFrom(s, verdict);
		if (ledger === null) throw new Error("no ledger");
		expect(ledger.items.every((i) => i.value !== 0)).toBe(true);
		const parts = partsFrom(ledger);
		expect(parts.reduce((sum, p) => sum + p.value, 0)).toBe(250_000_00);
		expect(stateOf(verdict)).toBe("reduced");
	});

	it("leaves an unknown line out of the parts", () => {
		const parts = partsFrom({
			claimed: { label: "Claimed", value: 100 },
			items: [
				{
					fact: "a",
					role: "deduction",
					label: "A",
					value: 40,
					rule: "R",
					clause: "1",
				},
				{
					fact: "b",
					role: "deduction",
					label: "B",
					value: undefined,
					rule: "R",
					clause: "1",
				},
			],
			payable: { label: "Payable", value: 60 },
		});
		expect(parts.map((p) => p.label)).toEqual(["Paid", "A"]);
	});

	it("states a denial as ₹0 of the claimed amount, in the policy's currency", () => {
		const [s, verdict] = play({
			claimed: 100_000_00,
			cause: "accident",
			treatment: "cosmetic",
		});
		expect(stateOf(verdict)).toBe("denied");
		const ledger = ledgerFrom(s, verdict);
		expect(ledger?.payable.value).toBe(0);
		expect(statementFor(kb, 0, 100_000_00)).toBe(
			"₹0 of ₹1,00,000 will be paid",
		);
	});
});
