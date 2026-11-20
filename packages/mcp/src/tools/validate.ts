import { type Diagnostic, validateText } from "@dead-certain/kb-tools";
import { guard } from "../guard";
import { diagnosticJson, readText, resolve } from "../kbs";
import { fail, type JsonObject, ok, type ToolResult } from "../payload";
import type { KbFile, Workspace } from "../workspace";

function resultFor(ws: Workspace, file: KbFile): JsonObject {
	const { read } = readText(ws, file);
	const diagnostics: readonly Diagnostic[] =
		"text" in read
			? validateText(read.text, file.path).diagnostics
			: read.diagnostics;
	const errors = diagnostics.filter((d) => d.severity === "error").length;
	return {
		ref: file.ref,
		path: file.path,
		ok: errors === 0,
		errors,
		warnings: diagnostics.length - errors,
		diagnostics: diagnostics.map(diagnosticJson),
	};
}

/** `validate`: the validator's findings for one knowledge base, or for all of them. */
export function validateKbs(ws: Workspace, args: unknown): ToolResult {
	return guard(() => {
		if (ws.root() === undefined) {
			return fail(
				"NO_WORKSPACE",
				"No pnpm-workspace.yaml above the working directory.",
			);
		}
		const raw =
			typeof args === "object" && args !== null && !Array.isArray(args)
				? (args as Record<string, unknown>).kb
				: undefined;
		if (raw === undefined) {
			return ok({
				results: ws.listKbFiles().map((file) => resultFor(ws, file)),
			});
		}
		if (typeof raw !== "string") {
			return fail(
				"UNKNOWN_KB",
				"Argument kb must be a string. Call list_kbs for the valid values.",
			);
		}
		const found = resolve(ws, raw);
		if (!found.ok) return found.error;
		return ok({ results: [resultFor(ws, found.file)] });
	});
}
