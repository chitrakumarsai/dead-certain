/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import type { Diagnostic, DiagnosticCode } from "./index";
import { type Host, HostError, readKbFile, validateText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";

// The project has no Node type definitions, so the source of diagnostics.ts is
// read through Vite's build-time glob, to learn the codes in `DiagnosticCode`.
const sources: Record<string, string> = import.meta.glob("./diagnostics.ts", {
	eager: true,
	query: "?raw",
	import: "default",
});

const FACTS = `  rent:
    type: money
    ask: What is the rent?
  qty:
    type: number
    ask: How many?
  ok:
    type: boolean
    ask: Is it ok?
  tier:
    type: enum
    ask: Which tier?
    options: [gold, silver]
  payable:
    type: money
    derived: true
`;

interface RuleOpts {
	id?: string;
	cite?: string;
	set?: string;
	to?: string;
	when?: string;
	because?: string;
}

function rule(o: RuleOpts = {}): string {
	const when =
		o.when === undefined ? "" : `    when: ${JSON.stringify(o.when)}\n`;
	return [
		`  - id: ${o.id ?? "R-1"}`,
		`    cite: ${o.cite ?? '"4.2"'}`,
		`    set: ${o.set ?? "payable"}`,
		`    to: ${JSON.stringify(o.to ?? "round(rent)")}`,
		`    because: ${o.because ?? "Because."}`,
		when,
	].join("\n");
}

const CLAUSES = `  "4.2":
    title: Room
    text: Room rent.
`;

function kb(
	o: { goals?: string; facts?: string; rules?: string; clauses?: string } = {},
): string {
	return [
		"id: demo",
		`goals: ${o.goals ?? "[payable]"}`,
		"facts:",
		o.facts ?? FACTS,
		"rules:",
		o.rules ?? rule(),
		"clauses:",
		o.clauses ?? CLAUSES,
	].join("\n");
}

const VALID = kb();

function validate(text: string): readonly Diagnostic[] {
	return validateText(text, FILE).diagnostics;
}

function hostReturning(bytes: Uint8Array): Host {
	return {
		readFile: () => bytes,
		readDir: () => [],
		stat: () => "file",
		writeFile: () => {},
		makeDir: () => {},
		cwd: () => "/",
	};
}

function hostFailing(reason: string): Host {
	return {
		...hostReturning(new Uint8Array()),
		readFile: () => {
			throw new HostError(reason);
		},
	};
}

function read(host: Host): readonly Diagnostic[] {
	const result = readKbFile("some/path.yaml", FILE, host);
	return "diagnostics" in result ? result.diagnostics : [];
}

interface Row {
	readonly severity: "error" | "warning";
	/** Diagnostics for an input that must raise the code. */
	readonly fail: () => readonly Diagnostic[];
	/** Diagnostics for an input that must not raise the code. */
	readonly pass: () => readonly Diagnostic[];
	/** The `id` the failing diagnostic must carry; absent means it carries none. */
	readonly id?: string;
}

/** Row for a code raised by validateText, passing on the valid knowledge base. */
function row(
	severity: "error" | "warning",
	failing: string,
	id?: string,
	passing: string = VALID,
): Row {
	return {
		severity,
		fail: () => validate(failing),
		pass: () => validate(passing),
		...(id === undefined ? {} : { id }),
	};
}

const ENUM_FACTS = `${FACTS}  out_e:
    type: enum
    options: [gold, silver]
    derived: true
`;

const DEDUCTION_FACTS = `${FACTS}  ded:
    type: money
    derived: true
    role: deduction
`;

// The Record type makes the compiler reject a code with no row; the runtime
// test below does the same against the source text.
const TABLE: Record<DiagnosticCode, Row> = {
	READ_ERROR: {
		severity: "error",
		fail: () => read(hostFailing("ENOENT (no such file or directory)")),
		pass: () => read(hostReturning(new TextEncoder().encode(VALID))),
	},
	YAML_SYNTAX: row("error", "id: demo\nfacts: [unclosed\n"),
	SCHEMA_INVALID: row(
		"error",
		kb({ rules: rule({ cite: "4.2" }) }),
		"R-1",
		kb({ rules: rule({ cite: '"4.2"' }) }),
	),
	PARSE_ERROR: row("error", kb({ rules: rule({ to: "1 +" }) }), "R-1"),
	DUPLICATE_FACT: row(
		"error",
		kb({ facts: `${FACTS}  rent:\n    type: number\n    ask: Again?\n` }),
		"rent",
	),
	DUPLICATE_RULE: row(
		"error",
		kb({ rules: rule() + rule() }),
		"R-1",
		kb({ rules: rule() + rule({ id: "R-2" }) }),
	),
	DUPLICATE_CLAUSE: row(
		"error",
		kb({ clauses: `${CLAUSES}  "4.2":\n    title: Again\n    text: Again.\n` }),
		"4.2",
	),
	UNKNOWN_FACT: row(
		"error",
		kb({ rules: rule({ to: "round(gold_rent)" }) }),
		"R-1",
	),
	UNKNOWN_GOAL: row("error", kb({ goals: "[payable, ghost]" }), "ghost"),
	UNKNOWN_SET_FACT: row(
		"error",
		kb({ rules: rule() + rule({ id: "R-2", set: "ghost" }) }),
		"R-2",
	),
	UNKNOWN_CLAUSE: row("error", kb({ rules: rule({ cite: '"4.3"' }) }), "R-1"),
	UNKNOWN_PLACEHOLDER: row(
		"error",
		kb({ rules: rule({ because: "Uses {nope}." }) }),
		"R-1",
		kb({ rules: rule({ because: "Uses {rent}." }) }),
	),
	CYCLE: row(
		"error",
		kb({
			facts: `${FACTS}  a:\n    type: number\n    derived: true\n  b:\n    type: number\n    derived: true\n`,
			rules:
				rule() +
				rule({ id: "R-2", set: "a", to: "b" }) +
				rule({ id: "R-3", set: "b", to: "a" }),
		}),
		"a",
	),
	GOAL_UNSET: row(
		"error",
		kb({
			goals: "[payable, extra]",
			facts: `${FACTS}  extra:\n    type: number\n    derived: true\n`,
		}),
		"extra",
	),
	MISSING_ASK: row(
		"error",
		kb({ facts: `${FACTS}  bare:\n    type: number\n` }),
		"bare",
	),
	ENUM_VALUE_NOT_IN_OPTIONS: row(
		"error",
		kb({
			facts: ENUM_FACTS,
			rules: rule() + rule({ id: "R-2", set: "out_e", to: "'platinum'" }),
		}),
		"R-2",
		kb({
			facts: ENUM_FACTS,
			rules: rule() + rule({ id: "R-2", set: "out_e", to: "'gold'" }),
		}),
	),
	SET_NON_DERIVED: row(
		"error",
		kb({ rules: rule() + rule({ id: "R-2", set: "qty", to: "1" }) }),
		"R-2",
	),
	TYPE_MISMATCH: row(
		"error",
		kb({ rules: rule({ when: "qty == tier" }) }),
		"R-1",
		kb({ rules: rule({ when: "qty == 1" }) }),
	),
	NOT_BOOLEAN: row(
		"error",
		kb({ rules: rule({ when: "qty" }) }),
		"R-1",
		kb({ rules: rule({ when: "qty > 1" }) }),
	),
	MONEY_NOT_ROUNDED: row(
		"error",
		kb({ rules: rule({ to: "rent * 0.01" }) }),
		"R-1",
		kb({ rules: rule({ to: "round(rent * 0.01)" }) }),
	),
	ROLE_TYPE_MISMATCH: row(
		"error",
		kb({
			facts: `${FACTS}  rent_check:\n    type: number\n    derived: true\n    role: check\n`,
		}),
		"rent_check",
		kb({
			facts: `${FACTS}  rent_check:\n    type: boolean\n    derived: true\n    role: check\n`,
		}),
	),
	NO_FALLBACK_RULE: row(
		"warning",
		kb({
			facts: DEDUCTION_FACTS,
			rules: rule() + rule({ id: "R-2", set: "ded", to: "1", when: "ok" }),
		}),
		"ded",
		kb({
			facts: DEDUCTION_FACTS,
			rules:
				rule() +
				rule({ id: "R-2", set: "ded", to: "1", when: "ok" }) +
				rule({ id: "R-3", set: "ded", to: "0" }),
		}),
	),
	DEAD_GUARD: row(
		"warning",
		kb({ rules: rule({ when: "ok and not ok" }) }),
		"R-1",
		kb({ rules: rule({ when: "ok and qty > 1" }) }),
	),
};

/** Codes named in the ErrorCode and WarningCode unions of diagnostics.ts. */
function declaredCodes(): string[] {
	const source = sources["./diagnostics.ts"] ?? "";
	const found: string[] = [];
	for (const name of ["ErrorCode", "WarningCode"]) {
		const start = source.indexOf(`export type ${name} =`);
		expect(start).toBeGreaterThanOrEqual(0);
		const end = source.indexOf(";", start);
		for (const m of source.slice(start, end).matchAll(/"([A-Z_]+)"/g)) {
			found.push(m[1] as string);
		}
	}
	return found;
}

describe("diagnostic code table", () => {
	it("has a row for every code in DiagnosticCode, and 23 of them", () => {
		const declared = declaredCodes();
		expect(declared).toHaveLength(23);
		expect(Object.keys(TABLE).sort()).toEqual([...declared].sort());
	});

	it("the valid base knowledge base raises no diagnostic", () => {
		expect(validate(VALID)).toEqual([]);
	});

	for (const [code, entry] of Object.entries(TABLE)) {
		describe(code, () => {
			it("is raised by the failing example", () => {
				const found = entry.fail().filter((d) => d.code === code);
				expect(found.length).toBeGreaterThanOrEqual(1);
				const d = found[0] as Diagnostic;
				expect(d.severity).toBe(entry.severity);
				expect(d.file).toBe(FILE);
				expect(d.message.length).toBeGreaterThan(0);
				expect(d.id).toBe(entry.id);
			});

			it("is not raised by the passing example", () => {
				expect(entry.pass().filter((d) => d.code === code)).toEqual([]);
			});
		});
	}

	describe("READ_ERROR message forms", () => {
		it("gives the operating-system reason for a host failure", () => {
			const [d] = read(hostFailing("ENOENT (no such file or directory)"));
			expect(d?.code).toBe("READ_ERROR");
			expect(d?.message).toBe(
				`Cannot read '${FILE}': ENOENT (no such file or directory).`,
			);
		});

		it("gives no operating-system reason for invalid UTF-8", () => {
			const [d] = read(hostReturning(new Uint8Array([0xff, 0xfe, 0x41])));
			expect(d?.code).toBe("READ_ERROR");
			expect(d?.message).toBe(
				`Cannot read '${FILE}': the file is not valid UTF-8.`,
			);
		});
	});
});
