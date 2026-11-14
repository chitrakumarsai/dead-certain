import { analyse } from "./analyse";
import { type Host, HostError } from "./cli/host";
import { type Diagnostic, finalizeDiagnostics, makeError } from "./diagnostics";
import { MAX_FILE_BYTES } from "./limits";
import { decodeUtf8 } from "./load/decode";

/** Public entry for kb-tools; the library API grows here as it is implemented. */
export const KB_TOOLS = "kb-tools";

export type { Host } from "./cli/host";
export { HostError } from "./cli/host";
export type { CliResult } from "./cli/run";
export { runCli } from "./cli/run";
export type { CompileResult } from "./compile";
export { compileText } from "./compile";
export type {
	Diagnostic,
	DiagnosticCode,
	ErrorCode,
	Severity,
	WarningCode,
} from "./diagnostics";
export * from "./golden";
export type { LoadResult, ParsedRaw } from "./load/yaml-load";
export { loadText } from "./load/yaml-load";

export interface ValidationResult {
	readonly file: string;
	/** Sorted by position in the file, then code, field and message. */
	readonly diagnostics: readonly Diagnostic[];
	/** True when there is no Error_Diagnostic. */
	readonly ok: boolean;
}

function toResult(file: string, diagnostics: readonly Diagnostic[]) {
	return {
		file,
		diagnostics,
		ok: !diagnostics.some((d) => d.severity === "error"),
	} satisfies ValidationResult;
}

/** Full validation of YAML text. Never throws. */
export function validateText(text: string, file: string): ValidationResult {
	return toResult(file, analyse({ text }, file).diagnostics);
}

/** Validate an arbitrary JavaScript value as a Raw_KB. Never throws. */
export function validateRaw(value: unknown, file: string): ValidationResult {
	return toResult(file, analyse({ value }, file).diagnostics);
}

/**
 * Read a file through a Host and decode it as UTF-8. A read, size or decoding
 * failure is a returned Diagnostic, never a throw, and never YAML_SYNTAX.
 */
export function readKbFile(
	path: string,
	file: string,
	host: Host,
): { text: string } | { diagnostics: readonly Diagnostic[] } {
	let bytes: Uint8Array;
	try {
		bytes = host.readFile(path);
	} catch (error) {
		const reason =
			error instanceof HostError
				? error.reason
				: error instanceof Error
					? error.message
					: String(error);
		return {
			diagnostics: finalizeDiagnostics([
				makeError("READ_ERROR", file, `Cannot read '${file}': ${reason}.`),
			]),
		};
	}
	if (bytes.byteLength > MAX_FILE_BYTES) {
		return {
			diagnostics: finalizeDiagnostics([
				makeError(
					"SCHEMA_INVALID",
					file,
					`File '${file}' is larger than the 1 MiB limit (${MAX_FILE_BYTES} bytes).`,
				),
			]),
		};
	}
	const decoded = decodeUtf8(bytes, file);
	if (!decoded.ok) {
		return { diagnostics: finalizeDiagnostics([decoded.diagnostic]) };
	}
	return { text: decoded.text };
}
