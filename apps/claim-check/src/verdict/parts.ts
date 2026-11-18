import type { LineItem, Session, Verdict } from "@dead-certain/engine";
import type { ProportionPart } from "@dead-certain/ui";
import { config } from "../config";
import { labelFor } from "../kb";

const money = (v: unknown): number | undefined =>
	typeof v === "number" ? v : undefined;

/** Non-zero deduction lines, unknown ones included (6.4, 6.6). */
export const deductions = (verdict: Verdict): LineItem[] =>
	verdict.lineItems.filter(
		(item) => item.role === "deduction" && item.value !== 0,
	);

export interface LedgerData {
	claimed: { label: string; value: number };
	items: LineItem[];
	payable: { label: string; value: number };
}

/** The ledger's three parts, or null before the claimed and payable amounts are known. */
export function ledgerFrom(s: Session, verdict: Verdict): LedgerData | null {
	const claimed = money(s.answers[config.claimedFact]);
	const payable = money(verdict.goals[config.amountGoal]);
	if (claimed === undefined || payable === undefined) return null;
	return {
		claimed: { label: labelFor(s.kb, config.claimedFact), value: claimed },
		items: deductions(verdict),
		payable: { label: labelFor(s.kb, config.amountGoal), value: payable },
	};
}

/** One paid part and one cut per known deduction; empty when nothing was claimed (6.3). */
export function partsFrom(ledger: LedgerData): ProportionPart[] {
	if (ledger.claimed.value === 0) return [];
	const cuts = ledger.items.flatMap((item) =>
		typeof item.value === "number"
			? [{ kind: "cut" as const, value: item.value, label: item.label }]
			: [],
	);
	return [
		{ kind: "paid", value: ledger.payable.value, label: "Paid" },
		...cuts,
	];
}
