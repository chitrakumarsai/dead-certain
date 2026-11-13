import type { Alternative, FactDef, Verdict } from "@dead-certain/engine/types";
import { expect, test } from "vitest";
import { type WhatIfContext, whatIfText } from "./components/whatIfText";
import { claimVerdictFixture } from "./fixtures";

const DEFS: Record<string, FactDef> = {
	room_rent_per_day: { type: "money" },
	is_emergency: { type: "boolean" },
	licence: { type: "enum", options: ["MIT", "GitHub"] },
};
const LABELS: Record<string, string> = {
	room_rent_per_day: "Room rent per day",
	is_emergency: "Emergency admission",
	licence: "MIT licence type",
};
const context: WhatIfContext = {
	current: claimVerdictFixture,
	labelFor: (fact) => LABELS[fact] ?? fact,
	defFor: (fact) => DEFS[fact],
	amountGoal: "payable_amount",
	stateGoal: "verdict",
	format: { currency: "INR" },
};
const verdict = (
	payable: number | undefined,
	state: string | undefined,
	needed = 0,
): Verdict => ({
	...claimVerdictFixture,
	goals: { payable_amount: payable, verdict: state },
	needed: claimVerdictFixture.needed.concat(
		Array.from({ length: needed }, () => ({
			kind: "question" as const,
			fact: "age",
			text: "How old is the patient?",
		})),
	),
});
const alt = (fact: string, value: Alternative["value"], v: Verdict) => ({
	fact,
	value,
	verdict: v,
});

test("money value stays verbatim and the delta is signed", () => {
	expect(
		whatIfText(
			alt("room_rent_per_day", 5_000_00, verdict(180_500_00, "reduced")),
			context,
		),
	).toBe("If room rent per day were ₹5,000: + ₹38,000");
	expect(
		whatIfText(
			alt("room_rent_per_day", 9_000_00, verdict(130_000_00, "reduced")),
			context,
		),
	).toBe("If room rent per day were ₹9,000: − ₹12,500");
});

test("a boolean reads lower case mid-sentence", () => {
	expect(
		whatIfText(
			alt("is_emergency", false, verdict(172_000_00, "reduced")),
			context,
		),
	).toBe("If emergency admission were no: + ₹29,500");
});

test("an enum keeps its capitals, and an acronym-led label is left alone", () => {
	expect(
		whatIfText(alt("licence", "MIT", verdict(142_500_00, "paid")), context),
	).toBe("If MIT licence type were MIT: Paid in part to Paid in full");
	expect(
		whatIfText(alt("licence", "GitHub", verdict(142_500_00, "paid")), context),
	).toBe("If MIT licence type were GitHub: Paid in part to Paid in full");
});

test("zero delta and the same state give the generic text, on purpose", () => {
	expect(
		whatIfText(alt("licence", "MIT", verdict(142_500_00, "reduced")), context),
	).toBe("If MIT licence type were MIT: the verdict changes");
	expect(
		whatIfText(alt("licence", "MIT", verdict(142_500_00, "reduced")), {
			...context,
			stateGoal: undefined,
		}),
	).toBe("If MIT licence type were MIT: the verdict changes");
});

test("an unknown amount is said, with the state change beside it", () => {
	expect(
		whatIfText(
			alt("room_rent_per_day", 6_000_00, verdict(undefined, undefined, 1)),
			context,
		),
	).toBe(
		"If room rent per day were ₹6,000: amount not known yet; Paid in part to More answers needed",
	);
	expect(
		whatIfText(
			alt("room_rent_per_day", 6_000_00, verdict(undefined, "reduced")),
			context,
		),
	).toBe("If room rent per day were ₹6,000: amount not known yet");
});

test("without an amount goal the row names the state change", () => {
	expect(
		whatIfText(alt("is_emergency", true, verdict(142_500_00, "paid")), {
			...context,
			amountGoal: undefined,
		}),
	).toBe("If emergency admission were yes: Paid in part to Paid in full");
});
