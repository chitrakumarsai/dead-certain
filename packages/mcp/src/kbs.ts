import type { KnowledgeBase } from "@dead-certain/engine";
import {
	compileText,
	type Diagnostic,
	type Host as KbHost,
	readKbFile,
} from "@dead-certain/kb-tools";
import { MAX_ERROR_DIAGNOSTICS, MAX_KB_BYTES } from "./limits";
import { fail, type JsonObject, type ToolResult } from "./payload";
import type { KbFile, Workspace } from "./workspace";

export type Resolved =
	| { readonly ok: true; readonly file: KbFile }
	| { readonly ok: false; readonly error: ToolResult };

export type Compiled =
	| { readonly ok: true; readonly kb: KnowledgeBase; readonly file: KbFile }
	| { readonly ok: false; readonly error: ToolResult };

/** A diagnostic as JSON, keys in the library's order. */
export function diagnosticJson(d: Diagnostic): JsonObject {
	return {
		severity: d.severity,
		code: d.code,
		file: d.file,
		message: d.message,
		...(d.id === undefined ? {} : { id: d.id }),
		...(d.field === undefined ? {} : { field: d.field }),
	};
}

/**
 * Look a KB_Ref up in the discovered list. The argument is compared, never
 * turned into a path, so nothing outside the list can be read.
 */
export function resolve(ws: Workspace, ref: string): Resolved {
	if (ws.root() === undefined) {
		return {
			ok: false,
			error: fail(
				"NO_WORKSPACE",
				"No pnpm-workspace.yaml above the working directory.",
			),
		};
	}
	const files = ws.listKbFiles();
	const file = files.find((f) => f.ref === ref);
	if (file === undefined) {
		const valid = files.map((f) => f.ref).join(", ");
		return {
			ok: false,
			error: fail(
				"UNKNOWN_KB",
				`Unknown knowledge base. Valid values for kb: ${valid === "" ? "(none found)" : valid}.`,
			),
		};
	}
	return { ok: true, file };
}

export type ReadResult =
	| { text: string }
	| { diagnostics: readonly Diagnostic[] };

/**
 * The text of a file, or the diagnostics kb-tools gives for it (read failure,
 * more than 1 MiB, bad UTF-8). Also reports how many bytes the file held.
 */
export function readText(
	ws: Workspace,
	file: KbFile,
): { read: ReadResult; size: number } {
	let size = 0;
	// readKbFile uses only readFile; the other Host members are never called.
	const host = {
		readFile(path: string): Uint8Array {
			const bytes = ws.read(path);
			size = bytes.byteLength;
			return bytes;
		},
	} as unknown as KbHost;
	const read = readKbFile(file.path, file.path, host);
	return { read, size };
}

function tooBig(ref: string): ToolResult {
	return fail("LIMIT_EXCEEDED", `${ref} is larger than the 1 MiB limit.`);
}

function invalid(ref: string, diagnostics: readonly Diagnostic[]): ToolResult {
	const errors = diagnostics.filter((d) => d.severity === "error");
	return fail("KB_INVALID", `${ref} has ${errors.length} errors`, {
		diagnostics: errors.slice(0, MAX_ERROR_DIAGNOSTICS).map(diagnosticJson),
	});
}

/** What compiling one discovered file gave, without building an error result. */
export type Outcome =
	| { readonly kind: "ok"; readonly kb: KnowledgeBase }
	| { readonly kind: "invalid"; readonly diagnostics: readonly Diagnostic[] }
	| { readonly kind: "too-big" };

/** Read and compile one discovered file from YAML. Nothing is cached. */
export function compileFile(ws: Workspace, file: KbFile): Outcome {
	const { read, size } = readText(ws, file);
	if (size > MAX_KB_BYTES) return { kind: "too-big" };
	if ("diagnostics" in read) {
		return { kind: "invalid", diagnostics: read.diagnostics };
	}
	const compiled = compileText(read.text, file.path);
	if (!compiled.ok)
		return { kind: "invalid", diagnostics: compiled.diagnostics };
	return { kind: "ok", kb: compiled.kb };
}

/** Resolve a KB_Ref, then read and compile it. */
export function compile(ws: Workspace, ref: string): Compiled {
	const found = resolve(ws, ref);
	if (!found.ok) return found;
	const outcome = compileFile(ws, found.file);
	if (outcome.kind === "too-big") return { ok: false, error: tooBig(ref) };
	if (outcome.kind === "invalid") {
		return { ok: false, error: invalid(ref, outcome.diagnostics) };
	}
	return { ok: true, kb: outcome.kb, file: found.file };
}
