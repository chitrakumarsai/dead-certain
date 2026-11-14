import { expect, test } from "vitest";
import { GOAL_TO_STATE, verdictStateFrom } from "./verdictState";

test.each(["paid", "reduced", "denied", "ready", "not_ready"] as const)(
	"the goal %s maps to the same state",
	(goal) => {
		expect(verdictStateFrom(goal, 0)).toBe(goal);
	},
);

test.each([
	[undefined],
	["approved"],
	[""],
	["PAID"],
	["toString"],
	["constructor"],
	["__proto__"],
	[0],
	[42],
	[true],
	[false],
])("the goal %j is undecided", (goal) => {
	expect(verdictStateFrom(goal, 3)).toBe("undecided");
});

test("the mapping table holds exactly the five known goals", () => {
	expect(Object.keys(GOAL_TO_STATE).sort()).toEqual([
		"denied",
		"not_ready",
		"paid",
		"ready",
		"reduced",
	]);
});
