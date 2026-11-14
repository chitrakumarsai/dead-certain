import { compileText } from "../compile";
import type { Diagnostic } from "../diagnostics";
import { readKbFile, validateText } from "../index";
import { parseArgs, USAGE } from "./args";
import { discover } from "./discover";
import { formatDiagnostic, formatSummary } from "./format";
import { type Host, HostError } from "./host";

export interface CliResult {
	readonly exitCode: 0 | 1 | 2;
	readonly stdout: string;
	readonly stderr: string;
}

function reasonOf(error: unknown): string {
	return error instanceof HostError
		? error.reason
		: error instanceof Error
			? error.message
			: String(error);
}

function usageError(message: string): CliResult {
	return { exitCode: 2, stdout: "", stderr: `${message}\n\n${USAGE}` };
}

/**
 * Run `dc` over `argv` (the arguments after the program name). Pure apart from the Host;
 * reads no environment variable and writes only below `apps/<app>/kb/dist/`.
 */
export function runCli(argv: readonly string[], host: Host): CliResult {
	const args = parseArgs(argv);
	if (args.kind === "help") {
		return { exitCode: 0, stdout: USAGE, stderr: "" };
	}
	if (args.kind === "usage") return usageError(args.message);

	const found = discover(args.paths, host);
	if (!found.ok) {
		return found.kind === "usage"
			? usageError(found.message)
			: { exitCode: 1, stdout: "", stderr: `${found.message}\n` };
	}

	const { root, files } = found;
	const diagnostics: Diagnostic[] = [];
	const outputs: { file: string; json: string }[] = [];
	for (const file of files) {
		const read = readKbFile(`${root}/${file}`, file, host);
		if ("diagnostics" in read) {
			diagnostics.push(...read.diagnostics);
		} else if (args.command === "validate") {
			diagnostics.push(...validateText(read.text, file).diagnostics);
		} else {
			const result = compileText(read.text, file);
			diagnostics.push(...result.diagnostics);
			if (result.ok) outputs.push({ file, json: result.json });
		}
	}

	const errors = diagnostics.filter((d) => d.severity === "error").length;
	const warnings = diagnostics.length - errors;
	const lines = diagnostics.map(formatDiagnostic);
	lines.push(formatSummary(files.length, errors, warnings));

	let exitCode: 0 | 1 = errors === 0 ? 0 : 1;
	const failures: string[] = [];
	if (args.command === "build" && errors === 0) {
		const made = new Set<string>();
		for (const { file, json } of outputs) {
			const slash = file.indexOf("/kb/");
			const distRel = `${file.slice(0, slash)}/kb/dist`;
			const stem = file.slice(slash + 4, file.length - ".yaml".length);
			const target = `${distRel}/${stem}.json`;
			try {
				if (!made.has(distRel)) {
					host.makeDir(`${root}/${distRel}`);
					made.add(distRel);
				}
				host.writeFile(`${root}/${target}`, json);
			} catch (error) {
				failures.push(`${target}: error ${reasonOf(error)}`);
			}
		}
		if (failures.length > 0) exitCode = 1;
	}

	return {
		exitCode,
		stdout: `${lines.join("\n")}\n`,
		stderr: failures.length === 0 ? "" : `${failures.join("\n")}\n`,
	};
}
