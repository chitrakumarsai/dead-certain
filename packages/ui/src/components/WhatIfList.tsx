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

export interface WhatIfListProps {
	current: Verdict;
	alternatives: readonly Alternative[];
	labelFor: (fact: string) => string;
	defFor: (fact: string) => FactDef | undefined;
	/** A money goal: each row shows the signed change in it. */
	amountGoal?: string;
	/** A verdict goal: named when there is no money change to show. */
	stateGoal?: string;
	format: FormatContext;
}

const MINUS = "−";

const stateWord = (verdict: Verdict, goal: string): string =>
	VERDICT_WORDS[verdictStateFrom(verdict.goals[goal], verdict.needed.length)];

/** "+ ₹38,000", or undefined when either amount is unknown or nothing moves. */
function signedDelta(
	from: FactValue | undefined,
	to: FactValue | undefined,
	format: FormatContext,
): string | undefined {
	if (typeof from !== "number" || typeof to !== "number" || from === to) {
		return undefined;
	}
	const amount = formatMoney(
		Math.abs(to - from),
		format.currency ?? "INR",
		format.locale,
	);
	return `${to > from ? "+" : MINUS} ${amount}`;
}

/**
 * Which single answers would change the outcome, in plain text: "If room
 * rent per day were ₹5,000: + ₹38,000". Nothing at all when there are none.
 */
export function WhatIfList({
	current,
	alternatives,
	labelFor,
	defFor,
	amountGoal,
	stateGoal,
	format,
}: WhatIfListProps) {
	if (alternatives.length === 0) return null;

	const change = (alt: Alternative): string =>
		(amountGoal &&
			signedDelta(
				current.goals[amountGoal],
				alt.verdict.goals[amountGoal],
				format,
			)) ||
		(stateGoal &&
			`${stateWord(current, stateGoal)} to ${stateWord(alt.verdict, stateGoal)}`) ||
		"the verdict changes";

	const valueText = (alt: Alternative): string => {
		const def = defFor(alt.fact);
		return lowerFirst(
			def ? formatValue(def, alt.value, format) : String(alt.value),
		);
	};

	return (
		<section className="max-w-column">
			<h2 className="text-sys-body font-semibold text-text">
				What would change this
			</h2>
			<ul className="space-y-1 pt-2 text-sys-body text-text">
				{alternatives.map((alt) => (
					<li key={`${alt.fact}=${String(alt.value)}`} className="figures">
						If {lowerFirst(labelFor(alt.fact))} were {valueText(alt)}:{" "}
						{change(alt)}
					</li>
				))}
			</ul>
		</section>
	);
}
