// What pnpm new-app prints (requirements 1.4, 1.6). Plain text, sentence case. Pure.
import type { Plan } from "./plan.ts";

/** The steps after a scaffold: install, run, test, and where the app serves (1.6). */
export function nextSteps(plan: Plan): string {
	return [
		`Created ${plan.title} in apps/${plan.name}.`,
		"",
		"Next:",
		"  pnpm install",
		`  pnpm --filter @dead-certain/${plan.name} dev`,
		`  pnpm exec playwright test e2e/${plan.name}-smoke.spec.ts`,
		"",
		`It serves at ${plan.url} when built and previewed.`,
		"Commit pnpm-lock.yaml with the new app.",
		"",
	].join("\n");
}

/** The whole plan, for --dry-run: files, inserted lines and the port (1.4). Nothing is written. */
export function formatPlan(plan: Plan): string {
	return [
		`Dry run: nothing was written. ${plan.title} would serve on port ${plan.port}.`,
		"",
		"Files to create:",
		...plan.create.map((f) => `  ${f.path}`),
		"",
		...plan.edits.flatMap((e) => [
			`Lines to insert in ${e.path}:`,
			...e.inserted.map((l) => `  ${l}`),
			"",
		]),
	].join("\n");
}
