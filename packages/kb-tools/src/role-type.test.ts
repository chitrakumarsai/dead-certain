/**
 * Bug condition exploration for kb-role-type-mismatch.
 *
 * Property 1: a fact whose `role` does not fit its `type` gets exactly one
 * ROLE_TYPE_MISMATCH error. These tests FAIL on unfixed code, which proves the
 * bug. `ROLE_TYPE_MISMATCH` is not yet in the `ErrorCode` union, so the code is
 * compared as a plain string and the file compiles against unfixed code.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.5**
 */
import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./index";
import { runCli, validateText } from "./index";
import { memoryHost } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";
const CODE: string = "ROLE_TYPE_MISMATCH";

type Role = "check" | "deduction";
type FactType = "boolean" | "number" | "money" | "date" | "enum";

const REQUIRED: Record<Role, FactType> = {
	check: "boolean",
	deduction: "money",
};

/** Every (role, type) pair in the bug condition. */
const PAIRS: ReadonlyArray<readonly [Role, FactType]> = [
	["check", "number"],
	["check", "money"],
	["check", "date"],
	["check", "enum"],
	["deduction", "boolean"],
	["deduction", "number"],
	["deduction", "date"],
	["deduction", "enum"],
];

const BASE_FACTS = `  rent:
    type: money
    ask: What is the rent?
  payable:
    type: money
    derived: true
`;

const RULES = `  - id: R-1
    cite: "4.2"
    set: payable
    to: "round(rent)"
    because: Because.
`;

const CLAUSES = `  "4.2":
    title: Room
    text: Room rent.
`;

function roleFact(
	name: string,
	type: FactType,
	role: Role,
	derived: boolean,
): string {
	const lines = [`  ${name}:`, `    type: ${type}`];
	if (type === "enum") lines.push("    options: [gold, silver]");
	lines.push(derived ? "    derived: true" : "    ask: Question?");
	lines.push(`    role: ${role}`);
	return `${lines.join("\n")}\n`;
}

function kb(extraFacts: string): string {
	return [
		"id: demo",
		"goals: [payable]",
		"facts:",
		BASE_FACTS + extraFacts,
		"rules:",
		RULES,
		"clauses:",
		CLAUSES,
	].join("\n");
}

function mismatches(ds: readonly Diagnostic[]): Diagnostic[] {
	return ds.filter((d) => (d.code as string) === CODE);
}

describe("role/type mismatch (bug condition exploration)", () => {
	it.each(PAIRS)(
		"role %s with type %s gives one ROLE_TYPE_MISMATCH",
		(role, type) => {
			const name = "line_item";
			const result = validateText(kb(roleFact(name, type, role, true)), FILE);
			const found = mismatches(result.diagnostics);
			expect(found).toHaveLength(1);
			const d = found[0] as Diagnostic;
			expect(d.severity).toBe("error");
			expect(d.id).toBe(name);
			expect(d.field).toBe("type");
			expect(d.file).toBe(FILE);
			for (const part of [name, role, type, REQUIRED[role]]) {
				expect(d.message).toContain(part);
			}
		},
	);

	it("a non-derived number check fact gets SCHEMA_INVALID and ROLE_TYPE_MISMATCH, mismatch first", () => {
		const name = "loose";
		const result = validateText(
			kb(roleFact(name, "number", "check", false)),
			FILE,
		);
		const forFact = result.diagnostics.filter((d) => d.id === name);
		const codes = forFact.map((d) => d.code as string);
		expect(codes.filter((c) => c === CODE)).toHaveLength(1);
		expect(codes.filter((c) => c === "SCHEMA_INVALID")).toHaveLength(1);
		expect(codes.indexOf(CODE)).toBeLessThan(codes.indexOf("SCHEMA_INVALID"));
	});

	it("dc build on a mismatched knowledge base exits non-zero and writes nothing", () => {
		const host = memoryHost({
			root: "/repo",
			files: {
				"pnpm-workspace.yaml": "packages:\n  - apps/*\n",
				[FILE]: kb(roleFact("line_item", "number", "check", true)),
			},
			dirs: [],
		});
		const r = runCli(["build"], host);
		expect(r.exitCode).not.toBe(0);
		expect(r.stdout + r.stderr).toContain(CODE);
		expect(host.writes).toEqual([]);
	});
});
