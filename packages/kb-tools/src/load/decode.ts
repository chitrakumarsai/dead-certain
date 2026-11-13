import { type LocatedDiagnostic, makeError } from "../diagnostics";

export type DecodeResult =
	| { readonly ok: true; readonly text: string }
	| { readonly ok: false; readonly diagnostic: LocatedDiagnostic };

/**
 * Decode bytes as UTF-8. A leading byte-order mark is dropped. Invalid bytes
 * give a READ_ERROR with no operating-system reason (Requirement 2.8).
 */
export function decodeUtf8(bytes: Uint8Array, file: string): DecodeResult {
	try {
		const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		return { ok: true, text };
	} catch (error) {
		if (error instanceof TypeError) {
			return {
				ok: false,
				diagnostic: makeError(
					"READ_ERROR",
					file,
					`Cannot read '${file}': the file is not valid UTF-8.`,
				),
			};
		}
		throw error;
	}
}
