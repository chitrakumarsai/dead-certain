import { next } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { consultArb } from "../testing/consultArb";
import { realKb } from "../testing/realKb";
import { ledgerFrom, partsFrom } from "./parts";

const kb = realKb();
const rupees = (min: number, max: number) =>
	fc.integer({ min, max }).map((r) => r * 100);

// Answers the app accepts. The ranges keep the named charges (at most
// ₹5,000 + ₹15,000 × 10 days) inside the bill without a filter, which
// fast-check's bias toward edge values would make reject almost every run.
const realistic = consultArb(kb, Number.POSITIVE_INFINITY, {
	claimed: rupees(155_000, 5_000_000),
	annexure_items: rupees(0, 5_000),
	room_rent_per_day: rupees(0, 15_000),
	room_days: fc.integer({ min: 0, max: 10 }),
});

describe("verdict properties", () => {
	it("adds up: claimed less the rows is payable, and the parts sum to claimed", () => {
		// Feature: claim-check-app, Property 5: The ledger adds up
		fc.assert(
			fc.property(realistic, (s) => {
				const verdict = next(s);
				if (verdict.kind !== "verdict") return;
				const ledger = ledgerFrom(s, verdict);
				if (ledger === null) return;
				const rows = ledger.items.reduce(
					(sum, item) =>
						sum + (typeof item.value === "number" ? item.value : 0),
					0,
				);
				expect(ledger.claimed.value - rows).toBe(ledger.payable.value);
				const parts = partsFrom(ledger);
				if (ledger.claimed.value > 0)
					expect(parts.reduce((sum, p) => sum + p.value, 0)).toBe(
						ledger.claimed.value,
					);
			}),
			{ numRuns: 200 },
		);
	});
});
