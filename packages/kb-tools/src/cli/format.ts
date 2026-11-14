import type { Diagnostic } from "../diagnostics";

/** `<file>: <severity> <code> [<id>] <message>`, with `[<id>]` only when `id` is set. */
export function formatDiagnostic(d: Diagnostic): string {
	const id = d.id === undefined ? "" : ` [${d.id}]`;
	return `${d.file}: ${d.severity} ${d.code}${id} ${d.message}`;
}

/** `<N> files checked, <E> errors, <W> warnings` */
export function formatSummary(
	files: number,
	errors: number,
	warnings: number,
): string {
	return `${files} files checked, ${errors} errors, ${warnings} warnings`;
}
