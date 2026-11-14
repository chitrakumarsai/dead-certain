import { describe, expect, it } from "vitest";
import { compareDates, isValidDate } from "./dates";

describe("isValidDate", () => {
	it("accepts a leap day in a leap year", () => {
		expect(isValidDate("2024-02-29")).toBe(true);
	});

	it("rejects Feb 29 in a non-leap year", () => {
		expect(isValidDate("2023-02-29")).toBe(false);
	});

	it("handles century leap rules", () => {
		expect(isValidDate("1900-02-29")).toBe(false);
		expect(isValidDate("2000-02-29")).toBe(true);
	});

	it("rejects month 13 and month 00", () => {
		expect(isValidDate("2024-13-01")).toBe(false);
		expect(isValidDate("2024-00-01")).toBe(false);
	});

	it("rejects day 00 and day past month end", () => {
		expect(isValidDate("2024-01-00")).toBe(false);
		expect(isValidDate("2024-04-31")).toBe(false);
	});

	it("rejects year 0000 and accepts 0001 and 9999", () => {
		expect(isValidDate("0000-01-01")).toBe(false);
		expect(isValidDate("0001-01-01")).toBe(true);
		expect(isValidDate("9999-12-31")).toBe(true);
	});

	it("rejects wrong shapes", () => {
		expect(isValidDate("2024-1-01")).toBe(false);
		expect(isValidDate("2024-01-1")).toBe(false);
		expect(isValidDate("24-01-01")).toBe(false);
		expect(isValidDate("2024/01/01")).toBe(false);
		expect(isValidDate(" 2024-01-01")).toBe(false);
		expect(isValidDate("")).toBe(false);
	});
});

describe("compareDates", () => {
	it("orders across day, month and year boundaries", () => {
		expect(compareDates("2024-01-01", "2024-01-02")).toBe(-1);
		expect(compareDates("2024-01-31", "2024-02-01")).toBe(-1);
		expect(compareDates("2023-12-31", "2024-01-01")).toBe(-1);
		expect(compareDates("2024-02-01", "2024-01-31")).toBe(1);
		expect(compareDates("2025-01-01", "2024-12-31")).toBe(1);
	});

	it("returns 0 for equal dates", () => {
		expect(compareDates("2024-02-29", "2024-02-29")).toBe(0);
	});
});
