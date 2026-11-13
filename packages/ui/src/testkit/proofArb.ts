import type { ProofNode } from "@dead-certain/engine/types";
import fc from "fast-check";

// Test-only. Never exported from index.ts.

const leafArb: fc.Arbitrary<ProofNode> = fc.record({
	fact: fc.constantFrom("sum_insured", "room_rent_per_day", "age", "stay_days"),
	value: fc.oneof(fc.nat(), fc.boolean(), fc.constant(undefined)),
	source: fc.constantFrom("answered" as const, "collected" as const),
	children: fc.constant([]),
});

/** Random proof trees up to four levels deep. A fact may repeat under two rules. */
export const proofArb: fc.Arbitrary<ProofNode> = fc.letrec<{
	node: ProofNode;
}>((tie) => ({
	node: fc.oneof(
		{ depthSize: "small", maxDepth: 3 },
		leafArb,
		fc.record({
			fact: fc.constantFrom("payable_amount", "room_rent_cap", "rent_over_cap"),
			value: fc.oneof(fc.nat(), fc.boolean()),
			source: fc.constant("derived" as const),
			rule: fc.constantFrom("ROOM-01", "ROOM-02", "ROOM-03"),
			children: fc.array(tie("node"), { maxLength: 4 }),
		}),
	),
})).node;
