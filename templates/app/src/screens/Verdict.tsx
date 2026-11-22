import type { FactValue, KnowledgeBase, Verdict } from "@dead-certain/engine";
import {
	Button,
	Sheet,
	useAnnounce,
	VerdictHeadline,
	verdictStateFrom,
} from "@dead-certain/ui";
import { useEffect } from "react";
import { config } from "../config";
import { clauseFor, labelFor, printValue } from "../kb";
import type { Action, ViewState } from "../session/store";
import { useTitle } from "../useTitle";
import { CopyLink } from "./CopyLink";

const ENOUGH = "That is enough to decide";

const shown = (
	kb: KnowledgeBase,
	fact: string,
	value: FactValue | undefined,
) => (value === undefined ? "Not known" : printValue(kb, fact, value));

/** The verdict, the other goals, and each line item with its rule and clause (requirements 5.5, 5.6). */
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
	const goal = config.verdictGoal;
	const state = verdictStateFrom(verdict.goals[goal], verdict.needed.length);
	const statement = `${labelFor(kb, goal)}: ${shown(kb, goal, verdict.goals[goal])}`;
	useTitle(state === "undecided" ? "Result" : statement);
	useEffect(() => {
		if (view.arrivedByAnswer) announce(ENOUGH);
	}, [view.arrivedByAnswer, announce]);

	// A goal word the kit knows gets its headline; any other value a plain heading.
	const others = kb.goals.filter((g) => state === "undecided" || g !== goal);
	const selected = view.open?.kind === "line" ? view.open.fact : undefined;
	return (
		<Sheet as="section" aria-labelledby="verdict-heading">
			{view.arrivedByAnswer && (
				<p className="pb-2 text-sys-small text-text-soft">{ENOUGH}</p>
			)}
			<div id="verdict-heading">
				{state === "undecided" ? (
					<h1 className="font-doc text-verdict font-semibold">Result</h1>
				) : (
					<VerdictHeadline state={state} statement={statement} />
				)}
			</div>
			<div className="space-y-8 pt-6">
				<dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sys-body">
					{others.map((g) => (
						<div key={g} className="contents">
							<dt className="text-text-soft">{labelFor(kb, g)}</dt>
							<dd className="font-semibold tabular-nums">
								{shown(kb, g, verdict.goals[g])}
							</dd>
						</div>
					))}
				</dl>
				{verdict.lineItems.length > 0 && (
					<ul aria-label="Line items" className="divide-y divide-divider">
						{verdict.lineItems.map((item) => (
							<li
								key={item.fact}
								aria-current={item.fact === selected ? "true" : undefined}
								className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3"
							>
								<div>
									<p className="text-sys-body">
										{item.label}:{" "}
										<span className="font-semibold tabular-nums">
											{shown(kb, item.fact, item.value)}
										</span>
									</p>
									<p className="text-sys-small text-text-soft">
										Rule <span className="font-mono">{item.rule}</span>, clause{" "}
										{item.clause}
										{clauseFor(kb, item.clause) &&
											`: ${clauseFor(kb, item.clause)?.title}`}
									</p>
								</div>
								<Button
									data-print-hide
									onClick={() =>
										dispatch({
											type: "open",
											target: { kind: "line", fact: item.fact },
										})
									}
								>
									See why<span className="sr-only">: {item.label}</span>
								</Button>
							</li>
						))}
					</ul>
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
