import fc from "fast-check";
import { expect, test } from "vitest";
import {
	defaultLocale,
	formatMoney,
	minorDigits,
	parseMoney,
} from "./format/money";

const RUNS = { numRuns: 300 };
const currencyArb = fc.constantFrom("INR", "USD", "JPY");
const minorArb = fc.oneof(
	fc.nat({ max: 10_000_000 }),
	fc.maxSafeNat(),
	fc.constantFrom(0, 1, 99, 100, 101, Number.MAX_SAFE_INTEGER),
);

test("money round trip", () => {
	// Feature: ui-kit, Property 1: Money round trip
	fc.assert(
		fc.property(minorArb, currencyArb, (minor, currency) => {
			const locale = defaultLocale(currency);

			const parsed = parseMoney(
				formatMoney(minor, currency, locale),
				currency,
				locale,
			);

			expect(parsed).toEqual({ ok: true, minor });
		}),
		RUNS,
	);
});

// Typed text: mostly money-like characters, so successes are common.
const typedArb = fc.oneof(
	fc.string(),
	fc
		.array(fc.constantFrom(..."0123456789.,  ₹$-e"), { maxLength: 24 })
		.map((chars) => chars.join("")),
);

test("parse never invents precision", () => {
	// Feature: ui-kit, Property 2: Parse never invents precision
	fc.assert(
		fc.property(typedArb, currencyArb, (text, currency) => {
			const locale = defaultLocale(currency);

			const parsed = parseMoney(text, currency, locale);

			if (!parsed.ok) {
				expect(["empty", "format", "decimals"]).toContain(parsed.reason);
				return;
			}
			expect(Number.isSafeInteger(parsed.minor)).toBe(true);
			expect(parsed.minor).toBeGreaterThanOrEqual(0);
			const printed = formatMoney(parsed.minor, currency, locale);
			const fraction = /\.(\d+)$/.exec(printed)?.[1] ?? "";
			expect(fraction.length).toBeLessThanOrEqual(
				minorDigits(currency, locale),
			);
			// Formatting then parsing again gives the same amount back.
			expect(parseMoney(printed, currency, locale)).toEqual(parsed);
		}),
		RUNS,
	);
});
