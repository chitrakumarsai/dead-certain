import type { ErrorCode } from "@dead-certain/engine";
import { MAX_MESSAGE, MAX_PAYLOAD } from "./limits";

export type Json =
	| null
	| boolean
	| number
	| string
	| Json[]
	| { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

/** Every code a Tool_Error may carry (requirement 6.5). */
export type ToolErrorCode =
	| ErrorCode
	| "NO_WORKSPACE"
	| "UNKNOWN_KB"
	| "KB_INVALID"
	| "LIMIT_EXCEEDED"
	| "INTERNAL";

/** What a tool returns: one text block, the same document as structuredContent. */
export interface ToolResult {
	[key: string]: unknown;
	content: { type: "text"; text: string }[];
	structuredContent: JsonObject;
	isError?: boolean;
}

/** Cut a string to `max` characters, ending in an ellipsis when it was cut. */
export function clip(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function wrap(payload: JsonObject, isError: boolean): ToolResult {
	const result: ToolResult = {
		content: [{ type: "text", text: JSON.stringify(payload) }],
		structuredContent: payload,
	};
	if (isError) result.isError = true;
	return result;
}

/** A Tool_Error. The message is clipped to 500 characters. */
export function fail(
	code: ToolErrorCode,
	message: string,
	extra: JsonObject = {},
): ToolResult {
	return wrap(
		{ error: { code, message: clip(message, MAX_MESSAGE), ...extra } },
		true,
	);
}

/** A successful Tool_Result, or LIMIT_EXCEEDED if the text would pass the cap. */
export function ok(payload: JsonObject): ToolResult {
	const result = wrap(payload, false);
	const text = result.content[0]?.text ?? "";
	if (text.length > MAX_PAYLOAD) {
		return fail(
			"LIMIT_EXCEEDED",
			`The result is longer than ${MAX_PAYLOAD} characters.`,
		);
	}
	return result;
}
