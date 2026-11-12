// Test-only generators for Knowledge_Bases. Never imported from non-test
// source and never re-exported from index.ts. No Node imports.

import fc from "fast-check";
import type {
	BinaryOp,
	Clause,
	Expr,
	FactDef,
	FactType,
	KnowledgeBase,
	Rule,
} from "../types";

type Draw = <T>(arb: fc.Arbitrary<T>) => T;

/** A fact visible to an expression: declared earlier than the rule's fact. */
interface Visible {
	readonly name: string;
	readonly type: FactType;
	readonly options: readonly string[];
}

const ALL_TYPES: readonly FactType[] = [
	"boolean",
	"number",
	"money",
	"date",
	"enum",
];

const COMPARISONS: readonly BinaryOp[] = ["<", "<=", ">", ">=", "==", "!="];
const EQUALITY: readonly BinaryOp[] = ["==", "!="];
const GENERIC_OPTIONS: readonly string[] = ["opt_a", "opt_b", "opt_c", "opt_d"];

function int(g: Draw, min: number, max: number): number {
	return g(fc.integer({ min, max }));
}

function chance(g: Draw, percent: number): boolean {
	return int(g, 0, 99) < percent;
}

function pick<T>(g: Draw, items: readonly T[]): T {
	return items[int(g, 0, items.length - 1)] as T;
}

function pad(n: number, width: number): string {
	return String(n).padStart(width, "0");
}

/** A valid ISO date (day capped at 28 so every month is valid). */
export function dateArb(): fc.Arbitrary<string> {
	return fc
		.tuple(
			fc.integer({ min: 1990, max: 2035 }),
			fc.integer({ min: 1, max: 12 }),
			fc.integer({ min: 1, max: 28 }),
		)
		.map(([y, m, d]) => `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`);
}

// ─── Expression builders (always well typed, never divide) ────────────────

function lit(type: FactType, value: boolean | number | string): Expr {
	return { kind: "literal", type, value };
}

function factRef(name: string): Expr {
	return { kind: "fact", name };
}

function bin(op: BinaryOp, left: Expr, right: Expr): Expr {
	return { kind: "binary", op, left, right };
}

function call(
	fn: "min" | "max" | "round" | "if" | "days_between",
	args: Expr[],
) {
	return { kind: "call", fn, args } satisfies Expr;
}

function ofType(vis: readonly Visible[], type: FactType): Visible[] {
	return vis.filter((v) => v.type === type);
}

function literalOf(g: Draw, type: FactType, options: readonly string[]): Expr {
	switch (type) {
		case "boolean":
			return lit("boolean", g(fc.boolean()));
		case "number": {
			const quarter = int(g, -200, 2000);
			return lit(
				"number",
				chance(g, 30) ? quarter / 4 : Math.trunc(quarter / 4),
			);
		}
		case "money":
			return lit("money", int(g, 0, 1_000_000));
		case "date":
			return lit("date", g(dateArb()));
		case "enum":
			return lit(
				"enum",
				pick(g, options.length > 0 ? options : GENERIC_OPTIONS),
			);
	}
}

function leafOf(
	g: Draw,
	vis: readonly Visible[],
	type: FactType,
	options: readonly string[],
): Expr {
	const facts = ofType(vis, type);
	if (facts.length > 0 && chance(g, 60)) return factRef(pick(g, facts).name);
	return literalOf(g, type, options);
}

function genBool(g: Draw, vis: readonly Visible[], depth: number): Expr {
	if (depth <= 0) {
		return chance(g, 25)
			? leafOf(g, vis, "boolean", [])
			: genComparison(g, vis, 0);
	}
	const roll = int(g, 0, 99);
	if (roll < 35) return genComparison(g, vis, depth - 1);
	if (roll < 50) return leafOf(g, vis, "boolean", []);
	if (roll < 62)
		return { kind: "unary", op: "not", operand: genBool(g, vis, depth - 1) };
	if (roll < 70) {
		return call("if", [
			genBool(g, vis, depth - 1),
			genBool(g, vis, depth - 1),
			genBool(g, vis, depth - 1),
		]);
	}
	return bin(
		roll < 85 ? "and" : "or",
		genBool(g, vis, depth - 1),
		genBool(g, vis, depth - 1),
	);
}

function genComparison(g: Draw, vis: readonly Visible[], depth: number): Expr {
	const type = pick(g, ALL_TYPES);
	if (type === "boolean") {
		return bin(
			pick(g, EQUALITY),
			leafOf(g, vis, "boolean", []),
			depth > 0 ? genBool(g, vis, depth - 1) : leafOf(g, vis, "boolean", []),
		);
	}
	const op = type === "enum" ? pick(g, EQUALITY) : pick(g, COMPARISONS);
	const facts = ofType(vis, type);
	const options =
		type === "enum" && facts.length > 0 ? pick(g, facts).options : [];
	// Compare a fact against a literal often, so answered facts get probed.
	if (facts.length > 0 && chance(g, 65)) {
		const left = factRef(pick(g, facts).name);
		const right = literalOf(g, type, options);
		return chance(g, 50) ? bin(op, left, right) : bin(op, right, left);
	}
	return bin(
		op,
		genByType(g, vis, type, options, depth),
		genByType(g, vis, type, options, depth),
	);
}

