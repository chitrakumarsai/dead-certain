// Test-only generators. Never imported from non-test source, never exported from index.ts.
import type { KnowledgeBase } from "@dead-certain/engine";
import fc from "fast-check";
import type { DiagnosticCode } from "../diagnostics";
import { docOf, type KbDoc, renderDoc } from "./render";

export type ReferenceFaultName =
	| "unknown_fact"
	| "duplicate_rule"
	| "unknown_goal"
	| "unknown_set_fact"
	| "unknown_clause"
	| "unknown_placeholder"
	| "goal_unset"
	| "missing_ask"
	| "set_non_derived";

export type SchemaFaultName =
	| "missing_field"
	| "wrong_type"
	| "unknown_key"
	| "bad_currency";

export type FaultName = ReferenceFaultName | SchemaFaultName;

export const REFERENCE_FAULTS: readonly ReferenceFaultName[] = [
	"unknown_fact",
	"duplicate_rule",
	"unknown_goal",
	"unknown_set_fact",
	"unknown_clause",
	"unknown_placeholder",
	"goal_unset",
	"missing_ask",
	"set_non_derived",
];

export const SCHEMA_FAULTS: readonly SchemaFaultName[] = [
	"missing_field",
	"wrong_type",
	"unknown_key",
	"bad_currency",
];

/** The one diagnostic an injected fault must produce. */
export interface ExpectedFault {
	readonly code: DiagnosticCode;
	/** Rule id, fact name, goal or clause id that carries the diagnostic. Absent for top-level schema faults. */
	readonly id?: string;
	/** The offending name: the unknown fact, goal, clause or placeholder; for schema faults the field or key. */
	readonly name?: string;
	/** "to" or "when" for an expression fault. */
	readonly field?: string;
}

export interface InjectedFault {
	readonly fault: FaultName;
	readonly kind: "reference" | "schema";
	/** The faulty document, as a plain object. */
	readonly doc: KbDoc;
	/** The faulty document rendered as YAML. */
	readonly text: string;
	readonly expected: ExpectedFault;
}

const UNKNOWN_FACT = "no_such_fact_x";
const UNKNOWN_GOAL = "no_such_goal";
const UNKNOWN_SET = "no_such_set";
const UNKNOWN_CLAUSE = "no_such_clause";
const UNKNOWN_PLACEHOLDER = "no_such_ph";

function pick<T>(items: readonly T[], index: number): T {
	const item = items[index % items.length];
	if (item === undefined) throw new Error("pick from an empty list");
	return item;
}

function firstClauseId(doc: KbDoc): string {
	const id = Object.keys(doc.clauses)[0];
	if (id === undefined) throw new Error("knowledge base has no clause");
	return id;
}

/** Guarantees at least one rule, by adding a derived fact and a rule that sets it. */
function ensureRule(doc: KbDoc): void {
	if (doc.rules.length > 0) return;
	doc.facts.fault_target = { type: "number", derived: true };
	doc.rules.push({
		id: "R-0",
		cite: firstClauseId(doc),
		set: "fault_target",
		to: "1",
		because: "Base rule.",
	});
}

function ruleId(rule: Record<string, unknown>): string {
	return String(rule.id);
}

interface Built {
	readonly doc: KbDoc;
	readonly expected: ExpectedFault;
}

/** One schema-fault target: where it is, and how to break it. */
interface Target {
	readonly id: string | undefined;
	readonly name: string;
	readonly owner: Record<string, unknown>;
}

function schemaTargets(doc: KbDoc, fields: Record<string, string[]>): Target[] {
	const out: Target[] = [];
	for (const rule of doc.rules) {
		for (const f of fields.rule ?? []) {
			out.push({ id: ruleId(rule), name: f, owner: rule });
		}
	}
	for (const [cid, clause] of Object.entries(doc.clauses)) {
		for (const f of fields.clause ?? []) {
			out.push({ id: cid, name: f, owner: clause });
		}
	}
	for (const [fname, def] of Object.entries(doc.facts)) {
		for (const f of fields.fact ?? []) {
			if (f in def) out.push({ id: fname, name: f, owner: def });
		}
	}
	return out;
}

