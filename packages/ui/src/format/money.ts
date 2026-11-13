export type ParseMoney =
	| { ok: true; minor: number }
	| { ok: false; reason: "empty" | "format" | "decimals" };

export function defaultLocale(currency: string): string {
	return currency === "INR" ? "en-IN" : "en";
}

/** Fraction digits of a currency: 2 for INR, 0 for JPY. */
export function minorDigits(currency: string, locale: string): number {
	return (
		new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
		}).resolvedOptions().maximumFractionDigits ?? 0
	);
}

/** The symbol `formatMoney` prints for a currency, such as "₹". */
export function currencySymbol(currency: string, locale: string): string {
	return (
		new Intl.NumberFormat(locale, { style: "currency", currency })
			.formatToParts(0)
			.find((part) => part.type === "currency")?.value ?? ""
	);
}

/**
 * Prints integer minor units in the currency's grouping: 14250000 INR is
 * "₹1,42,500". Whole amounts drop the fraction digits.
 */
export function formatMoney(
	minor: number,
	currency: string,
	locale: string = defaultLocale(currency),
): string {
	const digits = minorDigits(currency, locale);
	const whole = minor % 10 ** digits === 0;
	// The amount goes to Intl as an exact decimal string. Dividing by
	// 10 ** digits first would lose paise on large amounts.
	const text = String(Math.abs(minor)).padStart(digits + 1, "0");
	const cut = text.length - digits;
	const decimal = `${minor < 0 ? "-" : ""}${text.slice(0, cut)}${
		digits ? `.${text.slice(cut)}` : ""
	}`;
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		minimumFractionDigits: whole ? 0 : digits,
		maximumFractionDigits: digits,
	}).format(decimal as unknown as number);
}

/**
 * Reads typed or formatted text into integer minor units. The integer is
 * built by joining digit strings, never by multiplying a float.
 */
export function parseMoney(
	text: string,
	currency: string,
	locale: string,
): ParseMoney {
	const symbol = currencySymbol(currency, locale);
	const bare = (symbol ? text.replaceAll(symbol, "") : text).replace(
		/[\s,]/g,
		"",
	);
	if (bare === "") return { ok: false, reason: "empty" };
	if (!/^\d+(\.\d*)?$/.test(bare)) return { ok: false, reason: "format" };
	const [int = "", frac = ""] = bare.split(".");
	const digits = minorDigits(currency, locale);
	if (frac.length > digits) return { ok: false, reason: "decimals" };
	const minor = Number(int + frac.padEnd(digits, "0"));
	return Number.isSafeInteger(minor)
		? { ok: true, minor }
		: { ok: false, reason: "format" };
}
