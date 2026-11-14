/**
 * Fix checking for kb-role-type-mismatch.
 *
 * Property 1: add one fact whose `role` does not fit its `type` to a valid
 * generated knowledge base. The validator reports exactly one ROLE_TYPE_MISMATCH
 * error for that fact, on field `type`, with a message that names the fact, the
 * role, the type and the required type. The fact is built here, not in
 * testkit/faults.ts, so existing fault consumers are unchanged.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateText } from "./index";
import { docOf, kbArb, renderDoc } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";
const PROBE = "probe_fact_zz";

type Role = "check" | "deduction";
type FactType = "boolean" | "number" | "money" | "date" | "enum";

const REQUIRED: Record<Role, FactType> = {
	check: "boolean",
	deduction: "money",
};

/** Every (role, type) pair in the bug condition. */
const MISMATCH_PAIRS: ReadonlyArray<readonly [Role, FactType]> = [
	["check", "number"],
	["check", "money"],
	["check", "date"],
	["check", "enum"],
	["deduction", "boolean"],
	["deduction", "number"],
	["deduction", "date"],
	["deduction", "enum"],
];

describe("Property 1: a role/type mismatch gives exactly one ROLE_TYPE_MISMATCH", () => {
	it("reports one error on field 'type' naming fact, role, type and required type", () => {
		fc.assert(
			fc.property(
				kbArb,
				fc.constantFrom(...MISMATCH_PAIRS),
				(kb, [role, type]) => {
					const doc = docOf(kb);
					const def: Record<string, unknown> = { type, derived: true, role };
					if (type === "enum") def.options = ["gold", "silver"];
					doc.facts[PROBE] = def;

					const result = validateText(renderDoc(doc), FILE);
					const found = result.diagnostics.filter(
						(d) => d.code === "ROLE_TYPE_MISMATCH",
					);

					expect(found).toHaveLength(1);
					const d = found[0];
					expect(d?.severity).toBe("error");
					expect(d?.id).toBe(PROBE);
					expect(d?.field).toBe("type");
					expect(d?.file).toBe(FILE);
					for (const part of [PROBE, role, type, REQUIRED[role]]) {
						expect(d?.message).toContain(part);
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});
