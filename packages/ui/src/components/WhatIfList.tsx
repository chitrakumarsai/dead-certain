import type { Alternative, FactDef, Verdict } from "@dead-certain/engine/types";
import type { FormatContext } from "../types";
import { whatIfText } from "./whatIfText";

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

	const context = { current, labelFor, defFor, amountGoal, stateGoal, format };

	return (
		<section className="max-w-column">
			<h2 className="text-sys-body font-semibold text-text">
				What would change this
			</h2>
			<ul className="space-y-1 pt-2 text-sys-body text-text">
				{alternatives.map((alt) => (
					<li key={`${alt.fact}=${String(alt.value)}`} className="figures">
						{whatIfText(alt, context)}
					</li>
				))}
			</ul>
		</section>
	);
}
