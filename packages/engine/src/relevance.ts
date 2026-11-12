import type { Resolver } from "./resolve";
import type { Expr, KnowledgeBase, Rule } from "./types";
import { UNKNOWN } from "./types";
import { hasOwn } from "./util";

/** An unanswered askable fact the consultation needs, with the clause that needs it. */
export interface Relevant {
	readonly fact: string;
	/** `cite` of the rule through which the fact was first reached; undefined for a goal that is itself askable. */
	readonly clause: string | undefined;
}

/**
 * Walks the undecided goals in order and returns each Relevant_Fact once, in
 * the order the walk first reaches it (Requirement 5, criterion 3).
 * `evaluate` is only called (through the Resolver, memoised) on strict
 * sub-expressions of a guard or `to` that came back Unknown.
 */
export function findRelevant(
	r: Resolver,
	kb: KnowledgeBase,
	goals: readonly string[],
): Relevant[] {
	const out: Relevant[] = [];
	const reported = new Set<string>();
	const visited = new Set<string>();

	function visitFact(name: string, via: Rule | undefined): void {
		const def = hasOwn(kb.facts, name) ? kb.facts[name] : undefined;
		if (def === undefined) return;
		if (def.derived !== true) {
			if (
				def.ask !== undefined &&
				!reported.has(name) &&
				r.fact(name).status === "unknown"
			) {
				reported.add(name);
				out.push({ fact: name, clause: via?.cite });
			}
			return;
		}
		if (visited.has(name) || r.fact(name).status !== "unknown") return;
		visited.add(name);
		for (const rule of kb.rules) {
			if (rule.set !== name) continue;
			if (r.guard(rule) === false) continue;
			if (rule.when !== undefined) visitExpr(rule.when, rule);
			visitExpr(rule.to, rule);
			break;
		}
	}

	function visitExpr(e: Expr, rule: Rule): void {
		if (r.expr(e, rule.id) !== UNKNOWN) return;
		switch (e.kind) {
			case "literal":
				return;
			case "fact":
				visitFact(e.name, rule);
				return;
			case "unary":
				visitExpr(e.operand, rule);
				return;
			case "binary":
				visitExpr(e.left, rule);
				visitExpr(e.right, rule);
				return;
			case "call": {
				if (e.fn === "if") {
					const [cond, thenArm, elseArm] = e.args as readonly [
						Expr,
						Expr,
						Expr,
					];
					const c = r.expr(cond, rule.id);
					if (c === UNKNOWN) visitExpr(cond, rule);
					else visitExpr(c === true ? thenArm : elseArm, rule);
					return;
				}
				for (const arg of e.args) visitExpr(arg, rule);
				return;
			}
		}
	}

	for (const goal of goals) visitFact(goal, undefined);
	return out;
}