function genNumber(g: Draw, vis: readonly Visible[], depth: number): Expr {
	if (depth <= 0) return leafOf(g, vis, "number", []);
	const roll = int(g, 0, 99);
	if (roll < 25) return leafOf(g, vis, "number", []);
	const sub = () => genNumber(g, vis, depth - 1);
	if (roll < 45) return bin(pick(g, ["+", "-", "*"] as const), sub(), sub());
	if (roll < 60) return call(pick(g, ["min", "max"] as const), [sub(), sub()]);
	if (roll < 70) return call("round", [sub()]);
	if (roll < 82) {
		return call("days_between", [
			genDate(g, vis, depth - 1),
			genDate(g, vis, depth - 1),
		]);
	}
	return call("if", [genBool(g, vis, depth - 1), sub(), sub()]);
}

/** Money values stay whole: only +, -, min, max, if and round(...). */
function genMoney(g: Draw, vis: readonly Visible[], depth: number): Expr {
	if (depth <= 0) return leafOf(g, vis, "money", []);
	const roll = int(g, 0, 99);
	if (roll < 25) return leafOf(g, vis, "money", []);
	const sub = () => genMoney(g, vis, depth - 1);
	if (roll < 45) return bin(pick(g, ["+", "-"] as const), sub(), sub());
	if (roll < 65) return call(pick(g, ["min", "max"] as const), [sub(), sub()]);
	if (roll < 85) {
		const rate = lit("number", int(g, 0, 40) / 40);
		return call("round", [bin("*", sub(), rate)]);
	}
	return call("if", [genBool(g, vis, depth - 1), sub(), sub()]);
}

function genDate(g: Draw, vis: readonly Visible[], depth: number): Expr {
	if (depth > 0 && chance(g, 20)) {
		return call("if", [
			genBool(g, vis, depth - 1),
			genDate(g, vis, depth - 1),
			genDate(g, vis, depth - 1),
		]);
	}
	return leafOf(g, vis, "date", []);
}

function genEnum(
	g: Draw,
	vis: readonly Visible[],
	options: readonly string[],
	depth: number,
): Expr {
	if (depth > 0 && chance(g, 25)) {
		return call("if", [
			genBool(g, vis, depth - 1),
			genEnum(g, vis, options, depth - 1),
			genEnum(g, vis, options, depth - 1),
		]);
	}
	return leafOf(g, vis, "enum", options);
}

function genByType(
	g: Draw,
	vis: readonly Visible[],
	type: FactType,
	options: readonly string[],
	depth: number,
): Expr {
	switch (type) {
		case "boolean":
			return genBool(g, vis, depth);
		case "number":
			return genNumber(g, vis, depth);
		case "money":
			return genMoney(g, vis, depth);
		case "date":
			return genDate(g, vis, depth);
		case "enum":
			return genEnum(g, vis, options, depth);
	}
}

/** An output expression for an enum fact: only that fact's own options. */
function genEnumOutput(
	g: Draw,
	vis: readonly Visible[],
	options: readonly string[],
	depth: number,
): Expr {
	if (depth > 0 && chance(g, 30)) {
		return call("if", [
			genBool(g, vis, depth - 1),
			genEnumOutput(g, vis, options, depth - 1),
			genEnumOutput(g, vis, options, depth - 1),
		]);
	}
	return literalOf(g, "enum", options);
}

/** Adapts the fast-check generator value to a plain `Draw` function. */
function drawer(gen: fc.GeneratorValue): Draw {
	return <T>(arb: fc.Arbitrary<T>): T => gen(() => arb);
}

// ─── Knowledge_Base ───────────────────────────────────────────────────────

