import { expect, test } from "vitest";
import {
	ANSWER_MESSAGES,
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
