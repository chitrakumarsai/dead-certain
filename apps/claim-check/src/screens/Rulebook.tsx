import type { KnowledgeBase, Rule } from "@dead-certain/engine";
import { ClauseQuote, Sheet, type XrayTarget } from "@dead-certain/ui";
import { type Dispatch, type ReactNode, useEffect, useRef } from "react";
import { labelFor } from "../kb";
import { byClauseId, coverage } from "../rulebook/coverage";
import { fragmentFor } from "../session/replay";
import { type Action, step as stepOf, type ViewState } from "../session/store";
import { useTitle } from "../useTitle";

const HEADING = "The sample policy";
const LINK = "underline underline-offset-4";

/**
 * The rule's sentence. Each {fact} is a value the check fills in, so it is
 * shown as a marked blank with the fact's name.
 */
function Sentence({ kb, rule }: { kb: KnowledgeBase; rule: Rule }) {
	const out: ReactNode[] = [];
	let from = 0;
	for (const m of rule.because.matchAll(/\{(\w+)\}/g)) {
		out.push(rule.because.slice(from, m.index));
		out.push(
			<var
				key={m.index}
				className="rounded-sm border border-dashed border-divider px-1 not-italic"
			>
				{labelFor(kb, m[1] ?? "").toLowerCase()}
			</var>,
		);
		from = m.index + m[0].length;
	}
	out.push(rule.because.slice(from));
	return <>{out}</>;
}

/** The proof a rule's fact opens on the current verdict, if it has one (9.2). */
function proofFor(
	kb: KnowledgeBase,
	view: ViewState,
	rule: Rule,
): XrayTarget | null {
	const s = stepOf(view);
	if (s.kind !== "verdict") return null;
	if (kb.goals.includes(rule.set)) return { kind: "verdict" };
	return s.verdict.lineItems.some((item) => item.fact === rule.set)
		? { kind: "line", fact: rule.set }
		: null;
}

function RuleLine({
	kb,
	view,
	dispatch,
	rule,
}: {
	kb: KnowledgeBase;
	view: ViewState;
	dispatch: Dispatch<Action>;
	rule: Rule;
}) {
	const target = proofFor(kb, view, rule);
	const href = fragmentFor(view.session);
	return (
		<li className="pt-2">
			<span className="font-mono text-sys-small">{rule.id}</span>{" "}
			<Sentence kb={kb} rule={rule} />
			{target !== null && (
				<>
					{" "}
					<a
						href={href}
						className={LINK}
						onClick={(e) => {
							e.preventDefault();
							dispatch({ type: "open", target });
							location.hash = href;
						}}
					>
						Open its proof
					</a>
				</>
			)}
		</li>
	);
}

/** Every clause with the rules that cite it, and every rule with its clause (requirement 9). */
export function Rulebook({
	kb,
	clause,
	view,
	dispatch,
}: {
	kb: KnowledgeBase;
	clause: string | null;
	view: ViewState;
	dispatch: Dispatch<Action>;
}) {
	useTitle(HEADING);
	const heading = useRef<HTMLHeadingElement>(null);
	const { byClause, byRule, missing } = coverage(kb);
	const cited = byRule.filter((r) => r.clause !== undefined);
	cited.sort((a, b) => byClauseId(a.rule.cite, b.rule.cite));

	useEffect(() => {
		const target = clause === null ? null : document.getElementById(clause);
		(target ?? heading.current)?.focus();
	}, [clause]);

	return (
		<Sheet as="article" aria-labelledby="rulebook-heading">
			<h1
				id="rulebook-heading"
				ref={heading}
				tabIndex={-1}
				className="font-doc text-verdict font-semibold"
			>
				{HEADING}
			</h1>
			<p className="max-w-column pt-4 text-sys-body">
				Each clause of the policy, with the rules that use it. The rules are
				read from the same knowledge base the check runs on.
			</p>

			<section aria-labelledby="clauses-heading" className="pt-8">
				<h2 id="clauses-heading" className="text-sys-body font-semibold">
					Clauses and the rules that use them
				</h2>
				<ol className="flex flex-col gap-8 pt-4">
					{Object.entries(byClause).map(([id, rules]) => {
						const c = kb.clauses[id];
						if (c === undefined) return null;
						return (
							<li
								key={id}
								id={id}
								tabIndex={-1}
								aria-label={`Clause ${id} ${c.title}`}
								className="scroll-mt-8"
							>
								<ClauseQuote clause={c} />
								{rules.length === 0 ? (
									<p className="pl-4 pt-2 text-sys-small text-text-soft">
										Not used in any decision
									</p>
								) : (
									<ul
										aria-label={`Rules citing clause ${id}`}
										className="max-w-column pl-4 text-sys-small"
									>
										{rules.map((rule) => (
											<RuleLine
												key={rule.id}
												kb={kb}
												view={view}
												dispatch={dispatch}
												rule={rule}
											/>
										))}
									</ul>
								)}
							</li>
						);
					})}
				</ol>
			</section>

			<section aria-labelledby="rules-heading" className="pt-12">
				<h2 id="rules-heading" className="text-sys-body font-semibold">
					Rules and the clauses they cite
				</h2>
				<ul aria-label="Rules" className="max-w-column pt-4 text-sys-small">
					{cited.map(({ rule, clause: c }) => (
						<li key={rule.id} className="pt-1">
							<span className="font-mono">{rule.id}</span> cites{" "}
							<a href={`#/rulebook?clause=${rule.cite}`} className={LINK}>
								clause {rule.cite} {c?.title}
							</a>
						</li>
					))}
				</ul>
				{missing.length > 0 && (
					<>
						<h3 className="pt-6 text-sys-body font-semibold">
							Cites a missing clause
						</h3>
						<ul className="max-w-column pt-2 text-sys-small">
							{missing.map((rule) => (
								<li key={rule.id} className="pt-1">
									<span className="font-mono">{rule.id}</span> cites clause{" "}
									{rule.cite}, which the policy does not have
								</li>
							))}
						</ul>
					</>
				)}
			</section>
		</Sheet>
	);
}
