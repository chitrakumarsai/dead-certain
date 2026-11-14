import type { KnowledgeBase } from "@dead-certain/engine";
import { type CompileResult, compileText } from "../compile";
import { checkGolden, duplicateIds } from "../golden/check";
import { coverage } from "../golden/coverage";
import { fromLoader, loadGolden } from "../golden/load";
import {
	type GoldenDiagnostic,
	type GoldenSet,
	makeGolden,
	type Scenario,
	type ScenarioResult,
} from "../golden/model";
import { runGolden } from "../golden/run";
import { readKbFile } from "../index";
import { loadTextLocated } from "../load/yaml-load";
import { USAGE } from "./args";
import { discoverGolden, kbFilesOfApp } from "./discover";
import { formatDiagnostic, formatGoldenSummary } from "./format";
import { type Host, HostError } from "./host";

interface CliResult {
	readonly exitCode: 0 | 1 | 2;
	readonly stdout: string;
	readonly stderr: string;
}

/** A diagnostic with the position it sorts by: app, phase, file, position, code. */
interface Tagged {
	readonly d: GoldenDiagnostic;
	readonly app: string;
	/** 0 golden-file diagnostics, 1 uncovered rules, 2 too few scenarios. */
	readonly phase: 0 | 1 | 2;
	readonly pos: number;
	readonly seq: number;
}

interface KbEntry {
	readonly file: string;
	readonly id: string | undefined;
	readonly compiled: CompileResult | undefined;
}

interface Loaded {
	readonly app: string;
	readonly file: string;
	readonly set: GoldenSet;
	readonly kb:
		| { readonly file: string; readonly kb: KnowledgeBase }
		| undefined;
	readonly runnable: readonly Scenario[];
}

function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function reasonOf(error: unknown): string {
	return error instanceof HostError
		? error.reason
		: error instanceof Error
			? error.message
			: String(error);
}

function appOf(file: string): string {
	return file.split("/")[1] ?? "";
}

/** Read and compile each knowledge-base file of one app, with the `id` its YAML declares. */
function knowledgeBases(root: string, app: string, host: Host): KbEntry[] {
	return kbFilesOfApp(root, app, host)
		.sort(compare)
		.map((file) => {
			const read = readKbFile(`${root}/${file}`, file, host);
			if ("diagnostics" in read) {
				return { file, id: undefined, compiled: undefined };
			}
			const raw = loadTextLocated(read.text, file).raw;
			return {
				file,
				id: typeof raw?.id === "string" ? raw.id : undefined,
				compiled: compileText(read.text, file),
			};
		});
}

