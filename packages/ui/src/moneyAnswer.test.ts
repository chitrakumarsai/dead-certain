import { expect, test } from "vitest";
import {
	ANSWER_MESSAGES,
	dateAnswer,
	emptyAnswerMessage,
	moneyAnswer,
	numberAnswer,
} from "./components/answerMessages";

const INR = { currency: "INR" };

test.each([
	["", undefined, { value: undefined, problem: "Enter an amount." }],
	["   ", undefined, { value: undefined, problem: "Enter an amount." }],
	[".", undefined, { value: undefined, problem: ANSWER_MESSAGES.moneyFormat }],
	[
		"1.234",
		undefined,
		{ value: undefined, problem: "Use at most 2 decimal places." },
	],
	["1,42,500", undefined, { value: 14250000 }],
	["0", undefined, { value: 0 }],
	["0", 1, { value: undefined, problem: "Enter an amount above zero." }],
	["0.50", 1, { value: 50 }],
	[
		"499",
		50000,
		{ value: undefined, problem: "Enter an amount of at least ₹500." },
	],
	["500", 50000, { value: 50000 }],
])("moneyAnswer(%j, min %s)", (raw, min, expected) => {
	expect(moneyAnswer(raw, INR, min)).toEqual(expected);
});

test("the decimals message takes its number from the currency", () => {
	expect(moneyAnswer("1.5", { currency: "JPY" }).problem).toBe(
		"Use whole amounts only.",
	);
	expect(moneyAnswer("1.234", { currency: "USD" }).problem).toBe(
		"Use at most 2 decimal places.",
	);
});

test.each([
	["", { value: undefined, problem: "Enter a number." }],
	["abc", { value: undefined, problem: "Enter a number." }],
	["4.", { value: undefined, problem: "Enter a number." }],
	["1e3", { value: undefined, problem: "Enter a number." }],
	["4", { value: 4 }],
	[" 4.5 ", { value: 4.5 }],
	["1,200", { value: 1200 }],
	["-2", { value: -2 }],
	["0", { value: 0 }],
])("numberAnswer(%j)", (raw, expected) => {
	expect(numberAnswer(raw)).toEqual(expected);
});

test.each([
	["", { value: undefined, problem: "Pick a date." }],
	["2026-02-30", { value: undefined, problem: "Pick a date." }],
	["13/11/2026", { value: undefined, problem: "Pick a date." }],
	["2026-11-13", { value: "2026-11-13" }],
	["2024-02-29", { value: "2024-02-29" }],
])("dateAnswer(%j)", (raw, expected) => {
	expect(dateAnswer(raw)).toEqual(expected);
});

test.each([
	["boolean", "Choose one answer."],
	["enum", "Choose one answer."],
	["money", "Enter an amount."],
	["number", "Enter a number."],
	["date", "Pick a date."],
] as const)("an unanswered %s fact says %j", (type, message) => {
	expect(emptyAnswerMessage(type)).toBe(message);
});
