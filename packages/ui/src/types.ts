import type { FactValue } from "@dead-certain/engine/types";

/** What the kit needs to print values. The app takes it from `kb.currency`. */
export interface FormatContext {
	/** ISO 4217 code, for money. */
	readonly currency?: string;
	/** Defaults to "en-IN" for INR and "en" otherwise. */
	readonly locale?: string;
}

/** What a verdict headline can say. */
export type VerdictState =
	| "paid"
	| "reduced"
	| "denied" // Claim Check
	| "ready"
	| "not_ready" // Pre-Flight
	| "undecided"; // goals unknown, questions still needed

/** The three replay failures a verdict link can hit. A subset of the engine's ErrorCode. */
export type ReplayFailure =
	| "KB_MISMATCH"
	| "MALFORMED_TOKEN"
	| "UNSUPPORTED_VERSION";

/** The two materials. Paper asks and answers; film shows proof. */
export type Surface = "paper" | "film";

/** One answer in the rail: its label, the value as printed, and the raw value. */
export interface AnswerEntry {
	readonly fact: string;
	/** `FactDef.label ?? humanize(fact)`. */
	readonly label: string;
	/** The value as printed, such as "₹6,000". */
	readonly display: string;
	readonly value: FactValue;
}

/** A question that no longer matters, with the app's one-line reason. */
export interface SkippedNote {
	readonly fact: string;
	readonly label: string;
	readonly reason: string;
}
