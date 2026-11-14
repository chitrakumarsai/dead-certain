import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText } from "./compile";
import type { Diagnostic } from "./diagnostics";
import { readKbFile, runCli, validateText } from "./index";
import { memoryHost, type TreeSpec, treeArb } from "./testkit";

// Feature: kb-tools, Property 21: Exit code, line format and summary agree with the diagnostics

const LINE =
	/^(\S+): (error|warning) ([A-Z][A-Z0-9_]*)(?: \[([^\]]+)\])? (.*)$/s;
const SUMMARY = /^(\d+) files checked, (\d+) errors, (\d+) warnings$/;

/** Diagnostics for each file, computed without going through the command. */
function oracle(tree: TreeSpec, command: "validate" | "build"): Diagnostic[] {
	const host = memoryHost(tree);
	const out: Diagnostic[] = [];
	for (const file of tree.kbFiles) {
		const read = readKbFile(`${tree.root}/${file}`, file, host);
		if ("diagnostics" in read) {
			out.push(...read.diagnostics);
		} else if (command === "validate") {
			out.push(...validateText(read.text, file).diagnostics);
		} else {
			out.push(...compileText(read.text, file).diagnostics);
		}
	}
	return out;
}

function checkRun(tree: TreeSpec, command: "validate" | "build"): void {
	const diagnostics = oracle(tree, command);
	const errors = diagnostics.filter((d) => d.severity === "error").length;
	const warnings = diagnostics.length - errors;

	const result = runCli([command], memoryHost(tree));

	// Exit code 1 if and only if an Error_Diagnostic exists, else 0.
	expect(result.exitCode).toBe(errors > 0 ? 1 : 0);

	const lines = result.stdout.replace(/\n$/, "").split("\n");
	const summary = lines[lines.length - 1] ?? "";
	const match = SUMMARY.exec(summary);
	expect(match).not.toBeNull();
	expect(Number(match?.[1])).toBe(tree.kbFiles.length);
	expect(Number(match?.[2])).toBe(errors);
	expect(Number(match?.[3])).toBe(warnings);

	// Diagnostic lines: one per diagnostic, in the documented format, `[<id>]` only with an id.
	const printed = lines.slice(0, -1);
	expect(printed.length).toBe(diagnostics.length);
	diagnostics.forEach((d, i) => {
		const line = printed[i] ?? "";
		const m = LINE.exec(line);
		expect(m).not.toBeNull();
		expect(m?.[1]).toBe(d.file);
		expect(m?.[2]).toBe(d.severity);
		expect(m?.[3]).toBe(d.code);
		if (d.id === undefined) {
			expect(m?.[4]).toBeUndefined();
			expect(line).toBe(`${d.file}: ${d.severity} ${d.code} ${d.message}`);
		} else {
			expect(m?.[4]).toBe(d.id);
			expect(line).toBe(
				`${d.file}: ${d.severity} ${d.code} [${d.id}] ${d.message}`,
			);
		}
	});
}

/** A KB whose only diagnostics are `NO_FALLBACK_RULE` warnings (one per deduction fact). */
function warningOnlyKb(deductions: number): string {
	const lines = [
		"id: demo",
		"goals: [payable]",
		"facts:",
		"  payable:",
		"    type: money",
		"    derived: true",
		"  ok:",
		"    type: boolean",
		"    ask: Is it ok?",
	];
	for (let i = 0; i < deductions; i++) {
		lines.push(
			`  d${i}:`,
			"    type: money",
			"    derived: true",
			"    role: deduction",
		);
	}
	lines.push(
		"rules:",
		"  - id: R-pay",
		'    cite: "4.2"',
		"    set: payable",
		'    to: "1"',
		"    because: Because.",
	);
	for (let i = 0; i < deductions; i++) {
		lines.push(
			`  - id: R-d${i}`,
			'    cite: "4.2"',
			`    set: d${i}`,
			'    to: "1"',
			"    because: Because.",
			'    when: "ok"',
		);
	}
	lines.push("clauses:", '  "4.2":', "    title: Room", "    text: Room rent.");
	return lines.join("\n");
}

const warningTreeArb: fc.Arbitrary<TreeSpec> = fc
	.uniqueArray(fc.constantFrom("claim-check", "pre-flight", "demo"), {
		minLength: 1,
	})
	.chain((apps) =>
		fc
			.tuple(...apps.map(() => fc.integer({ min: 0, max: 3 })))
			.map((counts) => {
				const files: Record<string, string> = {
					"pnpm-workspace.yaml": "packages:\n  - apps/*\n",
				};
				apps.forEach((app, i) => {
					files[`apps/${app}/kb/policy.yaml`] = warningOnlyKb(counts[i] ?? 0);
				});
				return {
					root: "/repo",
					files,
					dirs: [],
					kbFiles: Object.keys(files)
						.filter((p) => p.startsWith("apps/"))
						.sort(),
				} satisfies TreeSpec;
			}),
	);

describe("Property 21: exit code, line format and summary", () => {
	it("agree with the diagnostics for validate and build", () => {
		/**
		 * **Validates: Requirements 16.5, 16.6, 16.8, 16.10**
		 */
		fc.assert(
			fc.property(
				treeArb,
				fc.constantFrom("validate", "build"),
				(tree, cmd) => {
					checkRun(tree, cmd);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("a tree whose only diagnostics are warnings exits 0, prints them, and build writes the output", () => {
		/**
		 * **Validates: Requirements 13.4, 14.5, 16.5, 16.6, 16.8, 16.10**
		 */
		fc.assert(
			fc.property(
				warningTreeArb,
				fc.constantFrom("validate", "build"),
				(tree, cmd) => {
					const diagnostics = oracle(tree, cmd);
					expect(diagnostics.every((d) => d.severity === "warning")).toBe(true);
					checkRun(tree, cmd);
					const host = memoryHost(tree);
					const result = runCli([cmd], host);
					expect(result.exitCode).toBe(0);
					expect(host.writes.length).toBe(
						cmd === "build" ? tree.kbFiles.length : 0,
					);
				},
			),
			{ numRuns: 100 },
		);
	});
});
