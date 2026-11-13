import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Diagnostic, DiagnosticCode } from "./index";
import { validateText } from "./index";
import { faultArb, kbArb, renderYaml } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

const ALL_CODES: readonly DiagnosticCode[] = [
	"READ_ERROR",
	"YAML_SYNTAX",
	"SCHEMA_INVALID",
	"PARSE_ERROR",
	"DUPLICATE_FACT",
	"DUPLICATE_RULE",
	"DUPLICATE_CLAUSE",
	"UNKNOWN_FACT",
	"UNKNOWN_GOAL",
	"UNKNOWN_SET_FACT",
	"UNKNOWN_CLAUSE",
	"UNKNOWN_PLACEHOLDER",
	"CYCLE",
	"GOAL_UNSET",
	"MISSING_ASK",
	"ENUM_VALUE_NOT_IN_OPTIONS",
	"SET_NON_DERIVED",
	"TYPE_MISMATCH",
	"NOT_BOOLEAN",
	"MONEY_NOT_ROUNDED",
	"NO_FALLBACK_RULE",
	"DEAD_GUARD",
];
const WARNINGS: ReadonlySet<string> = new Set([
	"NO_FALLBACK_RULE",
	"DEAD_GUARD",
]);

/** Codes whose `id` is a rule id. */
const RULE_SCOPED: ReadonlySet<string> = new Set([
	"DUPLICATE_RULE",
	"UNKNOWN_FACT",
	"UNKNOWN_SET_FACT",
	"UNKNOWN_CLAUSE",
	"UNKNOWN_PLACEHOLDER",
	"SET_NON_DERIVED",
	"PARSE_ERROR",
	"TYPE_MISMATCH",
	"NOT_BOOLEAN",
	"MONEY_NOT_ROUNDED",
	"DEAD_GUARD",
]);

/** Codes whose `id` is a fact name. */
const FACT_SCOPED: ReadonlySet<string> = new Set([
	"DUPLICATE_FACT",
	"GOAL_UNSET",
	"MISSING_ASK",
	"ENUM_VALUE_NOT_IN_OPTIONS",
	"NO_FALLBACK_RULE",
]);

const MAX_QUOTED = 200 + 1; // 200 characters plus the clip marker

function compareUnits(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function checkShape(
	diagnostics: readonly Diagnostic[],
	ruleIds: ReadonlySet<string> | undefined,
	factNames: ReadonlySet<string> | undefined,
): void {
	for (const d of diagnostics) {
		expect(ALL_CODES).toContain(d.code);
		expect(d.severity).toBe(WARNINGS.has(d.code) ? "warning" : "error");
		expect(d.file).toBe(FILE);
		expect(d.message.length).toBeGreaterThan(0);
		for (const m of d.message.matchAll(/'([^']*)'/g)) {
			expect((m[1] ?? "").length).toBeLessThanOrEqual(MAX_QUOTED);
		}
		if (RULE_SCOPED.has(d.code) && ruleIds !== undefined) {
			expect(d.id).toBeDefined();
			expect(ruleIds.has(d.id as string)).toBe(true);
		}
		if (FACT_SCOPED.has(d.code) && factNames !== undefined) {
			expect(d.id).toBeDefined();
			expect(factNames.has(d.id as string)).toBe(true);
		}
	}
}

/** Within one rule (same id, unique rule ids) diagnostics follow (code, field, message). */
function checkOrder(diagnostics: readonly Diagnostic[]): void {
	for (let i = 1; i < diagnostics.length; i++) {
		const a = diagnostics[i - 1] as Diagnostic;
		const b = diagnostics[i] as Diagnostic;
		if (a.id === undefined || a.id !== b.id) continue;
		if (!RULE_SCOPED.has(a.code) || !RULE_SCOPED.has(b.code)) continue;
		if (a.code === "DUPLICATE_RULE" || b.code === "DUPLICATE_RULE") continue;
		const c =
			compareUnits(a.code, b.code) ||
			compareUnits(a.field ?? "", b.field ?? "") ||
			compareUnits(a.message, b.message);
		expect(c).toBeLessThanOrEqual(0);
	}
}

describe("Property 2: Diagnostics are well formed and sorted", () => {
	// Feature: kb-tools, Property 2: Diagnostics are well formed and sorted
	// **Validates: Requirements 3.12, 5.10, 16.9, 18.1, 18.2, 18.3, 18.5**
	it("faulty generated bases give well-formed, ordered diagnostics", () => {
		fc.assert(
			fc.property(
				kbArb.chain((kb) => faultArb(kb).map((f) => ({ f, kb }))),
				({ f }) => {
					const ruleIds = new Set(f.doc.rules.map((r) => String(r.id)));
					const factNames = new Set(Object.keys(f.doc.facts));
					const { diagnostics } = validateText(f.text, FILE);
					expect(diagnostics.length).toBeGreaterThan(0);
					checkShape(diagnostics, ruleIds, factNames);
					checkOrder(diagnostics);
				},
			),
			{ numRuns: 300 },
		);
	});

	it("valid generated bases give well-formed diagnostics", () => {
		fc.assert(
			fc.property(kbArb, (kb) => {
				const ruleIds = new Set(kb.rules.map((r) => r.id));
				const factNames = new Set(Object.keys(kb.facts));
				const { diagnostics } = validateText(renderYaml(kb), FILE);
				checkShape(diagnostics, ruleIds, factNames);
				checkOrder(diagnostics);
			}),
			{ numRuns: 200 },
		);
	});

	it("arbitrary text gives well-formed diagnostics with bounded quotes", () => {
		fc.assert(
			fc.property(
				fc.oneof(
					fc.string({ maxLength: 300 }),
					fc
						.array(
							fc.constantFrom(
								"id: x",
								"goals: [a]",
								"facts:",
								"  a: {type: number}",
								"rules:",
								"  - id: r",
								"clauses:",
								"{",
								"- b",
								"__proto__: 1",
								`  - id: ${"q".repeat(500)}`,
							),
							{ maxLength: 15 },
						)
						.map((p) => p.join("\n")),
				),
				(text) => {
					const { diagnostics } = validateText(text, FILE);
					checkShape(diagnostics, undefined, undefined);
				},
			),
			{ numRuns: 300 },
		);
	});

	it("clips long quoted names to 200 characters", () => {
		const long = "z".repeat(1000);
		const text = renderYaml({
			id: "demo",
			goals: [long],
			facts: {},
			rules: [],
			clauses: {},
		} as never);
		const { diagnostics } = validateText(text, FILE);
		checkShape(diagnostics, undefined, undefined);
	});
});
