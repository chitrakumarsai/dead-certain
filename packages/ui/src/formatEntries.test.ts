import { expect, test } from "vitest";
import { answersFixture, factDefFixtures } from "./fixtures";
import { formatEntries } from "./format/entries";

const FORMAT = { currency: "INR" };

test("each answer gets the fact's label, or a name derived from the fact", () => {
	const entries = formatEntries(
		{ room_rent_per_day: 600000, is_public: true },
		{
			room_rent_per_day: { type: "money" },
			is_public: { type: "boolean", label: "Public repository" },
		},
		FORMAT,
	);

	expect(entries).toEqual([
		{
			fact: "room_rent_per_day",
			label: "Room rent per day",
			display: "₹6,000",
			value: 600000,
		},
		{
			fact: "is_public",
			label: "Public repository",
			display: "Yes",
			value: true,
		},
	]);
});

test("answers without a definition are left out, never guessed", () => {
	expect(formatEntries({ mystery: 3 }, {}, FORMAT)).toEqual([]);
});

test("the answers fixture is what formatEntries prints for its values", () => {
	const answers = Object.fromEntries(
		answersFixture.map((entry) => [entry.fact, entry.value]),
	);

	expect(formatEntries(answers, factDefFixtures, FORMAT)).toEqual(
		answersFixture,
	);
});
