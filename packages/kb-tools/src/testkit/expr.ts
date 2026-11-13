// Test-only generators. Never imported from non-test source, never exported from index.ts.
import type { Expr, FactType } from "@dead-certain/engine";
import fc from "fast-check";

export type Sort = "boolean" | "number" | "date" | "enum";

/** A fact an expression may read. */
export interface ScopeFact {
	readonly name: string;
	readonly type: FactType;
	readonly options?: readonly string[];
}

/** Used when no enum fact is in scope. */
export const FALLBACK_OPTIONS: readonly string[] = ["red", "green", "blue"];

export function sortOf(type: FactType): Sort {
	return type === "money" ? "number" : type;
}

const CMP = ["<", "<=", ">", ">=", "==", "!="] as const;
const EQ = ["==", "!="] as const;
const ARITH = ["+", "-", "*", "/"] as const;
const ADDSUB = ["+", "-"] as const;
const MINMAX = ["min", "max"] as const;
const LOGIC = ["and", "or"] as const;

const num = (value: number): Expr => ({
	kind: "literal",
	type: "number",
	value,
});
const bool = (value: boolean): Expr => ({
	kind: "literal",
	type: "boolean",
	value,
});
const fact = (name: string): Expr => ({ kind: "fact", name });
const bin = (
	op: Extract<Expr, { kind: "binary" }>["op"],
	left: Expr,
	right: Expr,
): Expr => ({ kind: "binary", op, left, right });
const call = (
	fn: Extract<Expr, { kind: "call" }>["fn"],
	...args: Expr[]
): Expr => ({ kind: "call", fn, args });
const neg = (operand: Expr): Expr => ({ kind: "unary", op: "-", operand });

/** Integer literal, 0 to 100. */
export const intLiteralArb: fc.Arbitrary<Expr> = fc
	.integer({ min: 0, max: 100 })
	.map(num);

/** Decimal literal with at most two places that is not a whole number. */
export const fractionLiteralArb: fc.Arbitrary<Expr> = fc
	.integer({ min: 1, max: 9999 })
	.filter((n) => n % 100 !== 0)
	.map((n) => num(n / 100));

const decimalLiteralArb: fc.Arbitrary<Expr> = fc
	.integer({ min: 0, max: 10000 })
	.map((n) => num(n / 100));

