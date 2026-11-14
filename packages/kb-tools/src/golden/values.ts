import type { FactDef, FactValue } from "@dead-certain/engine";
import { shown } from "../schema";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
	if (month === 2) return isLeapYear(year) ? 29 : 28;
	return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * True when `text` is `YYYY-MM-DD` and names a real calendar day in years 0001 to
 * 9999, the range the engine accepts. No `Date`.
 */
export function isCalendarDate(text: string): boolean {
	const match = ISO_DATE.exec(text);
	if (match === null) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	return (
		year >= 1 &&
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		day <= daysInMonth(year, month)
	);
}

/**
 * `undefined` when `value` fits the fact's type. Otherwise the phrase that
 * says what the fact needs, for a message: "a boolean", "a number", and so on.
 */
export function checkValue(def: FactDef, value: unknown): string | undefined {
	switch (def.type) {
		case "boolean":
			return typeof value === "boolean" ? undefined : "a boolean";
		case "number":
			return typeof value === "number" && Number.isFinite(value)
				? undefined
				: "a number";
		case "money":
			return typeof value === "number" && Number.isSafeInteger(value)
				? undefined
				: "a whole number of minor units";
		case "date":
			return typeof value === "string" && isCalendarDate(value)
				? undefined
				: "a date written YYYY-MM-DD";
		case "enum": {
			const options = def.options ?? [];
			return typeof value === "string" && options.includes(value)
				? undefined
				: `one of ${options.join(", ")}`;
		}
		default:
			return "a value of a known type";
	}
}

/** A value as a message shows it. `null` and `undefined` read as unknown. Never throws. */
export function describeValue(value: FactValue | null | undefined): string {
	if (value === null || value === undefined) return "unknown";
	if (typeof value === "string") return value;
	return shown(value);
}
