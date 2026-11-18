import { answer, type FactValue, next, start } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { loadedKb } from "../kb";

// One consultation step over the built knowledge base takes under 10 ms (13.9).
const ANSWERS: Record<string, FactValue> = {
	claimed: 2_00_000_00,
	cause: "illness",
	policy_start_date: "2025-01-01",
	illness_start_date: "2025-06-01",
	treatment: "other",
	treated_outside_india: false,
	annexure_items: 2_000_00,
	room_rent_per_day: 6_000_00,
	sum_insured: "five_lakh",
	room_days: 5,
	age: 65,
	paid_this_year: 0,
};
const RUNS = 101;

/** The median time of `fn` over RUNS calls, so one slow sample cannot fail the test. */
function median(fn: () => void): number {
	const times: number[] = [];
	for (let i = 0; i < RUNS; i++) {
		const t = performance.now();
		fn();
		times.push(performance.now() - t);
	}
	return times.sort((a, b) => a - b)[RUNS >> 1] ?? Infinity;
}

describe("next over the built knowledge base", () => {
	it("decides each step of a full consultation in under 10 ms", () => {
		if (loadedKb === null) throw new Error("kb/dist/policy.json did not load");
		let s = start(loadedKb);
		const worst: Record<string, number> = {};
		for (let step = next(s); step.kind === "question"; step = next(s)) {
			const at = s;
			worst[step.fact] = median(() => next(at));
			const value = ANSWERS[step.fact];
			if (value === undefined) throw new Error(`no answer for ${step.fact}`);
			s = answer(s, step.fact, value);
		}
		worst.verdict = median(() => next(s));
		for (const [at, ms] of Object.entries(worst))
			expect(ms, `next at ${at}`).toBeLessThan(10);
	});
});
