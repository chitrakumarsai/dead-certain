import { expect, test } from "vitest";
import { CLAIMED_AMOUNT, claimVerdictFixture, proofFixture } from "./fixtures";

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
