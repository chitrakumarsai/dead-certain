/** What a printed diagnostic needs; both `Diagnostic` and `GoldenDiagnostic` have it. */
export interface Printable {
	readonly severity: string;
	readonly code: string;
	readonly file: string;
	readonly message: string;
	readonly id?: string;
}

/** `<file>: <severity> <code> [<id>] <message>`, with `[<id>]` only when `id` is set. */
export function formatDiagnostic(d: Printable): string {
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

/** `<F> files, <S> scenarios run, <P> passed, <C> of <R> rules covered, <E> errors, <W> warnings` */
export function formatGoldenSummary(counts: {
	readonly files: number;
	readonly run: number;
	readonly passed: number;
	readonly covered: number;
	readonly rules: number;
	readonly errors: number;
	readonly warnings: number;
}): string {
	return `${counts.files} files, ${counts.run} scenarios run, ${counts.passed} passed, ${counts.covered} of ${counts.rules} rules covered, ${counts.errors} errors, ${counts.warnings} warnings`;
}
