import { findRelevant, type Relevant } from "./relevance";
import { type Resolution, Resolver } from "./resolve";
import type {
	FactValue,
	KnowledgeBase,
	LineItem,
	Question,
	Verdict,
} from "./types";
import { deriveLabel } from "./util";

/** The shared result of evaluating a knowledge base against a set of answers. */
export interface Outcome {
	readonly resolver: Resolver;
	readonly undecidedGoals: readonly string[];
	/** Empty when every goal is decided. */
	readonly relevant: readonly Relevant[];
}

/** A goal is decided when it is known or inapplicable. */
function isDecided(res: Resolution): boolean {
	return res.status !== "unknown";
}

/** The Resolved_Value as a public value: `undefined` unless known (and `-0` stored as `0`). */
function publicValue(res: Resolution): FactValue | undefined {
	if (res.status !== "known") return undefined;
	const v = res.value as FactValue;
	return v === 0 ? 0 : v;
}

/** Shared by `next` and `audit`: resolves the goals and finds the relevant facts. */
export function evaluateSession(
	kb: KnowledgeBase,
	answers: Readonly<Record<string, FactValue>>,
): Outcome {
	const resolver = new Resolver(kb, answers);
	const undecidedGoals = kb.goals.filter((g) => !isDecided(resolver.fact(g)));
	const relevant =
		undecidedGoals.length === 0
			? []
			: findRelevant(resolver, kb, undecidedGoals);
	return { resolver, undecidedGoals, relevant };
}

/** Builds a fresh Question; `why` and `clause` are present only when they have a value. */
export function buildQuestion(kb: KnowledgeBase, rel: Relevant): Question {
	const def = kb.facts[rel.fact];
	const q: {
		kind: "question";
		fact: string;
		text: string;
		why?: string;
		clause?: string;
	} = { kind: "question", fact: rel.fact, text: def?.ask ?? "" };
	if (def?.why !== undefined) q.why = def.why;
	if (rel.clause !== undefined) q.clause = rel.clause;
	return q;
}

/** Builds the Verdict for an Outcome. `UNKNOWN` becomes `undefined` here. */
export function buildVerdict(kb: KnowledgeBase, o: Outcome): Verdict {
	// fromEntries defines own properties, so a goal named `__proto__` is safe.
	const goals: Record<string, FactValue | undefined> = Object.fromEntries(
		kb.goals.map((goal) => [goal, publicValue(o.resolver.fact(goal))]),
	);

	const lineItems: LineItem[] = [];
	for (const [name, def] of Object.entries(kb.facts)) {
		if (def.role !== "deduction" && def.role !== "check") continue;
		const res = o.resolver.fact(name);
		const rule =
			res.deciding ??
			(res.status === "unknown" ? res.tried[res.tried.length - 1] : undefined);
		lineItems.push({
			fact: name,
			role: def.role,
			label: def.label ?? deriveLabel(name),
			value: publicValue(res),
			rule: rule?.id ?? "",
			clause: rule?.cite ?? "",
		});
	}

	const needed =
		o.undecidedGoals.length === 0
			? []
			: o.relevant.map((rel) => buildQuestion(kb, rel));

	return { kind: "verdict", goals, lineItems, needed };
}
