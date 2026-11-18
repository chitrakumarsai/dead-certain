import {
	answer,
	type FactValue,
	next,
	type Session,
	start,
} from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { realKb } from "../testing/realKb";
import { toyKb } from "../testing/toyKb";
import { questionPath } from "./path";
import { progress } from "./progress";
import { relevantFacts, skippedNotes, updateSkipped } from "./relevance";

const kb = realKb();

function answerAll(values: Record<string, FactValue>): Session {
	return Object.entries(values).reduce(
		(s, [fact, value]) => answer(s, fact, value),
		start(kb),
	);
}

const ACCIDENT = {
	claimed: 250_000_00,
	cause: "accident",
	treatment: "other",
	treated_outside_india: false,
};

const ILLNESS = {
	claimed: 250_000_00,
	cause: "illness",
	policy_start_date: "2021-04-01",
	illness_start_date: "2024-06-10",
	treatment: "other",
};

describe("questionPath", () => {
	it("lists the facts asked, in order, with the open question last", () => {
		expect(questionPath(kb, ACCIDENT)).toEqual([
			"claimed",
			"cause",
			"treatment",
			"treated_outside_india",
			"annexure_items",
		]);
	});

	it("is empty-free from the start and ends at a verdict", () => {
		expect(questionPath(kb, {})).toEqual(["claimed"]);
		const denied = {
			claimed: 100_00,
			cause: "accident",
			treatment: "cosmetic",
		};
		expect(next(answerAll(denied)).kind).toBe("verdict");
		expect(questionPath(kb, denied)).toEqual(["claimed", "cause", "treatment"]);
	});
});

describe("relevance and skipped notes", () => {
	const toy = toyKb();
	const covered = answer(answer(start(toy), "covered", true), "amount", 40);

	it("notes an answer that a change makes unnecessary", () => {
		const after = answer(covered, "covered", false);
		expect(relevantFacts(covered)).toEqual(new Set(["covered", "amount"]));
		expect(relevantFacts(after)).toEqual(new Set(["covered"]));
		expect(skippedNotes(covered, after, "covered")).toEqual([
			{
				fact: "amount",
				label: "Amount",
				reason: "Not needed now that Covered is No.",
			},
		]);
	});

	it("removes the note when the change is undone, and keeps the answer", () => {
		const after = answer(covered, "covered", false);
		const skipped = updateSkipped([], covered, after, "covered");
		expect(skipped).toHaveLength(1);
		const back = answer(after, "covered", true);
		expect(updateSkipped(skipped, after, back, "covered")).toEqual([]);
		expect(after.answers.amount).toBe(40);
	});

	it("drops the illness dates, with a note, when the cause changes to an accident", () => {
		const before = answerAll(ILLNESS);
		const after = answer(before, "cause", "accident");
		expect(relevantFacts(before)).toContain("policy_start_date");
		expect(relevantFacts(after)).not.toContain("policy_start_date");
		const notes = skippedNotes(before, after, "cause");
		expect(notes.map((n) => n.fact).sort()).toEqual([
			"illness_start_date",
			"policy_start_date",
		]);
		expect(notes[0]?.reason).toBe(
			"Not needed now that Cause of admission is Accident.",
		);
	});

	it("adds the current question to the relevant set", () => {
		expect(relevantFacts(start(kb), "claimed")).toEqual(new Set(["claimed"]));
	});
});

describe("progress", () => {
	it("counts the position in the path and bounds what is left", () => {
		const p = progress(kb, ACCIDENT, "annexure_items");
		expect(p.index).toBe(5);
		const askable = Object.values(kb.facts).filter((d) => !d.derived && d.ask);
		expect(p.moreAtMost).toBe(
			askable.length - Object.keys(ACCIDENT).length - 1,
		);
	});

	it("keeps the position of a fact being changed", () => {
		expect(progress(kb, ACCIDENT, "cause").index).toBe(2);
	});
});
