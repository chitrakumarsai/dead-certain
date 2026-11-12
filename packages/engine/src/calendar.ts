// Pure day-number arithmetic on civil dates (proleptic Gregorian). No Date,
// no clock. Day 0 is 1970-01-01. Uses the integer civil-calendar algorithm.

import { isValidDate } from "./lang/dates";

function pad(n: number, width: number): string {
	return String(n).padStart(width, "0");
}

/**
 * Days since 1970-01-01 for a YYYY-MM-DD string.
 * Precondition: `isValidDate(iso)`.
 */
export function dayNumber(iso: string): number {
	const y0 = Number(iso.slice(0, 4));
	const m = Number(iso.slice(5, 7));
	const d = Number(iso.slice(8, 10));
	const y = m <= 2 ? y0 - 1 : y0;
	const era = Math.floor(y / 400);
	const yoe = y - era * 400;
	const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
	const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
	return era * 146097 + doe - 719468;
}

/**
 * Inverse of `dayNumber`. For day numbers outside years 0001 to 9999 the
 * result is a string that fails `isValidDate`.
 */
export function fromDayNumber(n: number): string {
	const z = n + 719468;
	const era = Math.floor(z / 146097);
	const doe = z - era * 146097;
	const yoe = Math.floor(
		(doe -
			Math.floor(doe / 1460) +
			Math.floor(doe / 36524) -
			Math.floor(doe / 146096)) /
			365,
	);
	const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
	const mp = Math.floor((5 * doy + 2) / 153);
	const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
	const m = mp < 10 ? mp + 3 : mp - 9;
	const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
	return `${y < 0 ? "-" : ""}${pad(Math.abs(y), 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

/**
 * Adds `delta` days to a valid date. Returns `undefined` when the input is
 * invalid, `delta` is not a safe integer, or the result fails `isValidDate`.
 */
export function addDays(iso: string, delta: number): string | undefined {
	if (!isValidDate(iso) || !Number.isSafeInteger(delta)) return undefined;
	const result = fromDayNumber(dayNumber(iso) + delta);
	return isValidDate(result) ? result : undefined;
}
