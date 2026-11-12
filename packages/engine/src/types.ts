// The contract between the lanes (BUILD_PLAN section 7). Declarations only.
// Changes need both lanes' consent. The engine in index.ts must satisfy EngineApi.

/** money: integer minor units. date: ISO string. enum: one of the fact's options. */
export type FactValue = boolean | number | string;

export type FactType = "boolean" | "number" | "money" | "date" | "enum";

/** Where a fact's value came from. */
export type FactSource = "answered" | "collected" | "derived";

/** Compiled expression. Its shape is owned by the rule-language spec, so it is opaque here. */
export type Expr = unknown;

export interface FactDef {
	readonly type: FactType;
	/** Question text. Present on facts the engine may ask for. */
	readonly ask?: string;
	readonly why?: string;
	readonly derived?: boolean;
	/** Allowed values when type is "enum". */
	readonly options?: readonly string[];
	/** Marks facts the interface lists as line items. */
	readonly role?: "deduction" | "check";
}

export interface Rule {
	readonly id: string;
	/** Clause id in the rulebook. */
	readonly cite: string;
	/** The fact this rule sets. */
	readonly set: string;
	readonly to: Expr;
	readonly when?: Expr;
	/** Plain sentence with {fact} placeholders. */
	readonly because: string;
}

export interface Clause {
	readonly id: string;
	readonly title: string;
	readonly text: string;
}

export interface KnowledgeBase {
	readonly id: string;
	/** ISO 4217 code, when the knowledge base uses money. */
	readonly currency?: string;
	readonly goals: readonly string[];
	readonly facts: Readonly<Record<string, FactDef>>;
	/** Rules for the same fact are tried in this order. */
	readonly rules: readonly Rule[];
	readonly clauses: Readonly<Record<string, Clause>>;
}

export interface Session {
	readonly kb: KnowledgeBase;
	readonly answers: Readonly<Record<string, FactValue>>;
}

export interface Question {
	readonly kind: "question";
	readonly fact: string;
	readonly text: string;
	readonly why?: string;
	/** Id of the clause that needs this answer. */
	readonly clause?: string;
}

export interface LineItem {
	readonly fact: string;
	readonly role: "deduction" | "check";
	readonly label: string;
	/** Undefined while the fact is unknown. */
	readonly value: FactValue | undefined;
	readonly rule: string;
	readonly clause: string;
}

export interface Verdict {
	readonly kind: "verdict";
	/** Goal values. Undefined means unknown. */
	readonly goals: Readonly<Record<string, FactValue | undefined>>;
	readonly lineItems: readonly LineItem[];
	/** Questions still needed. Empty once every goal is decided. */
	readonly needed: readonly Question[];
}

export interface ProofNode {
	readonly fact: string;
	readonly value: FactValue | undefined;
	readonly source: FactSource;
	/** Present when source is "derived". */
	readonly rule?: string;
	readonly clause?: string;
	/** The rule's sentence with its placeholders filled in. */
	readonly because?: string;
	readonly children: readonly ProofNode[];
}

/** A one-answer change that alters the verdict. */
export interface Alternative {
	readonly fact: string;
	readonly value: FactValue;
	readonly verdict: Verdict;
}

export interface EngineApi {
	start(kb: KnowledgeBase): Session;
	/** Consultation mode. */
	next(s: Session): Question | Verdict;
	/** Returns a new session. */
	answer(s: Session, fact: string, value: FactValue): Session;
	/** Audit mode. */
	audit(kb: KnowledgeBase, facts: Readonly<Record<string, FactValue>>): Verdict;
	explain(s: Session, fact: string): ProofNode;
	whatIf(s: Session): Alternative[];
	/** URL-safe replay token. */
	encode(s: Session): string;
	decode(kb: KnowledgeBase, token: string): Session;
}
