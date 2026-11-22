import { explain, type Session } from "@dead-certain/engine";
import { ClauseRef, ProofTree, type XrayTarget } from "@dead-certain/ui";
import { clauseFor, labelFor, ruleExpression } from "../kb";
import { printValue, withPrintedBecause } from "./because";
import { STATE_GOAL } from "./config";

const keyOf = (t: XrayTarget) => (t.kind === "verdict" ? "verdict" : t.fact);

/**
 * The proof of one target: the tree, then the clause that decided it. Claim
 * Check's film body without "Change this answer", since the claim is fixed (3.5).
 */
export function Film({
	session,
	target,
	onClose,
}: {
	session: Session;
	target: XrayTarget;
	onClose: () => void;
}) {
	const kb = session.kb;
	const fact = target.kind === "verdict" ? STATE_GOAL : target.fact;
	const root = withPrintedBecause(explain(session, fact), session);
	return (
		<div className="space-y-6">
			<ProofTree
				key={keyOf(target)}
				root={root}
				labelFor={(f) => labelFor(kb, f)}
				formatValue={(f, value) =>
					value === undefined ? "Not known yet" : printValue(session, f, value)
				}
				ruleExpression={(id) => ruleExpression(kb, id) || undefined}
				clauseFor={(id) => clauseFor(kb, id)}
				{...(root.clause === undefined ? {} : { decidingClause: root.clause })}
				onEscape={onClose}
			/>
			{/* ProofTree quotes the deciding clause; only a missing one is named here, by id. */}
			{root.clause !== undefined &&
				clauseFor(kb, root.clause) === undefined && (
					<ClauseRef id={root.clause} variant="deciding" surface="film" />
				)}
		</div>
	);
}
