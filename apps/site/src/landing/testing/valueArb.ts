// Test-only. A valid value for a fact definition (copied from apps/claim-check/src/testing/consultArb.ts).
import type { FactDef, FactValue } from "@dead-certain/engine";
import fc from "fast-check";

const ISO_DAY = 86_400_000;
const FIRST_DAY = Date.UTC(2018, 0, 1);

export function valueArb(def: FactDef): fc.Arbitrary<FactValue> {
	switch (def.type) {
		case "boolean":
			return fc.boolean();
		case "money":
			return fc.integer({ min: 0, max: 5_000_000 }).map((r) => r * 100);
		case "number":
			return fc.integer({ min: 0, max: 120 });
		case "date":
			return fc
				.integer({ min: 0, max: 365 * 9 })
				.map((d) =>
					new Date(FIRST_DAY + d * ISO_DAY).toISOString().slice(0, 10),
				);
		case "enum":
			return fc.constantFrom(...(def.options ?? []));
	}
}
