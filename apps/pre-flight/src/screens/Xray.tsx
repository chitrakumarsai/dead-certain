import type { KnowledgeBase, ProofNode } from "@dead-certain/engine";
import { formatValue, ProofTree, XrayStage } from "@dead-certain/ui";
import type { ReactNode } from "react";
import { clauseFor, labelFor, ruleExpression } from "../kb";
import type { ReportView } from "../report/audit";

/** The collected facts of a proof, each once, in tree order. */
function collectedFacts(proof: ProofNode): string[] {
	const out: string[] = [];
	const walk = (n: ProofNode) => {
		if (n.source === "collected" && !out.includes(n.fact)) out.push(n.fact);
		n.children.forEach(walk);
	};
	walk(proof);
	return out;
}

/** The proof of one check, then its evidence grouped by fact (7.2 to 7.7). */
function FilmBody({
	kb,
	view,
	evidence,
	fact,
	onChangeAnswer,
	onClose,
}: {
	kb: KnowledgeBase;
	view: ReportView;
	evidence: Readonly<Record<string, string>>;
	fact: string;
	onChangeAnswer: (fact: string) => void;
	onClose: () => void;
}) {
	const check = view.groups
		.flatMap((g) => g.checks)
		.find((c) => c.item.fact === fact);
	if (check === undefined) return null;
	const root = check.proof;
	const facts = collectedFacts(root).filter((f) => evidence[f] !== undefined);
	return (
		<div className="space-y-6">
			<ProofTree
				key={fact}
				root={root}
				labelFor={(f) => labelFor(kb, f)}
				formatValue={(f, value) => {
					const def = kb.facts[f];
					return def === undefined
						? String(value)
						: formatValue(def, value, {});
				}}
				ruleExpression={(id) => ruleExpression(kb, id) || undefined}
				clauseFor={(id) => clauseFor(kb, id)}
				{...(root.clause === undefined ? {} : { decidingClause: root.clause })}
				// The tree offers "Change this answer" only on "answered" nodes, which after
				// relabelling are the user's own answers, never a collected fact (7.7, 7.8).
				onChangeAnswer={onChangeAnswer}
				onEscape={onClose}
			/>
			{facts.length > 0 && (
				<section aria-labelledby="evidence-heading">
					<h3 id="evidence-heading" className="text-sys-body font-semibold">
						Evidence
					</h3>
					<dl className="pt-2">
						{facts.map((f) => (
							<div key={f} className="pt-2">
								<dt className="text-sys-small">{labelFor(kb, f)}</dt>
								<dd data-evidence className="font-mono text-mono wrap-anywhere">
									{evidence[f]}
								</dd>
							</div>
						))}
					</dl>
				</section>
			)}
		</div>
	);
}

/** The report on paper, and a check's proof on film when one is open (requirement 7). */
export function XrayReport({
	kb,
	view,
	evidence,
	open,
	onClose,
	onChangeAnswer,
	rail,
	children,
}: {
	kb: KnowledgeBase;
	view: ReportView;
	evidence: Readonly<Record<string, string>>;
	open: string | null;
	onClose: () => void;
	onChangeAnswer: (fact: string) => void;
	rail?: ReactNode;
	children: ReactNode;
}) {
	return (
		<XrayStage
			target={open === null ? null : { kind: "line", fact: open }}
			title={(t) => `Why: ${t.kind === "line" ? labelFor(kb, t.fact) : ""}`}
			onClose={onClose}
			rail={rail}
			sheet={children}
			film={(t) =>
				t.kind === "line" ? (
					<FilmBody
						kb={kb}
						view={view}
						evidence={evidence}
						fact={t.fact}
						onChangeAnswer={onChangeAnswer}
						onClose={onClose}
					/>
				) : null
			}
		/>
	);
}
