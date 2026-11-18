// One test per golden scenario, driven through the real interface (requirement 15).
// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync } from "node:fs";
import type { FactValue } from "@dead-certain/engine";
import { loadGolden, type Scenario } from "@dead-certain/kb-tools";
import { humanize, VERDICT_WORDS } from "@dead-certain/ui";
import type { Page } from "@playwright/test";
import { answerInUi, claimKb, money } from "./claim-check-engine";
import {
	openClaimCheck,
	questionHeading,
	startCheck,
} from "./claim-check-helpers";
import { expect, test } from "./kit-fixtures";

const DIR = new URL("../apps/claim-check/golden/", import.meta.url);
const files = (readdirSync(DIR) as string[]).filter((f) => /\.ya?ml$/.test(f));
const scenarios: Scenario[] = files.flatMap((file) => {
	const loaded = loadGolden(
		readFileSync(new URL(file, DIR), "utf8") as string,
		file,
	);
	if (!loaded.ok)
		throw new Error(`${file}: ${JSON.stringify(loaded.diagnostics)}`);
	return [...loaded.set.scenarios];
});

const labelOf = (fact: string) => claimKb.facts[fact]?.label ?? humanize(fact);

test("the golden folder holds consult scenarios", () => {
	expect(files.length, "files in apps/claim-check/golden").toBeGreaterThan(0);
	expect(scenarios.filter((s) => s.mode === "consult").length).toBeGreaterThan(
		0,
	);
});

test("no two facts share an ask text", () => {
	const seen = new Map<string, string>();
	for (const [fact, def] of Object.entries(claimKb.facts)) {
		if (def.ask === undefined) continue;
		expect(
			seen.get(def.ask),
			`${fact} asks the same as ${seen.get(def.ask)}`,
		).toBeUndefined();
		seen.set(def.ask, fact);
	}
});

/** Rule ids of `want` not yet in `text`. */
const missingFrom = (text: string, want: readonly string[]) =>
	want.filter((id) => !text.includes(id));

/**
 * Expands the open proof by keyboard, row by row, until every id in `want`
 * shows or the last row is reached, and returns the tree's text.
 */
async function proofText(page: Page, want: readonly string[]): Promise<string> {
	const tree = page.getByRole("tree", { name: "Proof" });
	await tree.getByRole("treeitem").first().focus();
	for (let i = 0; i < 400; i++) {
		// One round trip per key: is everything shown, is this row closed, or was it seen?
		const row = await page.evaluate((ids) => {
			const text = document.querySelector('[role="tree"]')?.textContent ?? "";
			if (ids.every((id) => text.includes(id))) return "done";
			const el = document.activeElement as HTMLElement | null;
			if (el?.getAttribute("aria-expanded") === "false") return "closed";
			if (el?.dataset.walked === "1") return "done";
			if (el) el.dataset.walked = "1";
			return "next";
		}, want);
		if (row === "done") break;
		await page.keyboard.press(row === "closed" ? "ArrowRight" : "ArrowDown");
	}
	return (await tree.textContent()) ?? "";
}

/** The verdict's proof, then each ledger line's proof, until every id in `want` has shown. */
async function proofsShowing(
	page: Page,
	want: readonly string[],
): Promise<string> {
	const openers = [
		page.getByRole("button", { name: "See why", exact: true }),
		...(await page.getByRole("table").getByRole("button").all()),
	];
	let text = "";
	for (const opener of openers) {
		const left = missingFrom(text, want);
		if (left.length === 0) break;
		await opener.click();
		text += await proofText(page, left);
		await page.keyboard.press("Escape");
		await expect(page.getByRole("tree", { name: "Proof" })).toHaveCount(0);
	}
	return text;
}

async function expectVerdict(page: Page, s: Scenario) {
	if ("ask" in s.expect) return;
	const outcome = s.expect.goals.outcome as keyof typeof VERDICT_WORDS;
	const payable = s.expect.goals.payable as number;
	const headline = page.getByRole("heading", { level: 1 });
	await expect(headline).toContainText(VERDICT_WORDS[outcome]);
	await expect(headline).toContainText(
		`${money(payable)} of ${money(s.facts.claimed as number)} will be paid`,
	);
	const rows = Object.entries(s.expect.lineItems ?? {}).filter(
		([, v]) => v !== 0,
	);
	const ledger = page.getByRole("table");
	// tbody holds the claimed row and one row per deduction.
	await expect(ledger.locator("tbody tr")).toHaveCount(rows.length + 1);
	for (const [fact, value] of rows) {
		const row = ledger.locator("tbody tr").filter({ hasText: labelOf(fact) });
		await expect(row).toHaveCount(1);
		if (typeof value === "number")
			await expect(row).toContainText(money(value));
	}
	await expect(ledger.locator("tfoot")).toContainText(money(payable));
}

for (const s of scenarios) {
	test(`${s.id}: ${s.title}`, async ({ page, context }) => {
		test.skip(s.mode === "audit", "Claim Check runs consultation only");
		// A whole consultation, its proofs and a replay: three times the usual limit.
		test.slow();
		const answers = s.facts as Readonly<Record<string, FactValue>>;
		await startCheck(page);
		if ("ask" in s.expect) {
			await answerInUi(page, answers, s.expect.ask);
			await expect(questionHeading(page)).toHaveText(
				claimKb.facts[s.expect.ask]?.ask ?? "",
			);
			await expect(page.getByRole("table")).toHaveCount(0);
			return;
		}
		await answerInUi(page, answers);
		await expectVerdict(page, s);

		const fires = s.expect.fires ?? [];
		const proofs = await proofsShowing(page, fires);
		expect(
			missingFrom(proofs, fires),
			"fired rules missing from the proofs",
		).toEqual([]);

		const ledger = await page.getByRole("table").textContent();
		const replay = await context.newPage();
		await openClaimCheck(replay, new URL(page.url()).hash);
		await expectVerdict(replay, s);
		expect(await replay.getByRole("table").textContent()).toBe(ledger);
	});
}
