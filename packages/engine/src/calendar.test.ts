import { describe, expect, it } from "vitest";
import { addDays, dayNumber, fromDayNumber } from "./calendar";

describe("dayNumber / fromDayNumber", () => {
	it("anchors day 0 at 1970-01-01", () => {
		expect(dayNumber("1970-01-01")).toBe(0);
		expect(fromDayNumber(0)).toBe("1970-01-01");
		expect(dayNumber("1970-01-02")).toBe(1);
		expect(dayNumber("1969-12-31")).toBe(-1);
	});

	it("round-trips across the supported range", () => {
		for (const iso of [
			"0001-01-01",
			"1900-02-28",
			"2000-02-29",
			"2024-02-29",
			"9999-12-31",
		]) {
			expect(fromDayNumber(dayNumber(iso))).toBe(iso);
		}
	});
});

describe("addDays", () => {
	it("handles leap days", () => {
		expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
		expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
		expect(addDays("2023-02-28", 1)).toBe("2023-03-01");
		expect(addDays("2000-02-28", 1)).toBe("2000-02-29");
		expect(addDays("1900-02-28", 1)).toBe("1900-03-01");
		expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
	});

	it("handles month and year ends", () => {
		expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
		expect(addDays("2024-04-30", 1)).toBe("2024-05-01");
		expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
		expect(addDays("2025-01-01", -1)).toBe("2024-12-31");
		expect(addDays("2024-12-31", 365)).toBe("2025-12-31");
		expect(addDays("2024-05-10", 0)).toBe("2024-05-10");
	});

	it("rejects the day before 0001-01-01", () => {
		expect(addDays("0001-01-01", -1)).toBeUndefined();
		expect(addDays("0001-01-02", -2)).toBeUndefined();
		expect(addDays("0001-01-02", -1)).toBe("0001-01-01");
	});

	it("rejects the day after 9999-12-31", () => {
		expect(addDays("9999-12-31", 1)).toBeUndefined();
		expect(addDays("9999-12-30", 2)).toBeUndefined();
		expect(addDays("9999-12-30", 1)).toBe("9999-12-31");
	});

	it("rejects invalid input and non-integer deltas", () => {
		expect(addDays("2023-02-29", 1)).toBeUndefined();
		expect(addDays("2024-01-01", 1.5)).toBeUndefined();
		expect(addDays("2024-01-01", Number.NaN)).toBeUndefined();
	});
});
