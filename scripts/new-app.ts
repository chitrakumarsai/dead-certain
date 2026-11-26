// pnpm new-app <name> [--dry-run]: scaffolds an app from templates/app (.kiro/specs/app-template).
// Runs under Node 22 with --experimental-strip-types. No child process, no network (1.7).
// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:path
import { dirname, join, sep } from "node:path";
import { apply, type Fs } from "./new-app/apply.ts";
import { parseArgs, USAGE } from "./new-app/args.ts";
import { type Inputs, planFor } from "./new-app/plan.ts";
import { formatPlan, nextSteps } from "./new-app/print.ts";

interface Proc {
	argv: string[];
	cwd(): string;
	stdout: { write(s: string): void };
	stderr: { write(s: string): void };
	exit(code: number): never;
}
const proc = (globalThis as unknown as { process: Proc }).process;

/** The nearest folder above `from` holding pnpm-workspace.yaml (1.8). */
function findRoot(from: string): string | null {
	for (let dir = from; ; dir = dirname(dir) as string) {
		if (fs.existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
		if (dirname(dir) === dir) return null;
	}
}

/** Every file under `dir`, as paths relative to it with "/" separators. */
function filesUnder(dir: string): string[] {
	return (fs.readdirSync(dir, { recursive: true }) as string[])
		.filter((p) => fs.statSync(join(dir, p)).isFile())
		.map((p) => p.split(sep).join("/"))
		.sort();
}

const packageName = (dir: string): string | undefined => {
	const file = join(dir, "package.json");
	if (!fs.existsSync(file)) return undefined;
	const name = (
		JSON.parse(fs.readFileSync(file, "utf8") as string) as { name?: unknown }
	).name;
	return typeof name === "string" ? name : undefined;
};

const folders = (dir: string): string[] =>
	fs.existsSync(dir)
		? (fs.readdirSync(dir) as string[]).filter((d) =>
				fs.statSync(join(dir, d)).isDirectory(),
			)
		: [];

function main(): number {
	const args = parseArgs(proc.argv.slice(2));
	if (!args.ok) {
		proc.stderr.write(`${USAGE}\n`);
		return 2;
	}
	const root = findRoot(proc.cwd());
	if (root === null) {
		proc.stderr.write(
			"No pnpm-workspace.yaml found above this folder. Run this inside the repository.\n",
		);
		return 1;
	}
	const template = join(root, "templates", "app");
	if (!fs.existsSync(template)) {
		proc.stderr.write("templates/app is missing.\n");
		return 1;
	}
	const at = (p: string) => join(root, ...p.split("/"));
	const inputs: Inputs = {
		templateFiles: filesUnder(template).map((path) => ({
			path,
			text: fs.readFileSync(join(template, path), "utf8") as string,
		})),
		playwright: fs.readFileSync(at("playwright.config.ts"), "utf8") as string,
		ci: fs.readFileSync(at(".github/workflows/ci.yml"), "utf8") as string,
		site: fs.readFileSync(at("packages/ui/src/site.ts"), "utf8") as string,
		existingApps: folders(at("apps")),
		packageNames: [
			...folders(at("apps")).map((a) => packageName(at(`apps/${a}`))),
			...folders(at("packages")).map((p) => packageName(at(`packages/${p}`))),
		].filter((n): n is string => n !== undefined),
	};
	const plan = planFor(inputs, args.name);
	if (!("create" in plan)) {
		proc.stderr.write(`${plan.message}\n`);
		return 1;
	}
	if (args.dryRun) {
		proc.stdout.write(formatPlan(plan));
		return 0;
	}
	const disk: Fs = {
		exists: (p) => fs.existsSync(at(p)),
		mkdir: (p) => fs.mkdirSync(at(p)),
		// "wx" fails if the file exists, so nothing is overwritten (2.7).
		writeNew: (p, text) => fs.writeFileSync(at(p), text, { flag: "wx" }),
		overwrite: (p, text) => fs.writeFileSync(at(p), text),
		removeFile: (p) => fs.unlinkSync(at(p)),
		removeDir: (p) => fs.rmdirSync(at(p)),
	};
	const result = apply(plan, disk);
	if (!result.ok) {
		proc.stderr.write(`${result.message}\n`);
		return 1;
	}
	proc.stdout.write(nextSteps(plan));
	return 0;
}

proc.exit(main());
