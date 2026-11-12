// Test-only generators for Sessions and answer values. No Node imports.

import fc from "fast-check";
import type {
	Expr,
	FactDef,
	FactType,
	FactValue,
	KnowledgeBase,
	Session,
} from "../types";
import { dateArb } from "./kb-arb";

/** Names of the facts a user may answer (not derived), in `facts` order. */
export function askableFacts(kb: KnowledgeBase): string[] {
	return Object.keys(kb.facts).filter(
		(name) => (kb.facts[name] as FactDef).derived !== true,
	);
}

type LiteralPool = Record<"number" | "money" | "date", FactValue[]>;

function collectLiterals(expr: Expr, pool: LiteralPool): void {
	switch (expr.kind) {
		case "literal":
			if (
				(expr.type === "number" || expr.type === "money") &&
				typeof expr.value === "number"
			) {
				pool[expr.type].push(expr.value);
			} else if (expr.type === "date" && typeof expr.value === "string") {
				pool.date.push(expr.value);
			}
			return;
		case "fact":
			return;
		case "unary":
			collectLiterals(expr.operand, pool);
			return;
		case "binary":
			collectLiterals(expr.left, pool);
			collectLiterals(expr.right, pool);
			return;
		case "call":
			for (const arg of expr.args) collectLiterals(arg, pool);
			return;
	}
}

function literalPool(kb: KnowledgeBase): LiteralPool {
	const pool: LiteralPool = { number: [], money: [], date: [] };
	for (const rule of kb.rules) {
		collectLiterals(rule.to, pool);
		if (rule.when !== undefined) collectLiterals(rule.when, pool);
	}
	return pool;
}

/** A day before or after a valid date, kept inside the generator's year range. */
function nearDate(date: string, delta: number): string {
	const day = Number(date.slice(8, 10)) + delta;
	if (day < 1 || day > 28) return date;
	return `${date.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

/**
 * A valid answer value for one fact. Number, money and date values are often
 * a literal of the knowledge base or one step from it, so comparisons against
 * the answered fact get probed (Requirement 21, criterion 10).
 */
function valueArb(def: FactDef, pool: LiteralPool): fc.Arbitrary<FactValue> {
	switch (def.type) {
		case "boolean":
			return fc.boolean();
		case "enum": {
			const options = def.options ?? [];
			return options.length > 0
				? fc.constantFrom(...options)
				: fc.constant("opt_a");
		}
		case "number": {
			const random = fc.integer({ min: -1000, max: 1000 });
			const near = pool.number as number[];
			return near.length === 0
				? random
				: fc.oneof(
						random,
						fc
							.tuple(fc.constantFrom(...near), fc.integer({ min: -1, max: 1 }))
							.map(([v, d]) => v + d),
					);
		}
		case "money": {
			const random = fc.integer({ min: 0, max: 2_000_000 });
			const near = pool.money as number[];
			return near.length === 0
				? random
				: fc.oneof(
						random,
						fc
							.tuple(fc.constantFrom(...near), fc.integer({ min: -1, max: 1 }))
							.map(([v, d]) => Math.max(0, v + d)),
					);
		}
		case "date": {
			const random = dateArb();
			const near = pool.date as string[];
			return near.length === 0
				? random
				: fc.oneof(
						random,
						fc
							.tuple(fc.constantFrom(...near), fc.integer({ min: -1, max: 1 }))
							.map(([v, d]) => nearDate(v, d)),
					);
		}
	}
}

/** A valid answer value for the named askable fact of `kb`. */
export function answerValueArb(
	kb: KnowledgeBase,
	fact: string,
): fc.Arbitrary<FactValue> {
	return valueArb(kb.facts[fact] as FactDef, literalPool(kb));
}

/**
 * Sessions over `kb`: each askable fact is answered with a valid value or left
 * unanswered. The empty set and the full set are generated on purpose.
 */
export function sessionArb(kb: KnowledgeBase): fc.Arbitrary<Session> {
	const names = askableFacts(kb);
	const pool = literalPool(kb);
	const entries = names.map((name) =>
		fc.tuple(
			fc.constant(name),
			fc.boolean(),
			valueArb(kb.facts[name] as FactDef, pool),
		),
	);
	return fc
		.tuple(
			fc.constantFrom("empty", "full", "some", "some"),
			fc.tuple(...entries),
		)
		.map(([mode, drawn]) => {
			const answers: Record<string, FactValue> = {};
			for (const [name, keep, value] of drawn) {
				if (mode === "full" || (mode === "some" && keep)) {
					answers[name] = value;
				}
			}
			return { kb, answers } satisfies Session;
		});
}

/** The fact types that appear on askable facts of `kb`. */
export function askableTypes(kb: KnowledgeBase): FactType[] {
	return askableFacts(kb).map((n) => (kb.facts[n] as FactDef).type);
}
