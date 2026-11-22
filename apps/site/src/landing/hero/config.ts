// The only module on the landing page that names a fact, a goal or a rule (requirement 1.8).
import type { FactValue } from "@dead-certain/engine";

/** The facts of golden scenario G-01 in apps/claim-check/golden/scenarios.yaml. hero.golden.test.ts pins them. */
export const HERO_FACTS: Readonly<Record<string, FactValue>> = {
	cause: "illness",
	treatment: "other",
	treated_outside_india: false,
	policy_start_date: "2025-01-01",
	illness_start_date: "2025-06-01",
	annexure_items: 1_200_000,
	room_rent_per_day: 600_000,
	room_days: 5,
	age: 64,
	sum_insured: "five_lakh",
	paid_this_year: 0,
	claimed: 21_000_000,
};

/** Money goal: the amount the policy pays, in minor units. */
export const AMOUNT_GOAL = "payable";
/** Enum goal with the values paid, reduced and denied. */
export const STATE_GOAL = "outcome";
/** Money fact: the total on the hospital bill. */
export const CLAIMED_FACT = "claimed";
/** The line item whose proof the steps quote from (requirement 4.3). */
export const STEP_FACT = "room_rent_deduction";
/** A rule in STEP_FACT's proof, short enough to read on a phone. Chosen in task 4. */
export const STEP_RULE = "ROOM-05";
