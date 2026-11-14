import fc from "fast-check";
import { expect, test } from "vitest";
import {
	defaultLocale,
	formatMoney,
	minorDigits,
	parseMoney,
	reformatMoneyInput,
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

/** The characters that carry the amount: digits and the first decimal point. */
function significant(text: string): string {
	const firstDot = text.indexOf(".");
	return [...text]
		.filter((ch, i) => /\d/.test(ch) || (ch === "." && i === firstDot))
		.join("");
}

/** How many significant characters of `text` sit left of `caret`. */
function significantBefore(text: string, caret: number): number {
	const firstDot = text.indexOf(".");
	return [...text.slice(0, caret)].filter(
		(ch, i) => /\d/.test(ch) || (ch === "." && i === firstDot),
	).length;
}

const rawArb = fc
	.array(fc.constantFrom(..."0123456789.,, x"), { maxLength: 20 })
	.map((chars) => chars.join(""));

test("reformat keeps the digits", () => {
	// Feature: ui-kit, Property 3: Reformat keeps the digits
	fc.assert(
		fc.property(
			rawArb,
			fc.nat({ max: 20 }),
			fc.constantFrom("en-IN", "en"),
			(raw, at, locale) => {
				const caret = Math.min(at, raw.length);

				const out = reformatMoneyInput(raw, caret, locale);

				expect(significant(out.text)).toBe(significant(raw));
				expect(significantBefore(out.text, out.caret)).toBe(
					significantBefore(raw, caret),
				);
				expect(out.caret).toBeGreaterThanOrEqual(0);
				expect(out.caret).toBeLessThanOrEqual(out.text.length);
				// Already-grouped text is left alone.
				expect(reformatMoneyInput(out.text, out.caret, locale)).toEqual(out);
			},
		),
		RUNS,
	);
});