function inject(
	kb: KnowledgeBase,
	fault: FaultName,
	a: number,
	b: number,
): Built {
	const doc = docOf(kb);
	ensureRule(doc);
	const rule = pick(doc.rules, a);
	const id = ruleId(rule);
	switch (fault) {
		case "unknown_fact":
			rule.when = `${UNKNOWN_FACT} > 1`;
			return {
				doc,
				expected: {
					code: "UNKNOWN_FACT",
					id,
					name: UNKNOWN_FACT,
					field: "when",
				},
			};
		case "duplicate_rule":
			doc.rules.push({ ...rule });
			return { doc, expected: { code: "DUPLICATE_RULE", id, name: id } };
		case "unknown_goal":
			doc.goals.push(UNKNOWN_GOAL);
			return {
				doc,
				expected: {
					code: "UNKNOWN_GOAL",
					id: UNKNOWN_GOAL,
					name: UNKNOWN_GOAL,
				},
			};
		case "unknown_set_fact":
			// Add a fresh rule so the real setter of every fact (and goal) stays in place.
			doc.rules.push({
				id: "R-fault-set",
				cite: firstClauseId(doc),
				set: UNKNOWN_SET,
				to: "1",
				because: "Forced.",
			});
			return {
				doc,
				expected: {
					code: "UNKNOWN_SET_FACT",
					id: "R-fault-set",
					name: UNKNOWN_SET,
				},
			};
		case "unknown_clause":
			rule.cite = UNKNOWN_CLAUSE;
			return {
				doc,
				expected: { code: "UNKNOWN_CLAUSE", id, name: UNKNOWN_CLAUSE },
			};
		case "unknown_placeholder":
			rule.because = `${String(rule.because)} {${UNKNOWN_PLACEHOLDER}}`;
			return {
				doc,
				expected: {
					code: "UNKNOWN_PLACEHOLDER",
					id,
					name: UNKNOWN_PLACEHOLDER,
				},
			};
		case "goal_unset":
			doc.facts.unset_goal_fact = { type: "number", derived: true };
			doc.goals.push("unset_goal_fact");
			return {
				doc,
				expected: {
					code: "GOAL_UNSET",
					id: "unset_goal_fact",
					name: "unset_goal_fact",
				},
			};
		case "missing_ask":
			doc.facts.no_ask_fact = { type: "number" };
			return {
				doc,
				expected: {
					code: "MISSING_ASK",
					id: "no_ask_fact",
					name: "no_ask_fact",
				},
			};
		case "set_non_derived":
			doc.facts.plain_fact = { type: "number", ask: "What is it?" };
			doc.rules.push({
				id: "R-fault",
				cite: firstClauseId(doc),
				set: "plain_fact",
				to: "1",
				because: "Forced.",
			});
			return {
				doc,
				expected: {
					code: "SET_NON_DERIVED",
					id: "R-fault",
					name: "plain_fact",
				},
			};
		case "missing_field": {
			const target = pick(
				schemaTargets(doc, {
					rule: ["cite", "set", "because", "to"],
					clause: ["title", "text"],
					fact: ["type"],
				}),
				b,
			);
			delete target.owner[target.name];
			return {
				doc,
				expected: {
					code: "SCHEMA_INVALID",
					...(target.id === undefined ? {} : { id: target.id }),
					name: target.name,
				},
			};
		}
		case "wrong_type": {
			// `to` and `when` accept numbers and booleans, so they are not candidates.
			const target = pick(
				schemaTargets(doc, {
					rule: ["because", "set"],
					clause: ["title", "text"],
					fact: ["ask"],
				}),
				b,
			);
			target.owner[target.name] = a % 2 === 0 ? 7 : true;
			return {
				doc,
				expected: {
					code: "SCHEMA_INVALID",
					...(target.id === undefined ? {} : { id: target.id }),
					name: target.name,
				},
			};
		}
		case "unknown_key": {
			const levels: Target[] = [
				{ id: undefined, name: "colour_x", owner: doc },
				...schemaTargets(doc, {
					rule: ["id"],
					clause: ["title"],
					fact: ["type"],
				}).map((t) => ({ ...t, name: "colour_x" })),
			];
			const target = pick(levels, b);
			target.owner.colour_x = 1;
			return {
				doc,
				expected: {
					code: "SCHEMA_INVALID",
					...(target.id === undefined ? {} : { id: target.id }),
					name: "colour_x",
				},
			};
		}
		default: {
			doc.currency = pick(["inr", "Rs", "USDX", "12", "US"], b);
			return {
				doc,
				expected: { code: "SCHEMA_INVALID", name: "currency" },
			};
		}
	}
}

/**
 * Injects exactly one named fault into a valid knowledge base and returns the faulty
 * document, its YAML text and the diagnostic the validator must report for it.
 * `kinds` limits the choice to reference faults, schema faults, or (default) both.
 */
export function faultArb(
	kb: KnowledgeBase,
	kinds: "reference" | "schema" | "all" = "all",
): fc.Arbitrary<InjectedFault> {
	const names: readonly FaultName[] =
		kinds === "reference"
			? REFERENCE_FAULTS
			: kinds === "schema"
				? SCHEMA_FAULTS
				: [...REFERENCE_FAULTS, ...SCHEMA_FAULTS];
	return fc
		.tuple(fc.constantFrom(...names), fc.nat(), fc.nat())
		.map(([fault, a, b]) => {
			const { doc, expected } = inject(kb, fault, a, b);
			return {
				fault,
				kind: (SCHEMA_FAULTS as readonly FaultName[]).includes(fault)
					? "schema"
					: "reference",
				doc,
				text: renderDoc(doc),
				expected,
			} satisfies InjectedFault;
		});
}
