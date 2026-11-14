import type { FactDef } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { checkValue, describeValue, isCalendarDate } from "./values";

const def = (type: FactDef["type"], options?: string[]): FactDef =>
	({ type, ...(options ? { options } : {}) }) as FactDef;

describe("isCalendarDate", () => {
	it.each(["2024-02-29", "2000-02-29", "2023-12-31", "0001-01-01"])(
		"accepts %s",
		(text) => expect(isCalendarDate(text)).toBe(true),
	);

	it.each([
		"2023-02-29",
		"1900-02-29",
		"2024-13-01",
		"2024-00-10",
		"0000-01-01",
		"2024-1-1",
		"2024-02-30",
		"2024-04-31",
		"2024-02-00",
		"24-02-02",
		"2024-02-02T00:00",
		"",
	])("rejects %s", (text) => expect(isCalendarDate(text)).toBe(false));
});

describe("checkValue", () => {
	it("checks a boolean", () => {
		expect(checkValue(def("boolean"), true)).toBeUndefined();
		expect(checkValue(def("boolean"), "true")).toBe("a boolean");
		expect(checkValue(def("boolean"), 1)).toBe("a boolean");
	});

	it("checks a number", () => {
		expect(checkValue(def("number"), 2.5)).toBeUndefined();
		expect(checkValue(def("number"), -0)).toBeUndefined();
		expect(checkValue(def("number"), Number.NaN)).toBe("a number");
		expect(checkValue(def("number"), Number.POSITIVE_INFINITY)).toBe(
			"a number",
		);
		expect(checkValue(def("number"), "3")).toBe("a number");
	});

	it("checks money as a safe integer in minor units", () => {
		expect(checkValue(def("money"), 14250000)).toBeUndefined();
		expect(checkValue(def("money"), 0)).toBeUndefined();
		expect(checkValue(def("money"), -0)).toBeUndefined();
		expect(checkValue(def("money"), 1.5)).toBe("a whole number of minor units");
		expect(checkValue(def("money"), 1e21)).toBe(
			"a whole number of minor units",
		);
		expect(checkValue(def("money"), 2 ** 53)).toBe(
			"a whole number of minor units",
		);
		expect(checkValue(def("money"), "100")).toBe(
			"a whole number of minor units",
		);
	});

	it("checks a date", () => {
		expect(checkValue(def("date"), "2024-02-29")).toBeUndefined();
		expect(checkValue(def("date"), "2023-02-29")).toBe(
			"a date written YYYY-MM-DD",
		);
		expect(checkValue(def("date"), 20240229)).toBe("a date written YYYY-MM-DD");
	});

	it("checks an enum against its options and lists them in order", () => {
		const d = def("enum", ["gold", "silver", "bronze"]);

		expect(checkValue(d, "silver")).toBeUndefined();
		expect(checkValue(d, "platinum")).toBe("one of gold, silver, bronze");
		expect(checkValue(d, 1)).toBe("one of gold, silver, bronze");
	});
});

describe("describeValue", () => {
	it("prints unknown, text, numbers and booleans", () => {
		expect(describeValue(null)).toBe("unknown");
		expect(describeValue(undefined)).toBe("unknown");
		expect(describeValue("x")).toBe("x");
		expect(describeValue(7)).toBe("7");
		expect(describeValue(true)).toBe("true");
	});

	it("never throws on a value that is not a fact value", () => {
		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;

		expect(describeValue(0n as never)).toBe("0n");
		expect(describeValue(cycle as never)).toBe("[value that cannot be shown]");
	});
});