function buildKb(g: Draw): KnowledgeBase {
	const factCount = int(g, 0, 30);
	const names: string[] = [];
	const defs: Record<string, FactDef> = {};
	const visible: Visible[] = [];
	const derivedIndexes: number[] = [];

	for (let i = 0; i < factCount; i++) {
		const name = `f${i}`;
		const type = pick(g, ALL_TYPES);
		const derived = i > 0 && chance(g, 40);
		const options =
			type === "enum"
				? GENERIC_OPTIONS.slice(0, int(g, 1, GENERIC_OPTIONS.length))
				: [];
		const def: FactDef = {
			type,
			...(derived ? { derived: true } : { ask: `Question about ${name}?` }),
			...(!derived && chance(g, 40) ? { why: `Because ${name} matters.` } : {}),
			...(type === "enum" ? { options } : {}),
			...(derived && chance(g, 50)
				? { role: pick(g, ["deduction", "check"] as const) }
				: {}),
			...(chance(g, 30) ? { label: `Label ${i}` } : {}),
		};
		names.push(name);
		defs[name] = def;
		if (derived) derivedIndexes.push(i);
		visible.push({ name, type, options });
	}

	const ruleCount = derivedIndexes.length === 0 ? 0 : int(g, 0, 60);
	const clauseCount = ruleCount > 0 ? int(g, 1, 5) : int(g, 0, 3);
	const clauses: Record<string, Clause> = {};
	for (let c = 0; c < clauseCount; c++) {
		clauses[`c${c}`] = {
			id: `c${c}`,
			title: `Clause ${c}`,
			text: `Text of clause ${c}.`,
		};
	}

	const rules: Rule[] = [];
	for (let r = 0; r < ruleCount; r++) {
		const index = pick(g, derivedIndexes);
		const target = visible[index] as Visible;
		const earlier = visible.slice(0, index);
		const when = chance(g, 55) ? genBool(g, earlier, int(g, 0, 2)) : undefined;
		const to =
			target.type === "enum"
				? genEnumOutput(g, earlier, target.options, int(g, 0, 2))
				: genByType(g, earlier, target.type, target.options, int(g, 0, 3));
		const refs = ofType(earlier, "boolean");
		const because =
			refs.length > 0 && chance(g, 50)
				? `Rule ${r} applied because {${pick(g, refs).name}}.`
				: `Rule ${r} applied.`;
		rules.push({
			id: `r${r}`,
			cite: `c${int(g, 0, clauseCount - 1)}`,
			set: target.name,
			to,
			...(when !== undefined ? { when } : {}),
			because,
		});
	}

	const goalCount = Math.min(int(g, 0, 3), factCount);
	const goals: string[] = [];
	for (let k = 0; k < goalCount; k++) {
		const pool =
			derivedIndexes.length > 0 && chance(g, 70)
				? derivedIndexes
				: names.map((_, i) => i);
		const name = names[pick(g, pool)] as string;
		if (!goals.includes(name)) goals.push(name);
	}

	const hasMoney = Object.values(defs).some((d) => d.type === "money");
	return {
		id: "generated",
		...(hasMoney && chance(g, 70) ? { currency: "USD" } : {}),
		goals,
		facts: defs,
		rules,
		clauses,
	};
}

/** Cycle-free Knowledge_Bases: 0 to 30 facts, 0 to 60 rules, layered. */
export const kbArb: fc.Arbitrary<KnowledgeBase> = fc
	.gen()
	.map((gen) => buildKb(drawer(gen)));

/**
 * A Knowledge_Base with one back edge added, so that `validateKb` finds a
 * cycle. The goals and fact names stay valid, so the cycle is the only fault.
 */
export const cyclicKbArb: fc.Arbitrary<KnowledgeBase> = fc.gen().map((gen) => {
	const g = drawer(gen);
	const base = buildKb(g);
	if (base.rules.length === 0) {
		// No rules: a rule that reads the fact it sets is a self-cycle.
		const name = Object.keys(base.facts)[0] ?? "f0";
		const facts: Record<string, FactDef> = {
			...base.facts,
			[name]: base.facts[name] ?? { type: "boolean", derived: true },
		};
		const clauses: Record<string, Clause> =
			Object.keys(base.clauses).length > 0
				? base.clauses
				: { c0: { id: "c0", title: "Clause 0", text: "Text of clause 0." } };
		const cite = Object.keys(clauses)[0] as string;
		const back: Rule = {
			id: "r_back",
			cite,
			set: name,
			to: factRef(name),
			because: "Self reference.",
		};
		return { ...base, facts, clauses, rules: [back] };
	}
	// Pick a rule that reads a fact, then add a rule that makes that fact
	// depend on the rule's own fact.
	const withRefs = base.rules.filter((r) => collectRefs(r.to).length > 0);
	const source = withRefs.length > 0 ? pick(g, withRefs) : undefined;
	const clauseId = Object.keys(base.clauses)[0] as string;
	if (source === undefined) {
		const only = pick(g, base.rules);
		const back: Rule = {
			id: "r_back",
			cite: clauseId,
			set: only.set,
			to: factRef(only.set),
			because: "Self reference.",
		};
		return { ...base, rules: [...base.rules, back] };
	}
	const target = pick(g, collectRefs(source.to));
	const back: Rule = {
		id: "r_back",
		cite: clauseId,
		set: target,
		to: lit("boolean", true),
		when: factRef(source.set),
		because: "Back edge.",
	};
	return { ...base, rules: [...base.rules, back] };
});

function collectRefs(expr: Expr): string[] {
	switch (expr.kind) {
		case "literal":
			return [];
		case "fact":
			return [expr.name];
		case "unary":
			return collectRefs(expr.operand);
		case "binary":
			return [...collectRefs(expr.left), ...collectRefs(expr.right)];
		case "call":
			return expr.args.flatMap(collectRefs);
	}
}
