import type { ProofNode } from "@dead-certain/engine/types";
import { expect, test } from "vitest";
import {
	CLAIMED_AMOUNT,
	claimVerdictFixture,
	clauseFixtures,
	deepProofFixture,
	preFlightClauseFixtures,
	preFlightVerdictFixture,
	proofFixture,
} from "./fixtures";

test("claim fixture ledger adds up: claimed minus deductions equals payable", () => {
	const deductions = claimVerdictFixture.lineItems.reduce(
		(sum, item) => sum + Number(item.value),
		0,
	);

	expect(CLAIMED_AMOUNT - deductions).toBe(
		claimVerdictFixture.goals.payable_amount,
	);
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
		...claimVerdictFixture.lineItems.map((item) => item.clause),
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
