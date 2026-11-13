import type { ProofNode } from "@dead-certain/engine/types";
import { expect, test } from "vitest";
import {
	CLAIMED_AMOUNT,
	claimVerdictFixture,
	clauseFixtures,
	deepProofFixture,
	deniedVerdictFixture,
	factDefFixtures,
	manyDeductionsFixture,
	paidInFullVerdictFixture,
	preFlightAllPassFixture,
	preFlightClauseFixtures,
	preFlightUnknownFixture,
	preFlightVerdictFixture,
	proofFixture,
	questionFixtures,
	undecidedVerdictFixture,
	unknownLineWithKnownPayableFixture,
	zeroDeductionFixture,
} from "./fixtures";

test.each([
	["claim", claimVerdictFixture, "reduced"],
	["paid in full", paidInFullVerdictFixture, "paid"],
	["denied", deniedVerdictFixture, "denied"],
])(
	"%s fixture ledger adds up: claimed minus deductions equals payable",
	(_, verdict, goal) => {
		const deductions = verdict.lineItems.reduce(
			(sum, item) => sum + Number(item.value),
			0,
		);

		expect(CLAIMED_AMOUNT - deductions).toBe(verdict.goals.payable_amount);
		expect(verdict.goals.verdict).toBe(goal);
		expect(verdict.needed).toEqual([]);
	},
);

const CLAIM_VERDICTS = {
	claimVerdictFixture,
	paidInFullVerdictFixture,
	deniedVerdictFixture,
	undecidedVerdictFixture,
	manyDeductionsFixture,
	unknownLineWithKnownPayableFixture,
	zeroDeductionFixture,
};

/**
 * Fixtures exempt from engine-faithful arithmetic, each with its reason. Do not
 * add to this list without the same: an exemption must be written down.
 */
const NOT_ENGINE_FAITHFUL: Readonly<Record<string, string>> = {
	unknownLineWithKnownPayableFixture:
		"payable is known while a deduction is not, to show the Ledger's unknown row",
};

test.each(
	Object.entries(CLAIM_VERDICTS).filter(
		([name, verdict]) =>
			!(name in NOT_ENGINE_FAITHFUL) &&
			typeof verdict.goals.payable_amount === "number",
	),
)("%s: claimed minus deductions equals payable", (_, verdict) => {
	const deductions = verdict.lineItems.filter(
		(item) => item.role === "deduction",
	);
	// A decided payable means every deduction is known.
	for (const item of deductions) {
		expect(item.value, item.fact).toEqual(expect.any(Number));
	}
	const sum = deductions.reduce((total, item) => total + Number(item.value), 0);

	expect(CLAIMED_AMOUNT - sum).toBe(verdict.goals.payable_amount);
});

test("the exempt fixture still adds up over its known deductions", () => {
	const known = unknownLineWithKnownPayableFixture.lineItems.filter(
		(item) => typeof item.value === "number",
	);
	const sum = known.reduce((total, item) => total + Number(item.value), 0);

	expect(Object.keys(NOT_ENGINE_FAITHFUL)).toEqual([
		"unknownLineWithKnownPayableFixture",
	]);
	expect(CLAIMED_AMOUNT - sum).toBe(
		unknownLineWithKnownPayableFixture.goals.payable_amount,
	);
});

test("ledger edge fixtures have their edge: 30 lines, one unknown, one zero", () => {
	expect(manyDeductionsFixture.lineItems).toHaveLength(30);
	expect(
		unknownLineWithKnownPayableFixture.lineItems.filter(
			(item) => item.value === undefined,
		),
	).toHaveLength(1);
	expect(
		zeroDeductionFixture.lineItems.filter((item) => item.value === 0),
	).toHaveLength(1);
});

test("paid in full has no deductions; denied pays nothing", () => {
	expect(paidInFullVerdictFixture.lineItems).toEqual([]);
	expect(deniedVerdictFixture.goals.payable_amount).toBe(0);
});

