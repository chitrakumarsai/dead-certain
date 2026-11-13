// Test-only generators. Never imported from non-test source, never exported from index.ts.
import type {
	Clause,
	Expr,
	FactDef,
	FactType,
	FactValue,
	KnowledgeBase,
	Rule,
} from "@dead-certain/engine";
import fc from "fast-check";
import {
	dateStringArb,
	exprArb,
	roundedMoneyExprArb,
	type ScopeFact,
} from "./expr";

const RESERVED = new Set([
	"true",
	"false",
	"and",
	"or",
	"not",
	"min",
	"max",
	"round",
	"if",
	"days_between",
]);

const FACT_TYPES: readonly FactType[] = [
	"boolean",
	"number",
	"money",
	"date",
	"enum",
];

const identArb = fc
	.stringMatching(/^[a-z_][a-z0-9_]{0,9}$/)
	.filter((s) => !RESERVED.has(s));

/** Ordinary identifiers plus names that live on Object.prototype. */
export const factNameArb: fc.Arbitrary<string> = fc.oneof(
	{ weight: 4, arbitrary: identArb },
	{
		weight: 1,
		arbitrary: fc.constantFrom("constructor", "toString", "__proto__"),
	},
);

/** Clause ids, including number-like strings that YAML would read as numbers. */
export const clauseIdArb: fc.Arbitrary<string> = fc.oneof(
	fc.constantFrom("4.2", "10", "1", "6.1", "3"),
	identArb.map((s) => `c_${s}`),
);

const wordArb = fc.constantFrom(
	"rent",
	"limit",
	"plan",
	"claim",
	"amount",
	"policy",
	"room",
	"cover",
);
const sentenceArb = fc
	.array(wordArb, { minLength: 1, maxLength: 4 })
	.map((w) => w.join(" "));
const optionArb = fc.constantFrom(
	"red",
	"green",
	"blue",
	"gold",
	"silver",
	"basic",
	"plus",
);
const optionsArb = fc.uniqueArray(optionArb, { minLength: 2, maxLength: 4 });

interface FactSpec {
	readonly name: string;
	readonly type: FactType;
	readonly options: readonly string[];
	readonly why: string | undefined;
	readonly label: string | undefined;
	readonly role: "deduction" | "check" | undefined;
}

const factSpecArb = (name: string, derived: boolean): fc.Arbitrary<FactSpec> =>
	fc
		.tuple(
			fc.constantFrom(...FACT_TYPES),
			optionsArb,
			fc.option(sentenceArb, { nil: undefined }),
			fc.option(sentenceArb, { nil: undefined }),
			fc.option(fc.constantFrom("deduction", "check" as const), {
				nil: undefined,
			}),
		)
		.map(([type, options, why, label, role]) => ({
			name,
			type,
			options,
			why: derived ? undefined : why,
			label: derived ? label : undefined,
			role: derived ? role : undefined,
		}));

function defOf(spec: FactSpec, derived: boolean): FactDef {
	const def: Record<string, unknown> = { type: spec.type };
	if (!derived) def.ask = `What is the ${spec.name.replace(/_/g, " ")}?`;
	if (spec.why !== undefined) def.why = spec.why;
	if (derived) def.derived = true;
	if (spec.type === "enum") def.options = [...spec.options];
	if (spec.role !== undefined) def.role = spec.role;
	if (spec.label !== undefined) def.label = spec.label;
	return def as unknown as FactDef;
}

function scopeOf(spec: FactSpec): ScopeFact {
	return spec.type === "enum"
		? { name: spec.name, type: spec.type, options: spec.options }
		: { name: spec.name, type: spec.type };
}

function toArb(
	spec: FactSpec,
	scope: readonly ScopeFact[],
): fc.Arbitrary<Expr> {
	switch (spec.type) {
		case "money":
			return roundedMoneyExprArb(scope, 2);
		case "number":
			return exprArb("number", scope, 2);
		case "boolean":
			return exprArb("boolean", scope, 2);
		case "date":
			return exprArb("date", scope, 1);
		default:
			return exprArb("enum", scope, 1, spec.options);
	}
}

interface RuleDraft {
	readonly to: Expr;
	readonly when: Expr | undefined;
	readonly cite: string;
	readonly mentions: readonly string[];
	readonly words: string;
}

function rulesArb(
	spec: FactSpec,
	scope: readonly ScopeFact[],
	clauseIds: readonly string[],
): fc.Arbitrary<readonly RuleDraft[]> {
	const names = scope.map((f) => f.name);
	const draft = fc
		.tuple(
			toArb(spec, scope),
			fc.option(exprArb("boolean", scope, 2), { nil: undefined }),
			fc.constantFrom(...clauseIds),
			fc.subarray(names, { maxLength: Math.min(2, names.length) }),
			sentenceArb,
		)
		.map(([to, when, cite, mentions, words]) => ({
			to,
			when,
			cite,
			mentions,
			words,
		}));
	return fc.array(draft, { minLength: 1, maxLength: 2 });
}

