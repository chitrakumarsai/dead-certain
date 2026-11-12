// Test-only generator of read-once Knowledge_Bases (boolean and enum facts
// built as trees). Never imported from non-test source and never re-exported
// from index.ts. No Node imports.

import fc from "fast-check";
import type { Clause, Expr, FactDef, KnowledgeBase, Rule } from "../types";
import { assignments, referenceVerdict } from "./reference";

/** Draws an integer in [min, max] from a pre-generated, cheaply shrinking pool. */
type Draw = (min: number, max: number) => number;

/** A fact that no expression references yet. */
interface Node {
	readonly name: string;
	readonly type: "boolean" | "enum";
	readonly options: readonly string[];
}

const OPTIONS: readonly string[] = ["opt_a", "opt_b", "opt_c"];

export const MAX_ASKABLE = 8;
export const MAX_OPTIONS = 3;
/** Derived enums have exactly two outputs, so each rule is live. */
const MAX_DERIVED_OPTIONS = 2;
const MAX_DERIVED = 4;

function chance(g: Draw, percent: number): boolean {
	return g(0, 99) < percent;
}

/** Removes and returns `count` random items of `items`. */
function take<T>(g: Draw, items: T[], count: number): T[] {
	const taken: T[] = [];
	for (let i = 0; i < count; i++) {
		const [one] = items.splice(g(0, items.length - 1), 1);
		taken.push(one as T);
	}
	return taken;
}

function leafFor(g: Draw, node: Node): Expr {
	if (node.type === "boolean") {
		const ref: Expr = { kind: "fact", name: node.name };
		return chance(g, 25) ? { kind: "unary", op: "not", operand: ref } : ref;
	}
	const option = node.options[g(0, node.options.length - 1)] as string;
	return {
		kind: "binary",
		op: chance(g, 70) ? "==" : "!=",
		left: { kind: "fact", name: node.name },
		right: { kind: "literal", type: "enum", value: option },
	};
}

/**
 * Combines leaves, each over a distinct fact and used exactly once, into one
 * boolean tree of and/or. No `if`, so no branch can be dead.
 */
function combine(g: Draw, leaves: Expr[]): Expr {
	const parts = [...leaves];
	while (parts.length > 1) {
		const [left, right] = take(g, parts, 2) as [Expr, Expr];
		parts.push({
			kind: "binary",
			op: chance(g, 50) ? "and" : "or",
			left,
			right,
		});
	}
	return parts[0] as Expr;
}

function buildKb(g: Draw): KnowledgeBase {
	const askableCount = g(1, MAX_ASKABLE);
	const facts: Record<string, FactDef> = {};
	const pool: Node[] = [];

	for (let i = 0; i < askableCount; i++) {
		const name = `a${i}`;
		const isEnum = chance(g, 40);
		const options = isEnum ? OPTIONS.slice(0, g(2, MAX_OPTIONS)) : [];
		facts[name] = {
			type: isEnum ? "enum" : "boolean",
			ask: `Question about ${name}?`,
			...(chance(g, 40) ? { why: `Because ${name} matters.` } : {}),
			...(isEnum ? { options } : {}),
			...(chance(g, 20) ? { label: `Label ${name}` } : {}),
		};
		pool.push({ name, type: isEnum ? "enum" : "boolean", options });
	}

	const clauses: Record<string, Clause> = {};
	for (let c = 0; c < 3; c++) {
		clauses[`c${c}`] = {
			id: `c${c}`,
			title: `Clause ${c}`,
			text: `Text of clause ${c}.`,
		};
	}

	const rules: Rule[] = [];
	const derivedCount = g(0, MAX_DERIVED);
	for (let d = 0; d < derivedCount && pool.length > 0; d++) {
		const name = `d${d}`;
		const isEnum = chance(g, 35);
		const options = isEnum ? OPTIONS.slice(0, MAX_DERIVED_OPTIONS) : [];
		// Exactly two distinct outputs: one guarded rule that can fire and can
		// fail to fire, then an unguarded rule (never inapplicable or constant).
		const outputs: Expr[] = isEnum
			? options.map((value) => ({ kind: "literal", type: "enum", value }))
			: [
					{ kind: "literal", type: "boolean", value: true },
					{ kind: "literal", type: "boolean", value: false },
				];
		const ordered = chance(g, 50) ? [...outputs].reverse() : outputs;

		const used = take(g, pool, g(1, Math.min(3, pool.length)));
		const when = combine(
			g,
			used.map((node) => leafFor(g, node)),
		);
		for (let r = 0; r < 2; r++) {
			rules.push({
				id: `${name}_r${r}`,
				cite: `c${g(0, 2)}`,
				set: name,
				to: ordered[r] as Expr,
				...(r === 0 ? { when } : {}),
				because: `Rule ${name}_r${r} applied.`,
			});
		}

		facts[name] = {
			type: isEnum ? "enum" : "boolean",
			derived: true,
			...(isEnum ? { options } : {}),
			...(chance(g, 40)
				? { role: isEnum || chance(g, 50) ? "deduction" : "check" }
				: {}),
			...(chance(g, 30) ? { label: `Label ${name}` } : {}),
		} as FactDef;
		pool.push({ name, type: isEnum ? "enum" : "boolean", options });
	}

	// Every fact nothing refers to is a goal, so each fact matters to a goal.
	const goals = Object.keys(facts).filter((name) =>
		pool.some((node) => node.name === name),
	);
	return { id: "read-once", goals, facts, rules, clauses };
}

