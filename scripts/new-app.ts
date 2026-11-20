// pnpm new-app <name>: scaffolds a third app from templates/app (.kiro/specs/app-template).
// Task 1 stub: prints the usage and exits 2 until the planner and applier land.
const USAGE = "Usage: pnpm new-app <name> [--dry-run]\n";
const proc = (
	globalThis as {
		process?: { stderr: { write(s: string): void }; exit(code: number): never };
	}
).process;
proc?.stderr.write(USAGE);
proc?.exit(2);
