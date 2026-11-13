import {
	defaultLocale,
	formatMoney,
	minorDigits,
	parseMoney,
} from "../format/money";
import type { FormatContext } from "../types";

/** The fixed validation messages, word for word from the design. */
export const ANSWER_MESSAGES = {
	chooseOne: "Choose one answer.",
	enterAmount: "Enter an amount.",
	moneyFormat: "Use digits only, with an optional decimal point.",
	aboveZero: "Enter an amount above zero.",
	enterNumber: "Enter a number.",
	pickDate: "Pick a date.",
} as const;

/** "Use at most 2 decimal places.", with the number taken from the currency. */
export function decimalsMessage(digits: number): string {
	if (digits === 0) return "Use whole amounts only.";
	return `Use at most ${digits} decimal ${digits === 1 ? "place" : "places"}.`;
}

/** "Enter an amount of at least ₹500.", with `min` in minor units. */
export function atLeastMessage(min: number, format: FormatContext): string {
	const currency = format.currency ?? "INR";
	return `Enter an amount of at least ${formatMoney(min, currency, format.locale ?? defaultLocale(currency))}.`;
}

export interface MoneyAnswer {
	/** Integer minor units, or undefined when the text is not an accepted amount. */
	readonly value: number | undefined;
	/** Why the text is not accepted, in plain words. */
	readonly problem?: string;
}

/**
 * Reads typed money text. Zero is valid unless `min` says otherwise; a value
 * below `min` is rejected with a message that names the minimum.
 */
export function moneyAnswer(
	raw: string,
	format: FormatContext,
	min?: number,
): MoneyAnswer {
	const currency = format.currency ?? "INR";
	const locale = format.locale ?? defaultLocale(currency);
	const parsed = parseMoney(raw, currency, locale);
	if (!parsed.ok) {
		const problem = {
			empty: ANSWER_MESSAGES.enterAmount,
			format: ANSWER_MESSAGES.moneyFormat,
			decimals: decimalsMessage(minorDigits(currency, locale)),
		}[parsed.reason];
		return { value: undefined, problem };
	}
	if (min !== undefined && parsed.minor < min) {
		const problem =
			min <= 1 ? ANSWER_MESSAGES.aboveZero : atLeastMessage(min, format);
		return { value: undefined, problem };
	}
	return { value: parsed.minor };
}
