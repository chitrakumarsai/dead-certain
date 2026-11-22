import {
	audit,
	type FactValue,
	type KnowledgeBase,
	type LineItem,
	type Session,
	type Verdict,
} from "@dead-certain/engine";
import {
	type AnswerEntry,
	formatEntries,
	formatMoney,
	type ProportionPart,
	type VerdictState,
	verdictStateFrom,
} from "@dead-certain/ui";
import { formatFor, labelFor } from "../kb";
import { AMOUNT_GOAL, CLAIMED_FACT, HERO_FACTS, STATE_GOAL } from "./config";

export interface LedgerData {
	claimed: { label: string; value: number };
	items: LineItem[];
	payable: { label: string; value: number };
}

export interface HeroModel {
	session: Session;
	verdict: Verdict;
	state: VerdictState;
	/** "₹1,32,000 of ₹2,10,000 will be paid" */
	statement: string;
	ledger: LedgerData;
	parts: ProportionPart[];
	answers: AnswerEntry[];
}

export type HeroFailure = {
	kind: "failed";
	reason: "kb_mismatch" | "engine_error" | "ledger_mismatch";
};

const failed = (reason: HeroFailure["reason"]): HeroFailure => ({
	kind: "failed",
	reason,
});

/** Non-zero deduction lines (copied from apps/claim-check/src/verdict/parts.ts). */
const deductions = (verdict: Verdict): LineItem[] =>
	verdict.lineItems.filter(
		(item) => item.role === "deduction" && item.value !== 0,
	);

/** One paid part and one cut per deduction (copied from verdict/parts.ts). */
function partsFrom(ledger: LedgerData): ProportionPart[] {
	const cuts = ledger.items.map((item) => ({
		kind: "cut" as const,
		value: item.value as number,
		label: item.label,
	}));
	return [
		{ kind: "paid", value: ledger.payable.value, label: "Paid" },
		...cuts,
	];
}

/** "<payable> of <claimed> will be paid" (copied from verdict/statement.ts). */
function statementFor(kb: KnowledgeBase, payable: number, claimed: number) {
	const currency = kb.currency ?? "INR";
	return `${formatMoney(payable, currency)} of ${formatMoney(claimed, currency)} will be paid`;
}

/**
 * The hero's view of `audit(kb, facts)`, or why it cannot be shown. Never
 * throws: a refused fact, a goal of the wrong type, or deductions that do not
 * add up give a failure, and the page shows a notice instead (requirement 8.6).
 */
export function heroModel(
	kb: KnowledgeBase,
	facts: Readonly<Record<string, FactValue>> = HERO_FACTS,
): HeroModel | HeroFailure {
	let verdict: Verdict;
	try {
		verdict = audit(kb, facts);
	} catch {
		return failed("engine_error");
	}
	// audit has validated the knowledge base and every answer, so the session
	// for explain needs no replay through answer, which validates again each time.
	const session: Session = { kb, answers: facts };
	const claimed = facts[CLAIMED_FACT];
	const payable = verdict.goals[AMOUNT_GOAL];
	const outcome = verdict.goals[STATE_GOAL];
	if (
		typeof claimed !== "number" ||
		typeof payable !== "number" ||
		typeof outcome !== "string"
	)
		return failed("kb_mismatch");
	const items = deductions(verdict);
	if (items.some((item) => typeof item.value !== "number"))
		return failed("ledger_mismatch");
	const cut = items.reduce((sum, item) => sum + (item.value as number), 0);
	if (claimed - cut !== payable) return failed("ledger_mismatch");
	const ledger: LedgerData = {
		claimed: { label: labelFor(kb, CLAIMED_FACT), value: claimed },
		items,
		payable: { label: labelFor(kb, AMOUNT_GOAL), value: payable },
	};
	return {
		session,
		verdict,
		state: verdictStateFrom(outcome, verdict.needed.length),
		statement: statementFor(kb, payable, claimed),
		ledger,
		parts: partsFrom(ledger),
		answers: formatEntries(facts, kb.facts, formatFor(kb)),
	};
}
