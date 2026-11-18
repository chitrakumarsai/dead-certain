import type { FactValue } from "@dead-certain/engine";

/** Errors a golden file or a scenario run can report. */
export const GOLDEN_ERROR_CODES = [
	"READ_ERROR",
	"YAML_SYNTAX",
	"SCHEMA_INVALID",
	"UNKNOWN_FACT",
	"KB_NOT_FOUND",
	"KB_AMBIGUOUS",
	"KB_INVALID",
	"DUPLICATE_SCENARIO",
	"NOT_ASKABLE",
	"BAD_VALUE",
	"UNKNOWN_RULE",
	"SCENARIO_FAILED",
	"ENGINE_ERROR",
	"RULE_NOT_COVERED",
] as const;

/** The only warning: a knowledge base with too few scenarios. */
export const GOLDEN_WARNING_CODES = ["TOO_FEW_SCENARIOS"] as const;

export type GoldenCode =
	| (typeof GOLDEN_ERROR_CODES)[number]
	| (typeof GOLDEN_WARNING_CODES)[number];

/** The number of scenarios the build plan asks for per knowledge base. */
export const MINIMUM_SCENARIOS = 12;

export function goldenSeverity(code: GoldenCode): "error" | "warning" {
	return (GOLDEN_WARNING_CODES as readonly string[]).includes(code)
		? "warning"
		: "error";
}

export interface GoldenDiagnostic {
	readonly severity: "error" | "warning";
	readonly code: GoldenCode;
	readonly file: string;
	readonly message: string;
	/** Scenario id, or rule id for RULE_NOT_COVERED. */
	readonly id?: string;
	readonly field?: string;
}

export interface GoldenParts {
	readonly id?: string;
	readonly field?: string;
}

/** Build a diagnostic; `severity` always comes from the code. */
export function makeGolden(
	code: GoldenCode,
	file: string,
	message: string,
	parts: GoldenParts = {},
): GoldenDiagnostic {
	return {
		severity: goldenSeverity(code),
		code,
		file,
		message,
		...(parts.id === undefined ? {} : { id: parts.id }),
		...(parts.field === undefined ? {} : { field: parts.field }),
	};
}

/** Null means unknown (YAML `null`). */
export type GoldenValue = FactValue | null;

export type Expectation =
	| { readonly ask: string }
	| {
			readonly goals: Readonly<Record<string, GoldenValue>>;
			readonly lineItems?: Readonly<Record<string, GoldenValue>>;
			readonly needed?: readonly string[];
			readonly fires?: readonly string[];
	  };

export interface Scenario {
	readonly id: string;
	readonly title: string;
	readonly mode: "consult" | "audit";
	/**
	 * Order is the order of answers in a consult run. The loader lets `null`
	 * through so that `checkGolden` can report it (BAD_VALUE); a scenario that
	 * passed the check holds none.
	 */
	readonly facts: Readonly<Record<string, GoldenValue>>;
	readonly expect: Expectation;
}

export interface GoldenSet {
	readonly kb: string;
	readonly scenarios: readonly Scenario[];
}

export type LoadGoldenResult =
	| {
			readonly ok: true;
			readonly set: GoldenSet;
			readonly diagnostics: readonly GoldenDiagnostic[];
	  }
	| { readonly ok: false; readonly diagnostics: readonly GoldenDiagnostic[] };

export interface Difference {
	/** `outcome`, `ask`, `goals.<name>`, `line_items.<name>`, `needed` or `fires`. */
	readonly field: string;
	readonly expected: string;
	readonly observed: string;
}

export interface ScenarioResult {
	readonly id: string;
	readonly status: "passed" | "failed" | "error";
	/** Rule ids that fired, in the knowledge base's rule order. Empty unless the outcome was a verdict. */
	readonly fired: readonly string[];
	readonly differences: readonly Difference[];
	/** Set when status is "error": the engine's code and message. */
	readonly engineError?: { readonly code: string; readonly message: string };
}

export interface GoldenRun {
	readonly results: readonly ScenarioResult[];
	/** SCENARIO_FAILED and ENGINE_ERROR, in scenario order. */
	readonly diagnostics: readonly GoldenDiagnostic[];
}
