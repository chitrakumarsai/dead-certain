import type {
	Alternative,
	Clause,
	FactDef,
	ProofNode,
	Question,
	Verdict,
} from "@dead-certain/engine/types";
import { expect, expectTypeOf, test } from "vitest";
import * as fixtures from "./fixtures";
import type { AnswerEntry, FormatContext, SkippedNote } from "./types";

test("every fixture export is annotated with its contract type", () => {
	expectTypeOf(fixtures.CLAIMED_AMOUNT).toEqualTypeOf<number>();
	expectTypeOf(fixtures.claimFormat).toEqualTypeOf<FormatContext>();
	expectTypeOf(fixtures.questionFixture).toEqualTypeOf<Question>();
	expectTypeOf(fixtures.questionFixtures).toEqualTypeOf<
		Readonly<Record<string, Question>>
	>();
	expectTypeOf(fixtures.factDefFixtures).toEqualTypeOf<
		Readonly<Record<string, FactDef>>
	>();
	expectTypeOf(fixtures.clauseFixtures).toEqualTypeOf<
		Readonly<Record<string, Clause>>
	>();
	expectTypeOf(fixtures.preFlightClauseFixtures).toEqualTypeOf<
		Readonly<Record<string, Clause>>
	>();
	expectTypeOf(fixtures.answersFixture).toEqualTypeOf<readonly AnswerEntry[]>();
	expectTypeOf(fixtures.skippedFixture).toEqualTypeOf<readonly SkippedNote[]>();
	expectTypeOf(fixtures.alternativesFixture).toEqualTypeOf<
		readonly Alternative[]
	>();
	expectTypeOf(fixtures.alternativesNoMoneyFixture).toEqualTypeOf<
		readonly Alternative[]
	>();
	for (const verdict of [
		fixtures.claimVerdictFixture,
		fixtures.paidInFullVerdictFixture,
		fixtures.deniedVerdictFixture,
		fixtures.undecidedVerdictFixture,
		fixtures.manyDeductionsFixture,
		fixtures.unknownLineWithKnownPayableFixture,
		fixtures.zeroDeductionFixture,
		fixtures.preFlightVerdictFixture,
		fixtures.preFlightAllPassFixture,
		fixtures.preFlightUnknownFixture,
	]) {
		expectTypeOf(verdict).toEqualTypeOf<Verdict>();
	}
	for (const proof of [
		fixtures.proofFixture,
		fixtures.deepProofFixture,
		fixtures.hugeProofFixture,
		fixtures.collectedProofFixture,
		fixtures.unknownValueProofFixture,
	]) {
		expectTypeOf(proof).toEqualTypeOf<ProofNode>();
	}
});

test("the type audit above covers every export, so a new one cannot slip past", () => {
	expect(Object.keys(fixtures).sort()).toEqual(
		[
			"CLAIMED_AMOUNT",
			"claimFormat",
			"questionFixture",
			"questionFixtures",
			"factDefFixtures",
			"clauseFixtures",
			"preFlightClauseFixtures",
			"answersFixture",
			"skippedFixture",
			"alternativesFixture",
			"alternativesNoMoneyFixture",
			"claimVerdictFixture",
			"paidInFullVerdictFixture",
			"deniedVerdictFixture",
			"undecidedVerdictFixture",
			"manyDeductionsFixture",
			"unknownLineWithKnownPayableFixture",
			"zeroDeductionFixture",
			"preFlightVerdictFixture",
			"preFlightAllPassFixture",
			"preFlightUnknownFixture",
			"proofFixture",
			"deepProofFixture",
			"hugeProofFixture",
			"collectedProofFixture",
			"unknownValueProofFixture",
		].sort(),
	);
});

test("claimFormat formats Claim Check money in rupees", () => {
	expect(fixtures.claimFormat).toEqual({ currency: "INR" });
});
