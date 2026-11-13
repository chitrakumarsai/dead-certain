import type {
	Alternative,
	FactDef,
	FactValue,
	Verdict,
} from "@dead-certain/engine/types";
import { lowerFirst } from "../format/label";
import { formatMoney } from "../format/money";
import { formatValue } from "../format/value";
import type { FormatContext } from "../types";
import { VERDICT_WORDS, verdictStateFrom } from "../verdictState";

export interface WhatIfContext {
	current: Verdict;
	labelFor: (fact: string) => string;
	defFor: (fact: string) => FactDef | undefined;
	amountGoal?: string;
	stateGoal?: string;
	format: FormatContext;
}

const MINUS = "−";
/** Safe because the engine lists only alternatives that change the outcome. */
const GENERIC = "the verdict changes";

const stateWord = (verdict: Verdict, goal: string): string =>
	VERDICT_WORDS[verdictStateFrom(verdict.goals[goal], verdict.needed.length)];

/** Only yes/no reads lower case mid-sentence; enums, money, dates stay verbatim. */
function valueText(
	def: FactDef | undefined,
	value: FactValue,
	format: FormatContext,
): string {
	if (!def) return String(value);
	const text = formatValue(def, value, format);
	return def.type === "boolean" ? text.toLowerCase() : text;
}

function stateChange(
	alt: Alternative,
	{ current, stateGoal }: WhatIfContext,
): string | undefined {
	if (!stateGoal) return undefined;
	const from = stateWord(current, stateGoal);
	const to = stateWord(alt.verdict, stateGoal);
	return from === to ? undefined : `${from} to ${to}`;
}

function change(alt: Alternative, context: WhatIfContext): string {
	const state = stateChange(alt, context);
	const { amountGoal, current, format } = context;
	if (!amountGoal) return state ?? GENERIC;

	const from = current.goals[amountGoal];
	const to = alt.verdict.goals[amountGoal];
	if (typeof from !== "number" || typeof to !== "number") {
		// Like the Ledger's "Not known yet": an unknown amount is said, not hidden.
		return state ? `amount not known yet; ${state}` : "amount not known yet";
	}
	if (from === to) return state ?? GENERIC;
	const amount = formatMoney(
		Math.abs(to - from),
		format.currency ?? "INR",
		format.locale,
	);
	return `${to > from ? "+" : MINUS} ${amount}`;
}

/** "If room rent per day were ₹5,000: + ₹38,000". */
export function whatIfText(alt: Alternative, context: WhatIfContext): string {
	const label = lowerFirst(context.labelFor(alt.fact));
	const value = valueText(context.defFor(alt.fact), alt.value, context.format);
	return `If ${label} were ${value}: ${change(alt, context)}`;
}