/** A valid calendar date string; days stop at 28 so every month is valid. */
export const dateStringArb: fc.Arbitrary<string> = fc
	.tuple(
		fc.integer({ min: 1990, max: 2040 }),
		fc.integer({ min: 1, max: 12 }),
		fc.integer({ min: 1, max: 28 }),
	)
	.map(
		([y, m, d]) =>
			`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
	);

function factsOfSort(scope: readonly ScopeFact[], sort: Sort): ScopeFact[] {
	return scope.filter((f) => sortOf(f.type) === sort);
}

function enumPool(
	scope: readonly ScopeFact[],
	enumOptions: readonly string[] | undefined,
): readonly string[] {
	if (enumOptions !== undefined && enumOptions.length > 0) return enumOptions;
	const all = factsOfSort(scope, "enum").flatMap((f) => f.options ?? []);
	return all.length > 0 ? all : FALLBACK_OPTIONS;
}

function enumLiteral(value: string): Expr {
	return { kind: "literal", type: "enum", value };
}

/**
 * Well-typed expressions of one sort over the facts in scope. Integer literals are
 * 0 to 100, decimals have two places, and a division right-hand side can be zero.
 * `enumOptions` limits the enum literals and enum facts used in the enum sort.
 */
export function exprArb(
	sort: Sort,
	scope: readonly ScopeFact[],
	depth: number,
	enumOptions?: readonly string[],
): fc.Arbitrary<Expr> {
	const memo = new Map<string, fc.Arbitrary<Expr>>();
	const build = (s: Sort, d: number): fc.Arbitrary<Expr> => {
		const key = `${s}:${d}`;
		const cached = memo.get(key);
		if (cached !== undefined) return cached;
		const made = make(s, d);
		memo.set(key, made);
		return made;
	};

	const leaf = (s: Sort): fc.Arbitrary<Expr> => {
		const refs = factsOfSort(scope, s)
			.filter((f) => {
				if (s !== "enum" || enumOptions === undefined) return true;
				return (f.options ?? []).every((o) => enumOptions.includes(o));
			})
			.map((f) => fact(f.name));
		let literal: fc.Arbitrary<Expr>;
		switch (s) {
			case "boolean":
				literal = fc.boolean().map(bool);
				break;
			case "number":
				literal = fc.oneof(intLiteralArb, decimalLiteralArb);
				break;
			case "date":
				literal = dateStringArb.map((value) => ({
					kind: "literal",
					type: "date",
					value,
				}));
				break;
			default:
				literal = fc
					.constantFrom(...enumPool(scope, enumOptions))
					.map(enumLiteral);
		}
		return refs.length > 0
			? fc.oneof(literal, fc.constantFrom(...refs))
			: literal;
	};

	const comparison = (d: number): fc.Arbitrary<Expr> => {
		const n = build("number", d);
		const dt = build("date", d);
		const options: fc.Arbitrary<Expr>[] = [
			fc
				.tuple(fc.constantFrom(...CMP), n, n)
				.map(([op, l, r]) => bin(op, l, r)),
			fc
				.tuple(fc.constantFrom(...CMP), dt, dt)
				.map(([op, l, r]) => bin(op, l, r)),
			fc
				.tuple(fc.constantFrom(...EQ), build("boolean", d), build("boolean", d))
				.map(([op, l, r]) => bin(op, l, r)),
			enumComparison(),
		];
		return fc.oneof(...options);
	};

	const enumComparison = (): fc.Arbitrary<Expr> => {
		const enums = factsOfSort(scope, "enum");
		const op = fc.constantFrom(...EQ);
		if (enums.length === 0) {
			const lit = fc.constantFrom(...FALLBACK_OPTIONS).map(enumLiteral);
			return fc.tuple(op, lit, lit).map(([o, l, r]) => bin(o, l, r));
		}
		return fc
			.constantFrom(...enums)
			.chain((f) =>
				fc
					.tuple(
						op,
						fc.constantFrom(...(f.options ?? FALLBACK_OPTIONS)),
						fc.boolean(),
					)
					.map(([o, value, flip]) =>
						flip
							? bin(o, enumLiteral(value), fact(f.name))
							: bin(o, fact(f.name), enumLiteral(value)),
					),
			);
	};

	const make = (s: Sort, d: number): fc.Arbitrary<Expr> => {
		const base = leaf(s);
		if (d <= 0) return base;
		const next = d - 1;
		const ifExpr = fc
			.tuple(build("boolean", next), build(s, next), build(s, next))
			.map(([c, t, e]) => call("if", c, t, e));
		switch (s) {
			case "number": {
				const n = build("number", next);
				return fc.oneof(
					base,
					fc
						.tuple(fc.constantFrom(...ARITH), n, n)
						.map(([op, l, r]) => bin(op, l, r)),
					n.map(neg),
					fc
						.tuple(fc.constantFrom(...MINMAX), n, n)
						.map(([fn, a, b]) => call(fn, a, b)),
					n.map((a) => call("round", a)),
					ifExpr,
					fc
						.tuple(build("date", next), build("date", next))
						.map(([a, b]) => call("days_between", a, b)),
				);
			}
			case "boolean": {
				const b = build("boolean", next);
				return fc.oneof(
					base,
					fc
						.tuple(fc.constantFrom(...LOGIC), b, b)
						.map(([op, l, r]) => bin(op, l, r)),
					b.map((operand): Expr => ({ kind: "unary", op: "not", operand })),
					comparison(next),
					ifExpr,
				);
			}
			default:
				return fc.oneof(base, ifExpr);
		}
	};

	return build(sort, depth);
}

/** A money expression tagged with whether it is a Rounded_Money_Expression. */
export interface TaggedMoneyExpr {
	readonly expr: Expr;
	readonly rounded: boolean;
}

/** Rounded money expressions only, built from the forms of Requirement 12.1. */
export function roundedMoneyExprArb(
	scope: readonly ScopeFact[],
	depth: number,
): fc.Arbitrary<Expr> {
	const moneyRefs = scope
		.filter((f) => f.type === "money")
		.map((f) => fact(f.name));
	const leaves: fc.Arbitrary<Expr>[] = [
		intLiteralArb,
		exprArb("number", scope, 1).map((a) => call("round", a)),
	];
	if (moneyRefs.length > 0) leaves.push(fc.constantFrom(...moneyRefs));
	const leaf = fc.oneof(...leaves);
	const cond = exprArb("boolean", scope, 1);
	const build = (d: number): fc.Arbitrary<Expr> => {
		if (d <= 0) return leaf;
		const r = build(d - 1);
		return fc.oneof(
			leaf,
			fc
				.tuple(fc.constantFrom(...MINMAX), r, r)
				.map(([fn, a, b]) => call(fn, a, b)),
			fc.tuple(cond, r, r).map(([c, t, e]) => call("if", c, t, e)),
			fc
				.tuple(fc.constantFrom(...ADDSUB), r, r)
				.map(([op, a, b]) => bin(op, a, b)),
			r.map(neg),
			fc
				.tuple(r, intLiteralArb, fc.boolean())
				.map(([a, k, flip]) => (flip ? bin("*", k, a) : bin("*", a, k))),
		);
	};
	return build(depth);
}

/** Deliberately unrounded money expressions: every one fails the Requirement 12.1 table. */
function unroundedMoneyExprArb(
	scope: readonly ScopeFact[],
	depth: number,
): fc.Arbitrary<Expr> {
	const numberRefs = scope
		.filter((f) => f.type === "number")
		.map((f) => fact(f.name));
	const rounded = roundedMoneyExprArb(scope, 1);
	const anyNumber = exprArb("number", scope, 1);
	const leaves: fc.Arbitrary<Expr>[] = [
		fractionLiteralArb,
		fc.tuple(anyNumber, anyNumber).map(([a, b]) => bin("/", a, b)),
		fc
			.tuple(fc.integer({ min: 1, max: 99 }), rounded, fc.boolean())
			.map(([n, a, flip]) =>
				flip ? bin("*", num(n / 100), a) : bin("*", a, num(n / 100)),
			),
		fc
			.tuple(rounded, rounded)
			.map(([a, b]) => bin("*", call("round", a), call("round", b))),
	];
	if (numberRefs.length > 0) leaves.push(fc.constantFrom(...numberRefs));
	const leaf = fc.oneof(...leaves);
	const cond = exprArb("boolean", scope, 1);
	const build = (d: number): fc.Arbitrary<Expr> => {
		if (d <= 0) return leaf;
		const u = build(d - 1);
		return fc.oneof(
			leaf,
			fc
				.tuple(fc.constantFrom(...MINMAX), u, rounded, fc.boolean())
				.map(([fn, a, b, flip]) => (flip ? call(fn, b, a) : call(fn, a, b))),
			fc
				.tuple(cond, u, rounded, fc.boolean())
				.map(([c, a, b, flip]) =>
					flip ? call("if", c, b, a) : call("if", c, a, b),
				),
			fc
				.tuple(fc.constantFrom(...ADDSUB), u, rounded, fc.boolean())
				.map(([op, a, b, flip]) => (flip ? bin(op, b, a) : bin(op, a, b))),
			u.map(neg),
		);
	};
	return build(depth);
}

/** Either a rounded money expression or a deliberately unrounded one, tagged. */
export function moneyExprArb(
	scope: readonly ScopeFact[],
	depth: number,
): fc.Arbitrary<TaggedMoneyExpr> {
	return fc.oneof(
		roundedMoneyExprArb(scope, depth).map((expr) => ({ expr, rounded: true })),
		unroundedMoneyExprArb(scope, depth).map((expr) => ({
			expr,
			rounded: false,
		})),
	);
}
