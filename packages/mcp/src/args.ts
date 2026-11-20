import type { FactValue } from "@dead-certain/engine";
import {
	MAX_ANSWER_KEYS,
	MAX_FACT_NAME,
	MAX_STRING_VALUE,
	MAX_TOKEN,
} from "./limits";
import { fail, type ToolResult } from "./payload";

export type Parsed<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: ToolResult };

export interface SessionArgs {
	readonly kb: string;
	readonly answers: Readonly<Record<string, FactValue>>;
	readonly token: string | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bad<T>(error: ToolResult): Parsed<T> {
	return { ok: false, error };
}

/** `kb` alone: a string, or an error. */
export function parseKb(args: unknown): Parsed<string> {
	if (!isRecord(args) || typeof args.kb !== "string") {
		return bad(
			fail(
				"UNKNOWN_KB",
				"Argument kb must be a string. Call list_kbs for the valid values.",
			),
		);
	}
	return { ok: true, value: args.kb };
}

/** `fact`: a string within the name limit. */
export function parseFact(args: unknown): Parsed<string> {
	const fact = isRecord(args) ? args.fact : undefined;
	if (typeof fact !== "string") {
		return bad(fail("UNKNOWN_FACT", "Argument fact must be a string."));
	}
	if (fact.length > MAX_FACT_NAME) {
		return bad(
			fail(
				"LIMIT_EXCEEDED",
				`A fact name is limited to ${MAX_FACT_NAME} characters.`,
			),
		);
	}
	return { ok: true, value: fact };
}

/** `kb`, `answers` and `token`, checked against the limits of requirement 6.3. */
export function parseSessionArgs(args: unknown): Parsed<SessionArgs> {
	const kb = parseKb(args);
	if (!kb.ok) return kb;
	const raw = args as Record<string, unknown>;

	const answers: Record<string, FactValue> = {};
	if (raw.answers !== undefined) {
		if (!isRecord(raw.answers)) {
			return bad(
				fail(
					"INVALID_ANSWER",
					"Argument answers must be an object of fact names to values.",
				),
			);
		}
		const entries = Object.entries(raw.answers);
		if (entries.length > MAX_ANSWER_KEYS) {
			return bad(
				fail(
					"LIMIT_EXCEEDED",
					`answers is limited to ${MAX_ANSWER_KEYS} keys.`,
				),
			);
		}
		for (const [name, value] of entries) {
			if (name.length > MAX_FACT_NAME) {
				return bad(
					fail(
						"LIMIT_EXCEEDED",
						`A fact name is limited to ${MAX_FACT_NAME} characters.`,
					),
				);
			}
			if (
				typeof value !== "boolean" &&
				typeof value !== "number" &&
				typeof value !== "string"
			) {
				return bad(
					fail(
						"INVALID_ANSWER",
						"Each answer must be a boolean, a number or a string.",
					),
				);
			}
			if (typeof value === "string" && value.length > MAX_STRING_VALUE) {
				return bad(
					fail(
						"LIMIT_EXCEEDED",
						`A string answer is limited to ${MAX_STRING_VALUE} characters.`,
					),
				);
			}
			// defineProperty, so a key named __proto__ stays an own property.
			Object.defineProperty(answers, name, {
				value,
				enumerable: true,
				writable: true,
				configurable: true,
			});
		}
	}

	let token: string | undefined;
	if (raw.token !== undefined) {
		if (typeof raw.token !== "string") {
			return bad(fail("MALFORMED_TOKEN", "Argument token must be a string."));
		}
		if (raw.token.length > MAX_TOKEN) {
			return bad(
				fail("LIMIT_EXCEEDED", `token is limited to ${MAX_TOKEN} characters.`),
			);
		}
		token = raw.token;
	}
	return { ok: true, value: { kb: kb.value, answers, token } };
}
