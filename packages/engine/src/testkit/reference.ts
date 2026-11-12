// Test-only oracles. Never imported from non-test source and never re-exported
// from index.ts. No Node imports.
//
// `referenceVerdict` is a deliberately naive interpreter. It shares no code
// with resolve.ts, relevance.ts, outcome.ts, graph.ts or util.ts. It builds a
// complete environment eagerly for every expression and calls the rule
// language `evaluate` on it. Known limit: a referenced fact whose own
// evaluation fails is passed to `evaluate` as UNKNOWN (the engine would never
// visit it inside a skipped branch). The generators never divide, so this does
// not arise in generated knowledge bases.

import { evaluate } from "../lang/evaluate";
import type {
	Expr,
	FactDef,
	FactValue,
	KnowledgeBase,
	LineItem,
	Rule,
} from "../types";
import { UNKNOWN } from "../types";

type Slot = FactValue | typeof UNKNOWN;

/** What the interpreter computed for one fact. */
export interface ReferenceEntry {
	readonly status: "known" | "unknown" | "inapplicable";
	/** `undefined` unless the status is "known". */
	readonly value: FactValue | undefined;
	/** Deciding rule id, or the rule that stayed Unknown; "" when none. */
	readonly rule: string;
	/** Clause cited by that rule; "" when none. */
	readonly clause: string;
}

export interface ReferenceVerdict {
	/** Goal values in `kb.goals` order; `undefined` unless known. */
	readonly goals: Readonly<Record<string, FactValue | undefined>>;
	readonly goalEntries: Readonly<Record<string, ReferenceEntry>>;
	/** Facts with a role, in `kb.facts` order. */
	readonly lineItems: readonly LineItem[];
}

class ReferenceEvalError extends Error {}

function ownKeys<T>(record: Readonly<Record<string, T>>): string[] {
	return Object.keys(record);
}

function has(record: object, key: string): boolean {
	return Object.hasOwn(record, key);
}

function refsOf(expr: Expr, into: string[]): void {
	switch (expr.kind) {
		case "literal":
			return;
		case "fact":
			if (!into.includes(expr.name)) into.push(expr.name);
			return;
		case "unary":
			refsOf(expr.operand, into);
			return;
		case "binary":
			refsOf(expr.left, into);
			refsOf(expr.right, into);
			return;
		case "call":
			for (const arg of expr.args) refsOf(arg, into);
			return;
	}
}

