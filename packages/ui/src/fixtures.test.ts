import type { ProofNode } from "@dead-certain/engine/types";
import { expect, test } from "vitest";
import {
	CLAIMED_AMOUNT,
	claimVerdictFixture,
	clauseFixtures,
	deepProofFixture,
	deniedVerdictFixture,
	factDefFixtures,
	paidInFullVerdictFixture,
	preFlightClauseFixtures,
	preFlightVerdictFixture,
	proofFixture,
	questionFixtures,
	undecidedVerdictFixture,
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
		...[
			claimVerdictFixture,
			paidInFullVerdictFixture,
			deniedVerdictFixture,
			undecidedVerdictFixture,
		].flatMap((verdict) => verdict.lineItems.map((item) => item.clause)),
		...proofClauses(proofFixture),
		...proofClauses(deepProofFixture),
	];

	expect(cited.length).toBeGreaterThan(0);
	for (const id of cited) {
		expect(clauseFixtures[id]?.id, `clause ${id}`).toBe(id);
	}
});

test("every clause the Pre-Flight fixture cites has a clause fixture", () => {
	for (const { clause } of preFlightVerdictFixture.lineItems) {
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
