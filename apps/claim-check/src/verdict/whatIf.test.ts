import { answer, start, whatIf } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { realKb } from "../testing/realKb";
import { usefulAlternatives } from "./whatIf";

const kb = realKb();
const REDUCED = {
	claimed: 2_00_000_00,
	cause: "accident",
	treatment: "other",
	treated_outside_india: false,
	annexure_items: 2_000_00,
	room_rent_per_day: 6_000_00,
	sum_insured: "rs_500000",
	room_days: 5,
	age: 65,
	paid_this_year: 0,
};

describe("usefulAlternatives", () => {
	it("keeps whole-rupee changes with a known amount", () => {
		const s = Object.entries(REDUCED).reduce(
			(acc, [f, v]) => answer(acc, f, v),
			start(kb),
		);
		const all = whatIf(s);
		const kept = usefulAlternatives(kb, all);
		expect(kept.length).toBeGreaterThan(0);
		expect(kept.length).toBeLessThan(all.length);
		expect(kept.every((a) => a.verdict.goals.payable !== undefined)).toBe(true);
		expect(
			kept.filter((a) => a.fact === "room_rent_per_day").map((a) => a.value),
		).toEqual([5_000_00]);
	});
});
