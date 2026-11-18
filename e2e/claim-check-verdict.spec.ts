import { VERDICT_WORDS } from "@dead-certain/ui";
import { answerInUi, money, verdictFor } from "./claim-check-engine";
import { openClaimCheck, startCheck } from "./claim-check-helpers";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const BASE = {
	claimed: 2_00_000_00,
	cause: "accident",
	treatment: "other",
	treated_outside_india: false,
	annexure_items: 0,
	room_rent_per_day: 4_000_00,
	sum_insured: "rs_500000",
	room_days: 5,
	age: 40,
	paid_this_year: 0,
};
const CASES = {
	paid: BASE,
	reduced: {
		...BASE,
		annexure_items: 2_000_00,
		room_rent_per_day: 6_000_00,
		age: 65,
	},
	denied: { ...BASE, treatment: "cosmetic" },
} as const;

for (const [state, answers] of Object.entries(CASES)) {
	test(`a ${state} claim shows its word, statement and ledger`, async ({
		page,
	}) => {
		const verdict = verdictFor(answers);
		expect(verdict.goals.outcome).toBe(state);
		await startCheck(page);
		await answerInUi(page, answers);
		await expect(
			page.locator("main").getByText("That is enough to decide"),
		).toBeVisible();
		const headline = page.getByRole("heading", { level: 1 });
		await expect(headline).toContainText(VERDICT_WORDS[state as "paid"]);
		const payable = verdict.goals.payable as number;
		await expect(headline).toContainText(
			`${money(payable)} of ${money(answers.claimed)} will be paid`,
		);
		for (const item of verdict.lineItems.filter(
			(i) => i.role === "deduction" && i.value !== 0,
		))
			await expect(page.getByRole("table").getByText(item.label)).toBeVisible();
		await expectNoAxeViolations(page);
	});
}

test("what-if shows a signed change, and is left out when empty", async ({
	page,
}) => {
	await startCheck(page);
	await answerInUi(page, CASES.reduced);
	await expect(
		page.getByRole("heading", { name: "What would change this" }),
	).toBeVisible();
	await expect(
		page
			.locator("main")
			.getByText(/[+−] ?₹/)
			.first(),
	).toBeVisible();
});

test("Start over returns to the start screen and clears the fragment", async ({
	page,
}) => {
	await startCheck(page);
	await answerInUi(page, CASES.denied);
	expect(new URL(page.url()).hash).toMatch(/^#\/\?r=/);
	await page.getByRole("button", { name: "Start over" }).click();
	await expect(
		page.getByRole("button", { name: "Start the check" }),
	).toBeVisible();
	expect(new URL(page.url()).hash).toBe("#/");
});

test("a replay link opens the verdict without 'That is enough to decide'", async ({
	page,
}) => {
	await startCheck(page);
	await answerInUi(page, CASES.denied);
	const hash = new URL(page.url()).hash;
	const other = await page.context().newPage();
	await openClaimCheck(other, hash);
	await expect(other.getByRole("heading", { level: 1 })).toContainText(
		VERDICT_WORDS.denied,
	);
	await expect(other.getByText("That is enough to decide")).toHaveCount(0);
	await expect(other.getByRole("button", { name: "Continue" })).toHaveCount(0);
});

test("a printed verdict hides the controls and fits one page", async ({
	page,
}) => {
	await startCheck(page);
	await answerInUi(page, CASES.reduced);
	await page.emulateMedia({ media: "print" });
	await expect(
		page.getByRole("button", { name: "See why", exact: true }),
	).toBeHidden();
	const pdf = await page.pdf({ format: "A4" });
	const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [])
		.length;
	expect(pages).toBe(1);
});
