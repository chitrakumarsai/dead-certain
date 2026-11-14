// Shared calendar-date helpers. One module owns date validity so the lexer
// and the evaluator can never disagree.

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
	const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (month === 2 && isLeapYear(year)) return 29;
	return days[month] ?? 0;
}

/**
 * Validates a date string of the form YYYY-MM-DD (without quotes).
 * Valid range: year 1–9999, month 01–12, day 01–28/29/30/31 per month.
 */
export function isValidDate(s: string): boolean {
	// Must match exactly YYYY-MM-DD
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;

	const year = parseInt(s.slice(0, 4), 10);
	const month = parseInt(s.slice(5, 7), 10);
	const day = parseInt(s.slice(8, 10), 10);

	if (year < 1 || year > 9999) return false;
	if (month < 1 || month > 12) return false;
	if (day < 1 || day > daysInMonth(year, month)) return false;

	return true;
}

/**
 * Calendar-order comparison of two date strings.
 * Precondition: both arguments satisfy isValidDate. The fixed-width format
 * makes plain string comparison equal to chronological comparison.
 */
export function compareDates(a: string, b: string): -1 | 0 | 1 {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}
