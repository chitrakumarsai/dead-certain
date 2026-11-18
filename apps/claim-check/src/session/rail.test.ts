import { answer, start } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { realKb } from "../testing/realKb";
import { changeSentence, railEntries } from "./rail";

const kb = realKb();

describe("the rail", () => {
	it("lists answered, relevant facts in path order with printed values", () => {
		let s = start(kb);
		s = answer(s, "cause", "accident");
		s = answer(s, "claimed", 250_000_00);
		expect(railEntries(s).map((e) => [e.fact, e.display])).toEqual([
			["claimed", "₹2,50,000"],
			["cause", "Accident"],
		]);
	});

	it("says what changed in one sentence", () => {
		const s = start(kb);
		expect(changeSentence(s, "claimed", true)).toBe(
			`${kb.facts.claimed?.label ?? "Claimed"} changed. The verdict updated.`,
		);
	});
});
