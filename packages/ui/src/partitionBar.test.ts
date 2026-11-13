import { expect, test } from "vitest";
import { partitionBar } from "./components/partitionBar";

test.each<[string, number, number[], number[], number]>([
	["all paid", 210_000, [210_000], [210_000], 0],
	["one cut", 210_000, [172_000, 38_000], [172_000, 38_000], 0],
	[
		"many cuts",
		210_000,
		[142_500, 38_000, 29_500],
		[142_500, 38_000, 29_500],
		0,
	],
	["all cut", 210_000, [0, 210_000], [0, 210_000], 0],
	["zero parts", 210_000, [], [], 210_000],
	["parts short of the total", 100, [30, 20], [30, 20], 50],
	["over-sum clamps in order, no remainder", 100, [60, 70, 10], [60, 40, 0], 0],
	["negative parts clamp to 0", 100, [-5, 40], [0, 40], 60],
	["non-integer parts clamp to 0", 100, [12.5, 40, Number.NaN], [0, 40, 0], 60],
	[
		"infinite parts clamp to 0",
		100,
		[Number.POSITIVE_INFINITY, 40],
		[0, 40],
		60,
	],
])("%s", (_name, total, values, parts, remainder) => {
	expect(partitionBar(total, values)).toEqual({ parts, remainder });
});

test.each([0, -100, 12.5, Number.NaN])(
	"a total of %s that is not a positive integer gives an empty bar",
	(total) => {
		expect(partitionBar(total, [10, 20])).toEqual({
			parts: [0, 0],
			remainder: 0,
		});
	},
);

test("does not change the list it is given", () => {
	const values = Object.freeze([60, 70]);

	partitionBar(100, values);

	expect(values).toEqual([60, 70]);
});
