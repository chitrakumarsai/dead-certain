// Arguments for pnpm new-app (requirements 1.4, 1.5). Pure.

export type Args =
	| { ok: true; name: string; dryRun: boolean }
	| { ok: false; usage: true };

export const USAGE = "Usage: pnpm new-app <name> [--dry-run]";

/** One name and, optionally, --dry-run, in either order. Anything else is a usage error. */
export function parseArgs(argv: readonly string[]): Args {
	const names = argv.filter((a) => !a.startsWith("-"));
	const options = argv.filter((a) => a.startsWith("-"));
	if (
		names.length !== 1 ||
		options.some((o) => o !== "--dry-run") ||
		options.length > 1
	)
		return { ok: false, usage: true };
	return { ok: true, name: names[0] as string, dryRun: options.length === 1 };
}