function labelOf(name: string, def: FactDef): string {
	if (def.label !== undefined) return def.label;
	const spaced = name.split("_").join(" ");
	return spaced.length === 0
		? spaced
		: spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const KNOWN_ZERO = 0;

/**
 * Computes goals and line items by trying the rules of each fact in file
 * order. Throws a plain `Error` when the reference run hits an evaluation
 * error on a goal or line item.
 */
export function referenceVerdict(
	kb: KnowledgeBase,
	answers: Readonly<Record<string, FactValue>>,
): ReferenceVerdict {
	type Outcome =
		| { readonly entry: ReferenceEntry }
		| { readonly failure: ReferenceEvalError };

	const memo = new Map<string, Outcome>();
	const active = new Set<string>();

	const unknownEntry = (rule: Rule | undefined): ReferenceEntry => ({
		status: "unknown",
		value: undefined,
		rule: rule?.id ?? "",
		clause: rule?.cite ?? "",
	});

	const buildEnv = (expr: Expr): Record<string, Slot> => {
		const names: string[] = [];
		refsOf(expr, names);
		return Object.fromEntries(
			names.map((name): [string, Slot] => {
				const out = resolve(name);
				if ("failure" in out) return [name, UNKNOWN];
				return [
					name,
					out.entry.status === "known"
						? (out.entry.value as FactValue)
						: UNKNOWN,
				];
			}),
		);
	};

	const run = (expr: Expr, rule: Rule): Slot => {
		const result = evaluate(expr, buildEnv(expr));
		if (!result.ok) {
			throw new ReferenceEvalError(`${rule.id}: ${result.error.code}`);
		}
		return result.value;
	};

	const compute = (name: string): ReferenceEntry => {
		const def: FactDef | undefined = has(kb.facts, name)
			? kb.facts[name]
			: undefined;
		if (def === undefined || def.derived !== true) {
			if (has(answers, name)) {
				return {
					status: "known",
					value: answers[name] as FactValue,
					rule: "",
					clause: "",
				};
			}
			return unknownEntry(undefined);
		}
		for (const rule of kb.rules) {
			if (rule.set !== name) continue;
			let guard: Slot = true;
			if (rule.when !== undefined) guard = run(rule.when, rule);
			if (guard === false) continue;
			if (guard === UNKNOWN) return unknownEntry(rule);
			if (guard !== true) {
				throw new ReferenceEvalError(`${rule.id}: TYPE_MISMATCH`);
			}
			const value = run(rule.to, rule);
			if (value === UNKNOWN) return unknownEntry(rule);
			if (
				def.type === "money" &&
				typeof value === "number" &&
				!Number.isInteger(value)
			) {
				throw new ReferenceEvalError(`${rule.id}: NON_INTEGER_MONEY`);
			}
			return {
				status: "known",
				value: value === 0 ? KNOWN_ZERO : value,
				rule: rule.id,
				clause: rule.cite,
			};
		}
		return { status: "inapplicable", value: undefined, rule: "", clause: "" };
	};

	function resolve(name: string): Outcome {
		const cached = memo.get(name);
		if (cached !== undefined) return cached;
		if (active.has(name)) {
			throw new Error(`reference interpreter: cycle through ${name}`);
		}
		active.add(name);
		let out: Outcome;
		try {
			out = { entry: compute(name) };
		} catch (error) {
			if (!(error instanceof ReferenceEvalError)) throw error;
			out = { failure: error };
		} finally {
			active.delete(name);
		}
		memo.set(name, out);
		return out;
	}

	const entryOf = (name: string): ReferenceEntry => {
		const out = resolve(name);
		if ("failure" in out) throw out.failure;
		return out.entry;
	};

	const goalEntries: Record<string, ReferenceEntry> = Object.fromEntries(
		kb.goals.map((goal) => [goal, entryOf(goal)]),
	);
	const goals: Record<string, FactValue | undefined> = Object.fromEntries(
		kb.goals.map((goal) => [goal, (goalEntries[goal] as ReferenceEntry).value]),
	);

	const lineItems: LineItem[] = [];
	for (const name of ownKeys(kb.facts)) {
		const def = kb.facts[name] as FactDef;
		if (def.role !== "deduction" && def.role !== "check") continue;
		const entry = entryOf(name);
		lineItems.push({
			fact: name,
			role: def.role,
			label: labelOf(name, def),
			value: entry.value,
			rule: entry.rule,
			clause: entry.clause,
		});
	}

	return { goals, goalEntries, lineItems };
}

/**
 * Every complete answer set that extends `answers` with a valid value for each
 * unanswered askable (not derived) fact, in odometer order over `kb.facts`
 * order. Supports boolean and enum facts only; throws on any other type.
 * With no unanswered askable fact it yields `answers` once.
 */
export function assignments(
	kb: KnowledgeBase,
	answers: Readonly<Record<string, FactValue>>,
): Record<string, FactValue>[] {
	const open: { name: string; values: FactValue[] }[] = [];
	for (const name of ownKeys(kb.facts)) {
		const def = kb.facts[name] as FactDef;
		if (def.derived === true || has(answers, name)) continue;
		if (def.type === "boolean") {
			open.push({ name, values: [false, true] });
		} else if (def.type === "enum") {
			open.push({ name, values: [...(def.options ?? [])] });
		} else {
			throw new Error(
				`assignments: fact ${name} has type ${def.type}; only boolean and enum can be enumerated`,
			);
		}
	}

	let results: [string, FactValue][][] = [[]];
	for (const { name, values } of open) {
		const next: [string, FactValue][][] = [];
		for (const partial of results) {
			for (const value of values) next.push([...partial, [name, value]]);
		}
		results = next;
	}
	return results.map((extra) => ({
		...answers,
		...Object.fromEntries(extra),
	}));
}
