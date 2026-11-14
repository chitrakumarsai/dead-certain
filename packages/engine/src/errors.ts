import { clip } from "./util";

/** The ten stable error codes an Engine function can throw. */
export type ErrorCode =
	| "INVALID_KB"
	| "CYCLE"
	| "UNKNOWN_FACT"
	| "NOT_ANSWERABLE"
	| "INVALID_ANSWER"
	| "EVALUATION_ERROR"
	| "NON_INTEGER_MONEY"
	| "MALFORMED_TOKEN"
	| "UNSUPPORTED_VERSION"
	| "KB_MISMATCH";

/** Longest message an EngineError keeps. */
const MAX_MESSAGE_LENGTH = 500;

/** The one error type the engine throws for invalid input. */
export class EngineError extends Error {
	readonly code: ErrorCode;

	constructor(code: ErrorCode, message: string) {
		super(clip(message, MAX_MESSAGE_LENGTH));
		this.name = "EngineError";
		this.code = code;
	}

	/** `message` is not enumerable on an Error, so restore it for JSON. */
	toJSON(): { name: "EngineError"; code: ErrorCode; message: string } {
		return { name: "EngineError", code: this.code, message: this.message };
	}
}