function becauseOf(draft: RuleDraft): string {
	const tail = draft.mentions.map((m) => `{${m}}`).join(" and ");
	return tail === "" ? `${draft.words}.` : `${draft.words}: ${tail}.`;
}

/**
 * A knowledge base with 1 to 6 askable and 0 to 6 derived facts. A derived fact reads
 * only facts earlier in the order, so the base is acyclic by construction.
 */
export const kbArb: fc.Arbitrary<KnowledgeBase> = fc
	.tuple(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 0, max: 6 }))
	.chain(([askCount, derivedCount]) => {
		const total = askCount + derivedCount;
		return fc
			.tuple(
				fc.uniqueArray(factNameArb, { minLength: total, maxLength: total }),
				fc.uniqueArray(clauseIdArb, { minLength: 1, maxLength: 4 }),
				fc.option(fc.constantFrom("INR", "USD", "EUR"), { nil: undefined }),
			)
			.chain(([names, clauseIds, currency]) =>
				fc
					.tuple(...names.map((name, i) => factSpecArb(name, i >= askCount)))
					.chain((specs) => {
						const derived = specs.slice(askCount);
						const ruleArbs = derived.map((spec, i) =>
							rulesArb(
								spec,
								specs.slice(0, askCount + i).map(scopeOf),
								clauseIds,
							),
						);
						const goalsArb =
							derived.length === 0
								? fc.constant<string[]>([])
								: fc.subarray(
										derived.map((s) => s.name),
										{ minLength: 1, maxLength: Math.min(2, derived.length) },
									);
						return fc
							.tuple(
								fc.tuple(...ruleArbs),
								goalsArb,
								fc.constantFrom("demo", "claim-check", "kb_1"),
							)
							.map(([drafts, goals, id]) => {
								let counter = 0;
								const rules: Rule[] = [];
								drafts.forEach((list, i) => {
									const spec = derived[i];
									if (spec === undefined) return;
									list.forEach((d, j) => {
										counter += 1;
										// A deduction fact gets an unguarded last rule, so no fallback warning.
										const unguarded =
											spec.role === "deduction" && j === list.length - 1;
										const base = {
											id: `R-${counter}`,
											cite: d.cite,
											set: spec.name,
											to: d.to,
											because: becauseOf(d),
										};
										rules.push(
											d.when !== undefined && !unguarded
												? { ...base, when: d.when }
												: base,
										);
									});
								});
								const facts = Object.fromEntries(
									specs.map((spec, i) => [
										spec.name,
										defOf(spec, i >= askCount),
									]),
								);
								const clauses: Record<string, Clause> = Object.fromEntries(
									clauseIds.map((cid) => [
										cid,
										{
											id: cid,
											title: `Clause ${cid}`,
											text: `Text of clause ${cid}.`,
										},
									]),
								);
								const kb: KnowledgeBase = {
									id,
									...(currency === undefined ? {} : { currency }),
									goals,
									facts,
									rules,
									clauses,
								};
								return kb;
							});
					}),
			);
	});

/**
 * Type-valid answers for the askable facts of `kb`. Money is an integer in ±10,000,
 * a number is finite in ±1,000, a date is a valid calendar date, an enum is one of its
 * options. With `partial`, each fact is answered or left out.
 */
export function answersArb(
	kb: KnowledgeBase,
	options: { readonly partial?: boolean } = {},
): fc.Arbitrary<Record<string, FactValue>> {
	const entries = Object.entries(kb.facts).filter(
		([, def]) => def.derived !== true,
	);
	const valueArb = (def: FactDef): fc.Arbitrary<FactValue> => {
		switch (def.type) {
			case "money":
				return fc.integer({ min: -10000, max: 10000 });
			case "number":
				return fc.integer({ min: -100000, max: 100000 }).map((n) => n / 100);
			case "boolean":
				return fc.boolean();
			case "date":
				return dateStringArb;
			default:
				return fc.constantFrom(...(def.options ?? ["red"]));
		}
	};
	const perFact = entries.map(([name, def]) =>
		(options.partial === true
			? fc.option(valueArb(def), { nil: undefined })
			: valueArb(def)
		).map((value) => [name, value] as const),
	);
	return fc.tuple(...perFact).map((pairs) => {
		const out: [string, FactValue][] = [];
		for (const [name, value] of pairs) {
			if (value !== undefined) out.push([name, value]);
		}
		return Object.fromEntries(out);
	});
}
