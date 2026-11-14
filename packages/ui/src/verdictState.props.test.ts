import type { FactValue } from "@dead-certain/engine/types";
import fc from "fast-check";
import { expect, test } from "vitest";
import { verdictStateFrom } from "./verdictState";

const STATES = ["paid", "reduced", "denied", "ready", "not_ready", "undecided"];

const goalArb: fc.Arbitrary<FactValue | undefined> = fc.oneof(
	fc.constant(undefined),
	fc.boolean(),
	fc.double(),
	fc.integer(),
	fc.string(),
	fc.constantFrom(
		...STATES,
		"toString",
		"constructor",
		"__proto__",
		"hasOwnProperty",
	),
);

test("verdict state is total", () => {
	// Feature: ui-kit, Property 8: Verdict state is total
	fc.assert(
		fc.property(goalArb, fc.nat(), (goal, needed) => {
			const state = verdictStateFrom(goal, needed);

			expect(STATES).toContain(state);
			if (typeof goal !== "string") expect(state).toBe("undecided");
		}),
		{ numRuns: 300 },
	);
});
