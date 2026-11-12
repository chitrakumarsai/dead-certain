import { EngineError } from "./errors";
import { factRefs } from "./graph";
import { evaluate } from "./lang/evaluate";
import type { Expr, FactValue, KnowledgeBase, Rule, Unknown } from "./types";
import { UNKNOWN } from "./types";
import { hasOwn } from "./util";

type Slot = FactValue | Unknown;

/** The outcome of resolving one fact. */
export interface Resolution {
	readonly status: "known" | "unknown" | "inapplicable";
	/** UNKNOWN unless status is "known". */
	readonly value: Slot;
	/** Set for known, and for unknown with a deciding rule. */
	readonly deciding: Rule | undefined;
	/** Rules whose guard was evaluated, in order. */
	readonly tried: readonly Rule[];
}

function toSlot(res: Resolution): Slot {
	return res.status === "known" ? res.value : UNKNOWN;
}

/**
 * Resolves facts and rule expressions for one engine call. It is the only
 * place that calls `evaluate` for rules. Each fact, guard and `to` expression
 * is evaluated at most once.
 */
export class Resolver {
	private readonly kb: KnowledgeBase;
	private readonly answers: Readonly<Record<string, FactValue>>;
	private readonly reads = new Set<string>();
	private readonly facts = new Map<string, Resolution>();
	private readonly exprs = new Map<Expr, Slot>();

	constructor(kb: KnowledgeBase, answers: Readonly<Record<string, FactValue>>) {
		this.kb = kb;
		this.answers = answers;
	}

	/** True when an evaluation read this fact. */
	wasRead(name: string): boolean {
		return this.reads.has(name);
	}

	/** Resolves a fact; memoised by name. */
	fact(name: string): Resolution {
		const cached = this.facts.get(name);
		if (cached !== undefined) return cached;
		const res = this.resolveFact(name);
		this.facts.set(name, res);
		return res;
	}

	/** Evaluates an expression; memoised by node identity. */
	expr(e: Expr, ruleId: string): Slot {
		if (this.exprs.has(e)) return this.exprs.get(e) as Slot;
		const env = Object.create(null) as Record<string, Slot>;
		for (const name of factRefs(e)) {
			Object.defineProperty(env, name, {
				enumerable: true,
				get: () => {
					this.reads.add(name);
					return toSlot(this.fact(name));
				},
			});
		}
		const r = evaluate(e, env);
		if (!r.ok) {
			throw new EngineError(
				"EVALUATION_ERROR",
				`Rule ${ruleId}: ${r.error.code}`,
			);
		}
		this.exprs.set(e, r.value);
		return r.value;
	}

	/** The guard of a rule: true when the rule has no `when`. */
	guard(rule: Rule): boolean | Unknown {
		if (rule.when === undefined) return true;
		const v = this.expr(rule.when, rule.id);
		if (v === UNKNOWN || typeof v === "boolean") return v;
		throw new EngineError("EVALUATION_ERROR", `Rule ${rule.id}: TYPE_MISMATCH`);
	}

	private resolveFact(name: string): Resolution {
		const def = hasOwn(this.kb.facts, name) ? this.kb.facts[name] : undefined;
		if (def === undefined) {
			return {
				status: "unknown",
				value: UNKNOWN,
				deciding: undefined,
				tried: [],
			};
		}
		if (def.derived !== true) {
			if (hasOwn(this.answers, name)) {
				return {
					status: "known",
					value: this.answers[name] as FactValue,
					deciding: undefined,
					tried: [],
				};
			}
			return {
				status: "unknown",
				value: UNKNOWN,
				deciding: undefined,
				tried: [],
			};
		}

		const tried: Rule[] = [];
		for (const rule of this.kb.rules) {
			if (rule.set !== name) continue;
			const g = this.guard(rule);
			tried.push(rule);
			if (g === false) continue;
			if (g === UNKNOWN) {
				return {
					status: "unknown",
					value: UNKNOWN,
					deciding: undefined,
					tried,
				};
			}
			const v = this.expr(rule.to, rule.id);
			if (v === UNKNOWN) {
				return { status: "unknown", value: UNKNOWN, deciding: rule, tried };
			}
			if (
				def.type === "money" &&
				typeof v === "number" &&
				!Number.isInteger(v)
			) {
				throw new EngineError(
					"NON_INTEGER_MONEY",
					`Rule ${rule.id}: money fact ${name} is not an integer`,
				);
			}
			return { status: "known", value: v, deciding: rule, tried };
		}
		return {
			status: "inapplicable",
			value: UNKNOWN,
			deciding: undefined,
			tried,
		};
	}
}
