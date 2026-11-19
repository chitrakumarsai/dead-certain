import type { KnowledgeBase } from "@dead-certain/engine";

const FACT_TYPES = new Set(["boolean", "number", "money", "date", "enum"]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isStringArray = (v: unknown): v is string[] =>
	Array.isArray(v) && v.every(isString);
const isOptional = (v: unknown, check: (x: unknown) => boolean): boolean =>
	v === undefined || check(v);

function isFactDef(v: unknown): boolean {
	return (
		isRecord(v) &&
		FACT_TYPES.has(v.type as string) &&
		isOptional(v.ask, isString) &&
		isOptional(v.why, isString) &&
		isOptional(v.derived, (x) => typeof x === "boolean") &&
		isOptional(v.options, isStringArray) &&
		isOptional(v.role, (x) => x === "deduction" || x === "check") &&
		isOptional(v.label, isString)
	);
}

function isRule(v: unknown): boolean {
	return (
		isRecord(v) &&
		isString(v.id) &&
		isString(v.cite) &&
		isString(v.set) &&
		isRecord(v.to) &&
		isOptional(v.when, isRecord) &&
		isString(v.because)
	);
}

function isClause(v: unknown): boolean {
	return isRecord(v) && isString(v.id) && isString(v.title) && isString(v.text);
}

/** A hand-written guard for the compiled JSON. Rule expressions are trusted to `dc build`. */
export function isKnowledgeBase(v: unknown): v is KnowledgeBase {
	return (
		isRecord(v) &&
		isString(v.id) &&
		isOptional(v.currency, isString) &&
		isStringArray(v.goals) &&
		v.goals.length > 0 &&
		isRecord(v.facts) &&
		Object.values(v.facts).every(isFactDef) &&
		Array.isArray(v.rules) &&
		v.rules.every(isRule) &&
		isRecord(v.clauses) &&
		Object.values(v.clauses).every(isClause)
	);
}
