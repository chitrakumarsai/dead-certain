import fc from "fast-check";
import { expect, test } from "vitest";
import { partitionBar } from "./components/partitionBar";

const valueArb = fc.oneof(
	fc.nat({ max: 50_000_000 }),
	fc.integer(),
	fc.double(),
	fc.constantFrom(0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY),
);

test("bar parts never exceed the bar", () => {
	// Feature: ui-kit, Property 9: Bar parts never exceed the bar
	fc.assert(
		fc.property(
			fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
			fc.array(valueArb, { maxLength: 40 }),
			(total, values) => {
				const { parts, remainder } = partitionBar(total, values);

				expect(parts).toHaveLength(values.length);
				for (const grow of [...parts, remainder]) {
					expect(Number.isSafeInteger(grow)).toBe(true);
					expect(grow).toBeGreaterThanOrEqual(0);
				}
				expect(parts.reduce((sum, part) => sum + part, remainder)).toBe(total);
				// A valid part is never enlarged.
				parts.forEach((part, i) => {
					const given = values[i] as number;
					if (Number.isSafeInteger(given) && given >= 0) {
						expect(part).toBeLessThanOrEqual(given);
					} else {
						expect(part).toBe(0);
					}
				});
			},
		),
		{ numRuns: 300 },
	);
});
