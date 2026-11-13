import { MAX_QUOTE } from "./limits";

export type Severity = "error" | "warning";

export type ErrorCode =
	| "READ_ERROR"
	| "YAML_SYNTAX"
	| "SCHEMA_INVALID"
	| "PARSE_ERROR"
	| "DUPLICATE_FACT"
	| "DUPLICATE_RULE"
	| "DUPLICATE_CLAUSE"
	| "UNKNOWN_FACT"
	| "UNKNOWN_GOAL"
	| "UNKNOWN_SET_FACT"
	| "UNKNOWN_CLAUSE"
	| "UNKNOWN_PLACEHOLDER"
	| "CYCLE"
	| "GOAL_UNSET"
	| "MISSING_ASK"
	| "ENUM_VALUE_NOT_IN_OPTIONS"
	| "SET_NON_DERIVED"
	| "TYPE_MISMATCH"
	| "NOT_BOOLEAN"
	| "MONEY_NOT_ROUNDED";

export type WarningCode = "NO_FALLBACK_RULE" | "DEAD_GUARD";

export type DiagnosticCode = ErrorCode | WarningCode;

export interface Diagnostic {
	readonly severity: Severity;
	readonly code: DiagnosticCode;
	readonly file: string;
	readonly message: string;
	/** Rule id, fact name or clause id, where one applies. */
	readonly id?: string;
	/** "to" or "when" for expression diagnostics; the offending key for schema ones. */
	readonly field?: string;
}

/** Warning codes; every other code is an error. */
const WARNING_CODES: ReadonlySet<DiagnosticCode> = new Set<DiagnosticCode>([
	"NO_FALLBACK_RULE",
	"DEAD_GUARD",
]);

/** Severity of a code (Requirements 13.4, 14.5, 18.1). */
export function severityOf(code: DiagnosticCode): Severity {
	return WARNING_CODES.has(code) ? "warning" : "error";
}

/** Part of the file a diagnostic belongs to, in file order. */
export const SECTION = {
	top: 0,
	goals: 1,
	facts: 2,
	rules: 3,
	clauses: 4,
} as const;

export type Section = (typeof SECTION)[keyof typeof SECTION];

/** Internal position used only for ordering. Dropped before a result is returned. */
export interface DiagnosticAt {
	readonly section: Section;
	readonly index: number;
}

/** A Diagnostic still carrying its internal position. */
export interface LocatedDiagnostic extends Diagnostic {
	readonly at: DiagnosticAt;
}

export interface DiagnosticParts {
	readonly id?: string;
	readonly field?: string;
	readonly at?: DiagnosticAt;
}

const TOP: DiagnosticAt = { section: SECTION.top, index: 0 };

/** Build a diagnostic; `severity` always comes from the code. */
export function makeDiagnostic(
	code: DiagnosticCode,
	file: string,
	message: string,
	parts: DiagnosticParts = {},
): LocatedDiagnostic {
	return {
		severity: severityOf(code),
		code,
		file,
		message,
		...(parts.id === undefined ? {} : { id: parts.id }),
		...(parts.field === undefined ? {} : { field: parts.field }),
		at: parts.at ?? TOP,
	};
}

/** Build an error diagnostic. The code must be an ErrorCode. */
export function makeError(
	code: ErrorCode,
	file: string,
	message: string,
	parts: DiagnosticParts = {},
): LocatedDiagnostic {
	return makeDiagnostic(code, file, message, parts);
}

/** Build a warning diagnostic. The code must be a WarningCode. */
export function makeWarning(
	code: WarningCode,
	file: string,
	message: string,
	parts: DiagnosticParts = {},
): LocatedDiagnostic {
	return makeDiagnostic(code, file, message, parts);
}

/** Clip quoted source text to `max` characters, appending `…` when it clips. */
export function clip(text: string, max: number = MAX_QUOTE): string {
	return text.length <= max ? text : `${text.slice(0, max)}…`;
}

/** Compare two strings by UTF-16 code unit, independent of locale. */
function compareUnits(a: string, b: string): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

/** Order by (section, index, code, field, message), strings by code unit. */
export function compareDiagnostics(
	a: LocatedDiagnostic,
	b: LocatedDiagnostic,
): number {
	return (
		a.at.section - b.at.section ||
		a.at.index - b.at.index ||
		compareUnits(a.code, b.code) ||
		compareUnits(a.field ?? "", b.field ?? "") ||
		compareUnits(a.message, b.message)
	);
}

/** Sort located diagnostics and drop the internal position. */
export function finalizeDiagnostics(
	list: readonly LocatedDiagnostic[],
): Diagnostic[] {
	return [...list].sort(compareDiagnostics).map(stripAt);
}

function stripAt(d: LocatedDiagnostic): Diagnostic {
	const { at: _at, ...rest } = d;
	return rest;
}