function countRefs(expr: Expr, into: Map<string, number>): void {
	switch (expr.kind) {
		case "literal":
			return;
		case "fact":
			into.set(expr.name, (into.get(expr.name) ?? 0) + 1);
			return;
		case "unary":
			countRefs(expr.operand, into);
			return;
		case "binary":
			countRefs(expr.left, into);
			countRefs(expr.right, into);
			return;
		case "call":
			for (const arg of expr.args) countRefs(arg, into);
			return;
	}
}

function subExprs(expr: Expr, into: Expr[]): void {
	into.push(expr);
	switch (expr.kind) {
		case "unary":
			subExprs(expr.operand, into);
			return;
		case "binary":
			subExprs(expr.left, into);
			subExprs(expr.right, into);
			return;
		case "call":
			for (const arg of expr.args) subExprs(arg, into);
			return;
		default:
			return;
	}
}

/**
 * True when `kb` meets the limits of Requirement 17, criterion 6: boolean and
 * enum facts only, at most 8 askable facts, at most 3 options per enum fact,
 * each fact referenced from at most one expression position, and distinct
 * literal outputs among the rules of one fact. It also rejects, by enumerating
 * every complete assignment through the reference interpreter, any KB where a
 * derived fact or a rule guard (or any sub-expression of one) never varies or
 * is ever Unknown or inapplicable. That excludes dead rules and
 * self-cancelling expressions.
 */
export function isReadOnceKb(kb: KnowledgeBase): boolean {
	let askable = 0;
	for (const def of Object.values(kb.facts)) {
		if (def.type !== "boolean" && def.type !== "enum") return false;
		if (def.derived !== true) askable++;
		if (def.type === "enum" && (def.options?.length ?? 0) > MAX_OPTIONS) {
			return false;
		}
	}
	if (askable > MAX_ASKABLE) return false;

	const counts = new Map<string, number>();
	const outputs = new Map<string, Set<string>>();
	for (const rule of kb.rules) {
		if (rule.when !== undefined) countRefs(rule.when, counts);
		countRefs(rule.to, counts);
		if (rule.to.kind === "literal") {
			const seen = outputs.get(rule.set) ?? new Set<string>();
			const key = String(rule.to.value);
			if (seen.has(key)) return false;
			seen.add(key);
			outputs.set(rule.set, seen);
		}
	}
	if (![...counts.values()].every((n) => n <= 1)) return false;

	return everySubExpressionVaries(kb);
}

function everySubExpressionVaries(kb: KnowledgeBase): boolean {
	// Probe KB: each guard sub-expression becomes a synthetic derived fact.
	const probes: string[] = [];
	const facts: Record<string, FactDef> = { ...kb.facts };
	const rules: Rule[] = [...kb.rules];
	for (const rule of kb.rules) {
		if (rule.when === undefined) continue;
		const parts: Expr[] = [];
		subExprs(rule.when, parts);
		for (const part of parts) {
			// Literals are constants by nature; only operations must vary.
			if (part.kind === "literal") continue;
			const name = `__probe${probes.length}`;
			probes.push(name);
			facts[name] = { type: "boolean", derived: true };
			rules.push({
				id: `${name}_r`,
				cite: rule.cite,
				set: name,
				to: part,
				because: "probe",
			});
		}
	}
	const derived = Object.keys(kb.facts).filter(
		(n) => (kb.facts[n] as FactDef).derived === true,
	);
	const watched = [...derived, ...probes];
	const probeKb: KnowledgeBase = { ...kb, goals: watched, facts, rules };
	const seen = new Map<string, Set<string>>(
		watched.map((n) => [n, new Set<string>()]),
	);
	for (const full of assignments(probeKb, {})) {
		const ref = referenceVerdict(probeKb, full);
		for (const name of watched) {
			const entry = ref.goalEntries[name];
			if (entry === undefined || entry.status !== "known") return false;
			(seen.get(name) as Set<string>).add(JSON.stringify(entry.value));
		}
	}
	return [...seen.values()].every((set) => set.size > 1);
}

/** Pool of draws; cheap to shrink (integers toward 0) and bounded in size. */
const drawPoolArb = fc.array(fc.integer({ min: 0, max: 999 }), {
	minLength: 0,
	maxLength: 160,
});

/**
 * Read-once Knowledge_Bases of boolean and enum facts for the no-wasted-
 * questions property. Built by construction: every derived fact has two live
 * rules (the last unguarded) and every guard is an and/or tree over distinct
 * facts, so every sub-expression can vary. Exhausted pools draw the minimum.
 */
export const readOnceKbArb: fc.Arbitrary<KnowledgeBase> = drawPoolArb.map(
	(pool) => {
		let i = 0;
		const draw: Draw = (min, max) => {
			const v = i < pool.length ? (pool[i] as number) : 0;
			i++;
			return min + (v % (max - min + 1));
		};
		return buildKb(draw);
	},
);