test("undecided fixture has no goal values and questions still needed", () => {
	expect(undecidedVerdictFixture.goals.verdict).toBeUndefined();
	expect(undecidedVerdictFixture.goals.payable_amount).toBeUndefined();
	expect(undecidedVerdictFixture.needed.length).toBeGreaterThan(0);
	for (const item of undecidedVerdictFixture.lineItems) {
		expect(item.value, item.fact).toBeUndefined();
	}
});

test("proof fixture explains a line item of the claim fixture", () => {
	const item = claimVerdictFixture.lineItems.find(
		(line) => line.fact === proofFixture.fact,
	);

	expect(item?.value).toBe(proofFixture.value);
	expect(item?.rule).toBe(proofFixture.rule);
});

test("every clause a Claim Check fixture cites has a clause fixture", () => {
	const cited = [
		...Object.values(CLAIM_VERDICTS).flatMap((verdict) =>
			verdict.lineItems.map((item) => item.clause),
		),
		...proofClauses(proofFixture),
		...proofClauses(deepProofFixture),
	];

	expect(cited.length).toBeGreaterThan(0);
	for (const id of cited) {
		expect(clauseFixtures[id]?.id, `clause ${id}`).toBe(id);
	}
});

test("Pre-Flight edge fixtures: all pass is ready; unknown is undecided and asks", () => {
	expect(preFlightAllPassFixture.goals.verdict).toBe("ready");
	expect(preFlightAllPassFixture.needed).toEqual([]);
	for (const item of preFlightAllPassFixture.lineItems) {
		expect(item.value, item.fact).toBe(true);
	}
	expect(preFlightUnknownFixture.goals.verdict).toBeUndefined();
	expect(
		preFlightUnknownFixture.lineItems.some((item) => item.value === undefined),
	).toBe(true);
	for (const question of preFlightUnknownFixture.needed) {
		const item = preFlightUnknownFixture.lineItems.find(
			(line) => line.fact === question.fact,
		);
		expect(item?.value, question.fact).toBeUndefined();
	}
});

test("every clause a Pre-Flight fixture cites has a clause fixture", () => {
	for (const { clause } of [
		preFlightVerdictFixture,
		preFlightAllPassFixture,
		preFlightUnknownFixture,
	].flatMap((verdict) => verdict.lineItems)) {
		expect(preFlightClauseFixtures[clause]?.id, `clause ${clause}`).toBe(
			clause,
		);
	}
});

test("each clause fixture is keyed by its own id and has a title and text", () => {
	for (const set of [clauseFixtures, preFlightClauseFixtures]) {
		for (const [key, clause] of Object.entries(set)) {
			expect(clause.id).toBe(key);
			expect(clause.title).not.toBe("");
			expect(clause.text).not.toBe("");
		}
	}
});

function proofClauses(node: ProofNode): string[] {
	return [
		...(node.clause ? [node.clause] : []),
		...node.children.flatMap(proofClauses),
	];
}

test("every question fixture asks about a fact with a definition", () => {
	const questions = Object.values(questionFixtures);

	expect(questions.length).toBeGreaterThan(0);
	for (const question of questions) {
		expect(factDefFixtures[question.fact], question.fact).toBeDefined();
		expect(questionFixtures[question.fact]).toBe(question);
	}
});

test("question fixtures cover all five control types", () => {
	const types = new Set(
		Object.values(questionFixtures).map((q) => factDefFixtures[q.fact]?.type),
	);

	expect([...types].sort()).toEqual([
		"boolean",
		"date",
		"enum",
		"money",
		"number",
	]);
});

test("fact definitions cover all five types, and check facts are boolean", () => {
	const defs = Object.values(factDefFixtures);
	const types = new Set(defs.map((def) => def.type));

	expect([...types].sort()).toEqual([
		"boolean",
		"date",
		"enum",
		"money",
		"number",
	]);
	for (const def of defs) {
		if (def.type === "enum") expect(def.options?.length).toBeGreaterThan(1);
		if (def.role === "check") expect(def.type).toBe("boolean");
	}
	for (const { fact } of preFlightVerdictFixture.lineItems) {
		expect(factDefFixtures[fact]?.role, fact).toBe("check");
	}
});
