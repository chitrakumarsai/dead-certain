import type { FactDef } from "@dead-certain/engine/types";
import { expect, test } from "vitest";
import { humanize } from "./format/label";
import {
	defaultLocale,
	formatMoney,
	minorDigits,
	parseMoney,
} from "./format/money";
import { formatDate, formatValue } from "./format/value";

const INR = { currency: "INR" };

test("formats INR minor units with Indian grouping", () => {
	expect(formatMoney(14250000, "INR")).toBe("₹1,42,500");
	expect(formatMoney(21000000, "INR", "en-IN")).toBe("₹2,10,000");
});

test("whole amounts omit fraction digits and others print all of them", () => {
	expect(formatMoney(600000, "INR")).toBe("₹6,000");
	expect(formatMoney(600050, "INR")).toBe("₹6,000.50");
	expect(formatMoney(5, "USD")).toBe("$0.05");
	expect(formatMoney(0, "INR")).toBe("₹0");
	expect(formatMoney(1500, "JPY")).toBe("¥1,500");
});

test("currencies carry their own fraction digits and default locale", () => {
	expect(minorDigits("INR", "en-IN")).toBe(2);
	expect(minorDigits("JPY", "en")).toBe(0);
	expect(defaultLocale("INR")).toBe("en-IN");
	expect(defaultLocale("USD")).toBe("en");
});

test("parses typed amounts into integer minor units", () => {
	expect(parseMoney("6,000", "INR", "en-IN")).toEqual({
		ok: true,
		minor: 600000,
	});
	expect(parseMoney(" 1 42 500 ", "INR", "en-IN")).toEqual({
		ok: true,
		minor: 14250000,
	});
	expect(parseMoney("0.1", "INR", "en-IN")).toEqual({ ok: true, minor: 10 });
	expect(parseMoney("12.", "INR", "en-IN")).toEqual({ ok: true, minor: 1200 });
	expect(parseMoney("0", "INR", "en-IN")).toEqual({ ok: true, minor: 0 });
	expect(parseMoney("1500", "JPY", "en")).toEqual({ ok: true, minor: 1500 });
});

test("parses its own formatted output, currency symbol included", () => {
	expect(parseMoney("₹1,42,500", "INR", "en-IN")).toEqual({
		ok: true,
		minor: 14250000,
	});
	expect(parseMoney("$0.05", "USD", "en")).toEqual({ ok: true, minor: 5 });
});

test("0.1 + 0.2 style amounts never pick up float error", () => {
	expect(parseMoney("0.07", "USD", "en")).toEqual({ ok: true, minor: 7 });
	expect(parseMoney("1.15", "USD", "en")).toEqual({ ok: true, minor: 115 });
	expect(parseMoney("4.35", "USD", "en")).toEqual({ ok: true, minor: 435 });
});

test.each([
	["", "empty"],
	["   ", "empty"],
	["abc", "format"],
	["-5", "format"],
	["1.2.3", "format"],
	[".5", "format"],
	["1e5", "format"],
	["$5", "format"],
	["1.234", "decimals"],
	["99999999999999999999", "format"],
])("rejects %j with reason %s", (text, reason) => {
	expect(parseMoney(text, "INR", "en-IN")).toEqual({ ok: false, reason });
});

test("JPY allows no decimal digits", () => {
	expect(parseMoney("1500.5", "JPY", "en")).toEqual({
		ok: false,
		reason: "decimals",
	});
});

test("humanize follows the engine rule", () => {
	expect(humanize("room_rent_per_day")).toBe("Room rent per day");
	expect(humanize("verdict")).toBe("Verdict");
	expect(humanize("")).toBe("");
	expect(humanize("ICU_days")).toBe("ICU days");
});

test("formatDate prints the named calendar day", () => {
	expect(formatDate("2026-11-13")).toBe("13 Nov 2026");
	expect(formatDate("2024-02-29", "en-US")).toBe("Feb 29, 2024");
});

test.each<[FactDef, boolean | number | string | undefined, string]>([
	[{ type: "money" }, 14250000, "₹1,42,500"],
	[{ type: "number" }, 4, "4"],
	[{ type: "number" }, 1234567.5, "12,34,567.5"],
	[{ type: "boolean" }, true, "Yes"],
	[{ type: "boolean" }, false, "No"],
	[{ type: "enum", options: ["semi_private"] }, "semi_private", "Semi private"],
	[{ type: "date" }, "2026-01-31", "31 Jan 2026"],
	[{ type: "money" }, undefined, "Not known yet"],
	[{ type: "boolean" }, undefined, "Not known yet"],
])("formatValue(%j, %j) is %j", (def, value, expected) => {
	expect(formatValue(def, value, INR)).toBe(expected);
});

test("text is passed through with no placeholder substitution and no markup", () => {
	expect(formatValue({ type: "enum" }, "above {x} <b>limit</b>", INR)).toBe(
		"Above {x} <b>limit</b>",
	);
	expect(formatValue({ type: "date" }, "not a date", INR)).toBe("not a date");
});

test("formatValue falls back to plain text when the value does not fit the type", () => {
	expect(formatValue({ type: "money" }, "n/a", INR)).toBe("n/a");
	expect(formatValue({ type: "money" }, 500, {})).toBe("500");
});