/** `dc golden [path...]`: run every golden scenario against its compiled knowledge base. */
export function runGoldenCommand(
	paths: readonly string[],
	host: Host,
): CliResult {
	const found = discoverGolden(paths, host);
	if (!found.ok) {
		return found.kind === "usage"
			? { exitCode: 2, stdout: "", stderr: `${found.message}\n\n${USAGE}` }
			: { exitCode: 1, stdout: "", stderr: `${found.message}\n` };
	}
	const { root, files, wholeApps } = found;

	const tagged: Tagged[] = [];
	let seq = 0;
	const push = (
		diagnostics: readonly GoldenDiagnostic[],
		app: string,
		phase: 0 | 1 | 2,
		posOf: (d: GoldenDiagnostic) => number,
	): void => {
		for (const d of diagnostics) {
			tagged.push({ d, app, phase, pos: posOf(d), seq: seq++ });
		}
	};

	try {
		const apps = [...new Set(files.map(appOf))].sort(compare);
		const kbsByApp = new Map<string, KbEntry[]>();
		for (const app of apps) kbsByApp.set(app, knowledgeBases(root, app, host));

		// Stage 1: read, load, find the knowledge base, check.
		const loaded: Loaded[] = [];
		for (const file of files) {
			const app = appOf(file);
			const read = readKbFile(`${root}/${file}`, file, host);
			if ("diagnostics" in read) {
				push(fromLoader(read.diagnostics), app, 0, () => -1);
				continue;
			}
			const result = loadGolden(read.text, file);
			if (!result.ok) {
				push(result.diagnostics, app, 0, () => -1);
				continue;
			}
			const set = result.set;
			const index = (d: GoldenDiagnostic): number =>
				set.scenarios.findIndex((s) => s.id === d.id);
			const entries = kbsByApp.get(app) ?? [];
			const matches = entries.filter((e) => e.id === set.kb);
			const [match] = matches;
			if (match === undefined) {
				push(
					[
						makeGolden(
							"KB_NOT_FOUND",
							file,
							`No knowledge base with id '${set.kb}' in apps/${app}/kb.`,
							{ field: "kb" },
						),
					],
					app,
					0,
					() => -1,
				);
				loaded.push({ app, file, set, kb: undefined, runnable: [] });
				continue;
			}
			if (matches.length > 1) {
				push(
					[
						makeGolden(
							"KB_AMBIGUOUS",
							file,
							`More than one knowledge base in apps/${app}/kb has id '${set.kb}': ${matches.map((m) => m.file.slice(m.file.lastIndexOf("/") + 1)).join(", ")}.`,
							{ field: "kb" },
						),
					],
					app,
					0,
					() => -1,
				);
				loaded.push({ app, file, set, kb: undefined, runnable: [] });
				continue;
			}
			if (match.compiled === undefined || !match.compiled.ok) {
				push(
					[
						makeGolden(
							"KB_INVALID",
							file,
							`The knowledge base '${match.file}' has errors. Run dc validate first.`,
							{ field: "kb" },
						),
					],
					app,
					0,
					() => -1,
				);
				loaded.push({ app, file, set, kb: undefined, runnable: [] });
				continue;
			}
			const checked = checkGolden(set, match.compiled.kb, file);
			push(checked.diagnostics, app, 0, index);
			loaded.push({
				app,
				file,
				set,
				kb: { file: match.file, kb: match.compiled.kb },
				runnable: checked.runnable,
			});
		}

		// Stage 2: scenario ids are unique within an app.
		const dropped = new Set<Scenario>();
		for (const app of apps) {
			const ofApp = loaded.filter((l) => l.app === app);
			const dup = duplicateIds(
				ofApp.map((l) => ({ file: l.file, set: l.set })),
			);
			for (const scenario of dup.drop) dropped.add(scenario);
			push(dup.diagnostics, app, 0, (d) => {
				const file = ofApp.find((l) => l.file === d.file);
				const at = file?.set.scenarios.findIndex(
					(s) => s.id === d.id && dup.drop.has(s),
				);
				return at ?? -1;
			});
		}

		// Stage 3: run, in file order.
		let runCount = 0;
		let passed = 0;
		const resultsByKb = new Map<
			string,
			{
				kb: KnowledgeBase;
				results: ScenarioResult[];
				scenarios: number;
				app: string;
			}
		>();
		for (const l of loaded) {
			if (l.kb === undefined) continue;
			const scenarios = l.runnable.filter((s) => !dropped.has(s));
			const run = runGolden(l.kb.kb, scenarios, l.file);
			runCount += run.results.length;
			passed += run.results.filter((r) => r.status === "passed").length;
			push(run.diagnostics, l.app, 0, (d) =>
				l.set.scenarios.findIndex((s) => s.id === d.id),
			);
			const bucket = resultsByKb.get(l.kb.file) ?? {
				kb: l.kb.kb,
				results: [],
				scenarios: 0,
				app: l.app,
			};
			bucket.results.push(...run.results);
			bucket.scenarios += l.set.scenarios.length;
			resultsByKb.set(l.kb.file, bucket);
		}

		// Stage 4: coverage, only for apps whose every golden file is in this run.
		let covered = 0;
		let rules = 0;
		for (const kbFile of [...resultsByKb.keys()].sort(compare)) {
			const bucket = resultsByKb.get(kbFile);
			if (bucket === undefined || !wholeApps.includes(bucket.app)) continue;
			const cov = coverage(bucket.kb, kbFile, bucket.results, bucket.scenarios);
			covered += cov.covered.length;
			rules += bucket.kb.rules.length;
			const ruleIndex = (d: GoldenDiagnostic): number =>
				bucket.kb.rules.findIndex((r) => r.id === d.id);
			push(
				cov.diagnostics.filter((d) => d.code === "RULE_NOT_COVERED"),
				bucket.app,
				1,
				ruleIndex,
			);
			push(
				cov.diagnostics.filter((d) => d.code === "TOO_FEW_SCENARIOS"),
				bucket.app,
				2,
				() => 0,
			);
		}

		tagged.sort(
			(a, b) =>
				compare(a.app, b.app) ||
				a.phase - b.phase ||
				compare(a.d.file, b.d.file) ||
				a.pos - b.pos ||
				compare(a.d.code, b.d.code) ||
				a.seq - b.seq,
		);
		const errors = tagged.filter((t) => t.d.severity === "error").length;
		const warnings = tagged.length - errors;
		const lines = tagged.map((t) => formatDiagnostic(t.d));
		lines.push(
			formatGoldenSummary({
				files: files.length,
				run: runCount,
				passed,
				covered,
				rules,
				errors,
				warnings,
			}),
		);
		return {
			exitCode: errors === 0 ? 0 : 1,
			stdout: `${lines.join("\n")}\n`,
			stderr: "",
		};
	} catch (error) {
		if (error instanceof HostError) {
			return {
				exitCode: 1,
				stdout: "",
				stderr: `${root}: error ${reasonOf(error)}\n`,
			};
		}
		throw error;
	}
}
