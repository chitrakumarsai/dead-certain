import type { Expr, FactDef } from "@dead-certain/engine";

/** One fact after the Schema check. `index` is its position in `facts`. */
export interface ParsedFact {
	readonly name: string;
	readonly index: number;
	readonly def: FactDef;
}

/**
 * One rule after the Schema check. `toText` and `whenText` are the canonical
 * expression text; `toExpr` and `whenExpr` are filled in by the parse step.
 */
export interface ParsedRule {
	readonly id: string;
	readonly index: number;
	readonly cite: string;
	readonly set: string;
	readonly because: string;
	readonly toText: string;
	readonly whenText?: string;
	toExpr?: Expr;
	whenExpr?: Expr;
}

/** One clause after the Schema check. The id is the key in `clauses`. */
export interface ParsedClause {
	readonly id: string;
	readonly index: number;
	readonly title: string;
	readonly text: string;
}

/**
 * A knowledge base that passed the Schema. Entities live in arrays and Maps,
 * never in prototype-bearing records keyed by user-chosen names.
 */
export interface ParsedKb {
	readonly id: string;
	readonly currency?: string;
	readonly goals: readonly string[];
	readonly facts: ReadonlyMap<string, ParsedFact>;
	readonly rules: readonly ParsedRule[];
	readonly clauses: ReadonlyMap<string, ParsedClause>;
}
