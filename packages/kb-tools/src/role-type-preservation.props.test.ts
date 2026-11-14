/**
 * Preservation for kb-role-type-mismatch.
 *
 * Property 2: a fact outside the bug condition keeps the diagnostics that the
 * validator gave before the fix. The expected values below were observed on the
 * unfixed code. `ROLE_TYPE_MISMATCH` is not yet in the `ErrorCode` union, so it is
 * compared as a plain string.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateText } from "./index";
import { docOf, type KbDoc, kbArb, renderDoc } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";
const PROBE = "probe_fact_zz";
const MISMATCH = "ROLE_TYPE_MISMATCH";

const NOT_DERIVED_MESSAGE = `Fact '${PROBE}' has a 'role' but is not derived. Only derived facts are listed as line items; add derived: true or remove role.`;

const REQUIRED: Record<string, string> = {
	check: "boolean",
	deduction: "money",
};

function inBugCondition(role: unknown, type: unknown): boolean {
	return (
		typeof role === "string" &&
		Object.hasOwn(REQUIRED, role) &&
		typeof type === "string" &&
		["boolean", "number", "money", "date", "enum"].includes(type) &&
		REQUIRED[role] !== type
	);
}

interface Probe {
	readonly type: string;
	readonly role: string | undefined;
	readonly derived: boolean;
}

const VALID_TYPES = ["boolean", "number", "money", "date", "enum"] as const;

/** Probes outside the bug condition: agreeing pair, no role, invalid role or invalid type. */
const probeArb: fc.Arbitrary<Probe> = fc.oneof(
	// role and type agree
	fc.record({
		type: fc.constant("boolean"),
		role: fc.constant<string | undefined>("check"),
		derived: fc.boolean(),
	}),
	fc.record({
		type: fc.constant("money"),
		role: fc.constant<string | undefined>("deduction"),
		derived: fc.boolean(),
	}),
	// no role, any of the five types
	fc.record({
		type: fc.constantFrom(...VALID_TYPES),
		role: fc.constant<string | undefined>(undefined),
		derived: fc.boolean(),
	}),
	// invalid role value, valid type
	fc.record({
		type: fc.constantFrom(...VALID_TYPES),
		role: fc.constantFrom<string | undefined>("bonus", "Check", "line"),
		derived: fc.boolean(),
	}),
	// invalid type value, any role
	fc.record({
		type: fc.constantFrom("text", "int", "Boolean"),
		role: fc.constantFrom<string | undefined>(undefined, "check", "deduction"),
		derived: fc.boolean(),
	}),
);

function probeDef(p: Probe): Record<string, unknown> {
	const def: Record<string, unknown> = { type: p.type };
	if (p.derived) def.derived = true;
	else def.ask = "Question?";
	if (p.type === "enum") def.options = ["gold", "silver"];
	if (p.role !== undefined) def.role = p.role;
	return def;
}

/** Expected SCHEMA_INVALID messages for a probe, as observed on unfixed code, in order. */
function expectedSchemaMessages(p: Probe): string[] {
	const out: string[] = [];
	if (p.role !== undefined && !p.derived) out.push(NOT_DERIVED_MESSAGE);
	if (p.role !== undefined && !Object.hasOwn(REQUIRED, p.role)) {
		out.push(
			`Field 'role' of fact '${PROBE}' must be one of deduction, check. Found '${p.role}'.`,
		);
	}
	if (!(VALID_TYPES as readonly string[]).includes(p.type)) {
		out.push(
			`Field 'type' of fact '${PROBE}' must be one of boolean, number, money, date, enum. Found '${p.type}'.`,
		);
	}
	return out;
}

/** A knowledge base document with every mismatched role removed, so only the probe is in play. */
function cleanDoc(kb: Parameters<typeof docOf>[0]): KbDoc {
	const doc = docOf(kb);
	for (const def of Object.values(doc.facts)) {
		if (inBugCondition(def.role, def.type)) {
			def.role = undefined;
		}
	}
	return doc;
}

function probeDiagnostics(doc: KbDoc) {
	const result = validateText(renderDoc(doc), FILE);
	return result.diagnostics.filter((d) => d.id === PROBE);
}

describe("Property 2: Preservation of diagnostics outside the bug condition", () => {
	it("a probe fact keeps its observed SCHEMA_INVALID diagnostics and gains no ROLE_TYPE_MISMATCH", () => {
		fc.assert(
			fc.property(kbArb, probeArb, (kb, probe) => {
				const doc = cleanDoc(kb);
				doc.facts[PROBE] = probeDef(probe);
				const found = probeDiagnostics(doc);

				expect(found.some((d) => (d.code as string) === MISMATCH)).toBe(false);

				const schema = found.filter((d) => d.code === "SCHEMA_INVALID");
				expect(schema.map((d) => d.message)).toEqual(
					expectedSchemaMessages(probe),
				);
				for (const d of schema) {
					expect(d.severity).toBe("error");
					expect(d.file).toBe(FILE);
					expect(d.id).toBe(PROBE);
					expect(["role", "type"]).toContain(d.field);
				}
				// No other error is reported for the probe.
				expect(
					found
						.filter((d) => d.code !== "SCHEMA_INVALID")
						.map((d) => d.severity),
				).not.toContain("error");
			}),
			{ numRuns: 100 },
		);
	});

	it("a valid knowledge base with correct roles reports no ROLE_TYPE_MISMATCH and no role diagnostic", () => {
		fc.assert(
			fc.property(kbArb, (kb) => {
				const doc = cleanDoc(kb);
				const result = validateText(renderDoc(doc), FILE);
				expect(
					result.diagnostics.some((d) => (d.code as string) === MISMATCH),
				).toBe(false);
				expect(
					result.diagnostics.some(
						(d) => d.code === "SCHEMA_INVALID" && d.field === "role",
					),
				).toBe(false);
			}),
			{ numRuns: 100 },
		);
	});

	it("records the exact message for a non-derived boolean check fact", () => {
		const doc = cleanDoc({
			id: "demo",
			goals: [],
			facts: {},
			rules: [],
			clauses: {},
		});
		doc.facts[PROBE] = { type: "boolean", ask: "Question?", role: "check" };
		const found = probeDiagnostics(doc);
		expect(found).toEqual([
			{
				severity: "error",
				code: "SCHEMA_INVALID",
				file: FILE,
				message: NOT_DERIVED_MESSAGE,
				id: PROBE,
				field: "role",
			},
		]);
	});

	it("records the observed diagnostics for an invalid role and an invalid type", () => {
		const base = {
			id: "demo",
			goals: [],
			facts: {},
			rules: [],
			clauses: {},
		};
		const badRole = cleanDoc(base);
		badRole.facts[PROBE] = { type: "number", derived: true, role: "bonus" };
		expect(probeDiagnostics(badRole)).toEqual([
			{
				severity: "error",
				code: "SCHEMA_INVALID",
				file: FILE,
				message: `Field 'role' of fact '${PROBE}' must be one of deduction, check. Found 'bonus'.`,
				id: PROBE,
				field: "role",
			},
		]);

		const badType = cleanDoc(base);
		badType.facts[PROBE] = { type: "text", derived: true, role: "check" };
		expect(probeDiagnostics(badType)).toEqual([
			{
				severity: "error",
				code: "SCHEMA_INVALID",
				file: FILE,
				message: `Field 'type' of fact '${PROBE}' must be one of boolean, number, money, date, enum. Found 'text'.`,
				id: PROBE,
				field: "type",
			},
		]);
	});
});
