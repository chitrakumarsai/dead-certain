// readme-block.ts <name>: prints the README's "Add a third app" commands with
// my-app replaced, for the Scaffold_Job to pipe to `sh -e` (requirement 9.2).
// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
import { validateName } from "./new-app/name.ts";

const HEADING = /^#{1,6}\s+Add a third app\s*$/;

/** The lines of the first `sh` block under "Add a third app", or null when the heading or block is missing. */
export function extractBlock(readme: string): string[] | null {
	const lines = readme.split(/\r?\n/);
	const at = lines.findIndex((l) => HEADING.test(l));
	if (at === -1) return null;
	const level = (lines[at] ?? "").indexOf(" ");
	for (let i = at + 1; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const heading = /^(#{1,6})\s/.exec(line);
		if (heading && (heading[1] ?? "").length <= level) return null;
		if (!/^```sh\s*$/.test(line)) continue;
		const end = lines.findIndex((l, j) => j > i && /^```\s*$/.test(l));
		return end === -1 ? null : lines.slice(i + 1, end);
	}
	return null;
}

interface Proc {
	argv: string[];
	stdout: { write(s: string): void };
	stderr: { write(s: string): void };
	exitCode?: number;
}
const proc = (globalThis as unknown as { process: Proc }).process;

function main(): number {
	const [name, ...rest] = proc.argv.slice(2);
	// The name ends up in a shell, so it must pass new-app's own name rules.
	const checked = name === undefined ? null : validateName(name, []);
	if (rest.length > 0 || checked === null || !checked.ok) {
		proc.stderr.write("Usage: readme-block.ts <name>\n");
		return 2;
	}
	const readme = fs.readFileSync(
		new URL("../README.md", import.meta.url),
		"utf8",
	) as string;
	const block = extractBlock(readme);
	if (block === null) {
		proc.stderr.write(
			'README.md has no sh block under the heading "Add a third app".\n',
		);
		return 1;
	}
	proc.stdout.write(
		`${block.map((l) => l.replaceAll("my-app", checked.name)).join("\n")}\n`,
	);
	return 0;
}

if (import.meta.url === new URL(`file://${proc.argv[1]}`).href)
	proc.exitCode = main();
