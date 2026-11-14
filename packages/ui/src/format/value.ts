import type { FactDef, FactValue } from "@dead-certain/engine/types";
import type { FormatContext } from "../types";
import { humanize } from "./label";
import { defaultLocale, formatMoney } from "./money";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Prints the calendar day an ISO `YYYY-MM-DD` string names. The date is built
 * in UTC and formatted in UTC, so the machine's time zone never moves the day.
 */
export function formatDate(iso: string, locale = "en-IN"): string {
	const day = new Date(`${iso}T00:00:00Z`);
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeZone: "UTC",
	}).format(day);
}

/** Display text for a fact value. A value that does not fit its type prints as it is. */
export function formatValue(
	def: Pick<FactDef, "type">,
	value: FactValue | undefined,
	format: FormatContext,
): string {
	if (value === undefined) return "Not known yet";
	const locale =
		format.locale ??
		(format.currency ? defaultLocale(format.currency) : "en-IN");

	if (def.type === "money" && typeof value === "number" && format.currency) {
		return formatMoney(value, format.currency, locale);
	}
	if (def.type === "number" && typeof value === "number") {
		return new Intl.NumberFormat(locale).format(value);
	}
	if (def.type === "boolean" && typeof value === "boolean") {
		return value ? "Yes" : "No";
	}
	if (def.type === "enum" && typeof value === "string") return humanize(value);
	if (
		def.type === "date" &&
		typeof value === "string" &&
		ISO_DATE.test(value)
	) {
		return formatDate(value, locale);
	}
	return String(value);
}
