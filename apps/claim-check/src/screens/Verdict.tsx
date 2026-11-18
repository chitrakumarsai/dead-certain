import { type KnowledgeBase, type Verdict, whatIf } from "@dead-certain/engine";
import {
	Button,
	Ledger,
	ProportionBar,
	Sheet,
	useAnnounce,
	VerdictHeadline,
	WhatIfList,
} from "@dead-certain/ui";
import { useEffect } from "react";
import { config } from "../config";
import { defFor, formatFor, labelFor } from "../kb";
import type { Action, ViewState } from "../session/store";
import { useTitle } from "../useTitle";
import { ledgerFrom, partsFrom } from "../verdict/parts";
import { statementFor, stateOf } from "../verdict/statement";
import { usefulAlternatives } from "../verdict/whatIf";
import { CopyLink } from "./CopyLink";

const ENOUGH = "That is enough to decide";

/** The amount first, then where every deduction came from (requirements 5 to 7). */
export function VerdictScreen({
	kb,
	view,
	verdict,
	dispatch,
}: {
	kb: KnowledgeBase;
	view: ViewState;
	verdict: Verdict;
	dispatch: (action: Action) => void;
}) {
	const announce = useAnnounce();
	const ledger = ledgerFrom(view.session, verdict);
	const statement =
		ledger === null
			? "The amount could not be worked out"
			: statementFor(kb, ledger.payable.value, ledger.claimed.value);
	useTitle(statement);
	// After an edit the change sentence already says the verdict updated.
	useEffect(() => {
		if (view.arrivedByAnswer && view.changed === null) announce(ENOUGH);
	}, [view.arrivedByAnswer, view.changed, announce]);

	const format = formatFor(kb);
	const alternatives = usefulAlternatives(kb, whatIf(view.session));
	const parts = ledger === null ? [] : partsFrom(ledger);
	const selected = view.open?.kind === "line" ? view.open.fact : undefined;

	return (
		<Sheet as="section" aria-labelledby="verdict-heading">
			{view.arrivedByAnswer && (
				<p className="pb-2 text-sys-small text-text-soft">{ENOUGH}</p>
			)}
			<div id="verdict-heading">
				<VerdictHeadline state={stateOf(verdict)} statement={statement} />
			</div>
			<div className="space-y-8 pt-8">
				{ledger !== null && parts.length > 0 && (
					<ProportionBar
						total={ledger.claimed.value}
						parts={parts}
						format={format}
					/>
				)}
				{ledger !== null && (
					<Ledger
						claimed={ledger.claimed}
						items={ledger.items}
						payable={ledger.payable}
						format={format}
						{...(selected === undefined ? {} : { selectedFact: selected })}
						onOpen={(item) =>
							dispatch({
								type: "open",
								target: { kind: "line", fact: item.fact },
							})
						}
					/>
				)}
				{alternatives.length > 0 && (
					<WhatIfList
						current={verdict}
						alternatives={alternatives}
						labelFor={(fact) => labelFor(kb, fact)}
						defFor={(fact) => defFor(kb, fact)}
						amountGoal={config.amountGoal}
						stateGoal={config.stateGoal}
						format={format}
					/>
				)}
				<div data-print-hide className="flex flex-wrap items-start gap-4">
					<Button
						variant="primary"
						onClick={() =>
							dispatch({ type: "open", target: { kind: "verdict" } })
						}
					>
						See why
					</Button>
					<CopyLink />
					<Button variant="quiet" onClick={() => dispatch({ type: "restart" })}>
						Start over
					</Button>
				</div>
			</div>
		</Sheet>
	);
}
