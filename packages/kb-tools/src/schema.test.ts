import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./index";
import { validateRaw, validateText } from "./index";
import { checkSchema } from "./schema";

const FILE = "apps/demo/kb/demo.yaml";

type Obj = Record<string, unknown>;

/** A knowledge base that passes phase 1. Each test copies and breaks it. */
function base(): Obj {
	return {
		id: "demo",
		currency: "INR",
		goals: ["payable"],
		facts: {
			rent: { type: "money", ask: "What is the rent?" },
			tier: { type: "enum", ask: "Which tier?", options: ["gold", "silver"] },
			payable: { type: "money", derived: true, role: "deduction" },
		},
		rules: [
			{
				id: "R-1",
				cite: "4.2",
				set: "payable",
				to: "rent",
				because: "Rent is payable.",
			},
		],
		clauses: { "4.2": { title: "Room", text: "Room rent." } },
	};
}

function clone(): Obj {
	return structuredClone(base());
}

function run(value: unknown): readonly Diagnostic[] {
	return validateRaw(value, FILE).diagnostics;
}

function only(diags: readonly Diagnostic[]): Diagnostic {
	expect(diags).toHaveLength(1);
	return diags[0] as Diagnostic;
}

describe("Schema: accepted shapes", () => {
	it("accepts the base knowledge base with no diagnostics", () => {
		const result = validateRaw(base(), FILE);
		expect(result.diagnostics).toEqual([]);
		expect(result.ok).toBe(true);
	});

	it("accepts every documented fact property and an omitted currency", () => {
		const kb = clone();
		delete kb.currency;
		(kb.facts as Obj).extra = {
			type: "boolean",
			ask: "Q?",
			why: "Because.",
			label: "Extra",
			derived: true,
			role: "check",
		};
		expect(run(kb)).toEqual([]);
	});

	it("accepts `when: true` and `to: 5` as canonical text", () => {
		const text = `
id: demo
goals: [x]
facts:
  x: { type: number, derived: true }
rules:
  - id: R-1
    cite: "4.2"
    set: x
    to: 5
    when: true
    because: b
clauses:
  "4.2": { title: t, text: t }
`;
		expect(validateText(text, FILE).diagnostics).toEqual([]);
		const parsed = checkSchema(
			{
				...clone(),
				rules: [
					{ id: "R-1", cite: "c", set: "s", because: "b", to: 5, when: false },
				],
			},
			FILE,
		);
		expect(parsed.model?.rules[0]?.toText).toBe("5");
		expect(parsed.model?.rules[0]?.whenText).toBe("false");
	});
});

describe("Schema: quoting hazards", () => {
	it("reports an unquoted number as a cite and tells the author to quote it", () => {
		const text = `
id: demo
goals: [x]
facts:
  x: { type: number, derived: true }
rules:
  - id: ROOM-01
    cite: 4.2
    set: x
    to: 1
    because: b
clauses:
  "4.2": { title: t, text: t }
`;
		const d = only(validateText(text, FILE).diagnostics);
		expect(d.code).toBe("SCHEMA_INVALID");
		expect(d.id).toBe("ROOM-01");
		expect(d.message).toContain("Quote it");
		expect(d.message).toContain('"4.2"');
	});

	it("reports an unquoted clause key 4.2 as SCHEMA_INVALID telling the author to quote it", () => {
		const text = `
id: demo
goals: [x]
facts:
  x: { type: number, derived: true }
rules: []
clauses:
  4.2: { title: t, text: t }
`;
		const diags = validateText(text, FILE).diagnostics;
		const d = diags.find((x) => x.code === "SCHEMA_INVALID");
		expect(d).toBeDefined();
		expect(d?.message.toLowerCase()).toContain("quote");
	});
});

describe("Schema: fact cross-field rules", () => {
	it("rejects an enum fact without options, naming the fact", () => {
		const kb = clone();
		(kb.facts as Obj).tier = { type: "enum", ask: "Which?" };
		const d = only(run(kb));
		expect(d.code).toBe("SCHEMA_INVALID");
		expect(d.id).toBe("tier");
		expect(d.message).toContain("'tier'");
	});

	it("rejects an enum fact with an empty options list", () => {
		const kb = clone();
		(kb.facts as Obj).tier = { type: "enum", ask: "Which?", options: [] };
		const d = only(run(kb));
		expect(d.id).toBe("tier");
		expect(d.message).toContain("empty");
	});

	it("rejects options on a non-enum fact", () => {
		const kb = clone();
		(kb.facts as Obj).rent = { type: "money", ask: "?", options: ["a"] };
		const d = only(run(kb));
		expect(d.code).toBe("SCHEMA_INVALID");
		expect(d.id).toBe("rent");
		expect(d.field).toBe("options");
	});

	it("rejects a repeated option once, naming the fact and the option", () => {
		const kb = clone();
		(kb.facts as Obj).tier = {
			type: "enum",
			ask: "?",
			options: ["gold", "gold", "silver"],
		};
		const d = only(run(kb));
		expect(d.id).toBe("tier");
		expect(d.message).toContain("'gold'");
	});

	it("rejects a role on a fact that is not derived", () => {
		const kb = clone();
		(kb.facts as Obj).rent = { type: "money", ask: "?", role: "deduction" };
		const d = only(run(kb));
		expect(d.id).toBe("rent");
		expect(d.field).toBe("role");
	});

	it("rejects an unknown fact type and a role outside deduction/check", () => {
		const kb = clone();
		(kb.facts as Obj).rent = { type: "int", ask: "?" };
		(kb.facts as Obj).payable = { type: "money", derived: true, role: "other" };
		const diags = run(kb);
		expect(diags.map((d) => d.id).sort()).toEqual(["payable", "rent"]);
		expect(diags.find((d) => d.id === "rent")?.message).toContain(
			"Found 'int'",
		);
	});
});

describe("Schema: unknown fields at every level", () => {
	it("names an unknown top-level field", () => {
		const kb = { ...clone(), colour: "red" };
		const d = only(run(kb));
		expect(d.code).toBe("SCHEMA_INVALID");
		expect(d.message).toContain("'colour'");
		expect(d.message).toContain("the top level");
	});

	it("names an unknown fact field and the fact", () => {
		const kb = clone();
		(kb.facts as Obj).rent = { type: "money", ask: "?", colour: "red" };
		const d = only(run(kb));
		expect(d.id).toBe("rent");
		expect(d.message).toContain("'colour'");
		expect(d.message).toContain("fact 'rent'");
	});

	it("names an unknown rule field and the rule", () => {
		const kb = clone();
		(kb.rules as Obj[])[0] = { ...(kb.rules as Obj[])[0], colour: "red" };
		const d = only(run(kb));
		expect(d.id).toBe("R-1");
		expect(d.message).toContain("'colour'");
	});

	it("names an unknown clause field and the clause", () => {
		const kb = clone();
		(kb.clauses as Obj)["4.2"] = { title: "t", text: "t", colour: "red" };
		const d = only(run(kb));
		expect(d.id).toBe("4.2");
		expect(d.message).toContain("'colour'");
	});
});

describe("Schema: required fields and types", () => {
	it("reports each missing top-level field", () => {
		for (const field of ["id", "goals", "facts", "rules", "clauses"]) {
			const kb = clone();
			delete kb[field];
			const diags = run(kb);
			expect(diags.length).toBeGreaterThan(0);
			expect(diags.every((d) => d.code === "SCHEMA_INVALID")).toBe(true);
			expect(diags.some((d) => d.message.includes(`'${field}'`))).toBe(true);
		}
	});

	it("reports a missing rule field with the rule id", () => {
		const kb = clone();
		delete ((kb.rules as Obj[])[0] as Obj).because;
		const d = only(run(kb));
		expect(d.id).toBe("R-1");
		expect(d.message).toContain("missing the required field 'because'");
	});

	it("reports a missing clause field with the clause id", () => {
		const kb = clone();
		(kb.clauses as Obj)["4.2"] = { title: "t" };
		const d = only(run(kb));
		expect(d.id).toBe("4.2");
		expect(d.message).toContain("'text'");
	});

	it("accepts only a string where a string is required", () => {
		const kb = clone();
		(kb.facts as Obj).rent = { type: "money", ask: 5 };
		const d = only(run(kb));
		expect(d.id).toBe("rent");
		expect(d.message).toContain("must be a string");
		expect(d.message).toContain("a number");
	});
});

describe("Schema: currency", () => {
	it("rejects a lower-case currency", () => {
		const kb = { ...clone(), currency: "inr" };
		const d = only(run(kb));
		expect(d.code).toBe("SCHEMA_INVALID");
		expect(d.message).toContain("three upper-case letters");
		expect(d.message).toContain("'inr'");
	});

	it("rejects a currency of the wrong length", () => {
		expect(run({ ...clone(), currency: "INRS" })).toHaveLength(1);
	});
});

describe("Schema: expression text", () => {
	it("rejects `to: .inf` and names the rule", () => {
		const text = `
id: demo
goals: [x]
facts:
  x: { type: number, derived: true }
rules:
  - id: R-1
    cite: "4.2"
    set: x
    to: .inf
    because: b
clauses:
  "4.2": { title: t, text: t }
`;
		const d = only(validateText(text, FILE).diagnostics);
		expect(d.code).toBe("SCHEMA_INVALID");
		expect(d.id).toBe("R-1");
		expect(d.field).toBe("to");
		expect(d.message).toContain("finite");
	});

	it("rejects a non-finite `when` as well", () => {
		const kb = clone();
		(kb.rules as Obj[])[0] = { ...(kb.rules as Obj[])[0], when: Number.NaN };
		const d = only(run(kb));
		expect(d.field).toBe("when");
	});

	it("rejects an expression that is a list", () => {
		const kb = clone();
		(kb.rules as Obj[])[0] = { ...(kb.rules as Obj[])[0], to: ["a"] };
		const d = only(run(kb));
		expect(d.id).toBe("R-1");
		expect(d.field).toBe("to");
	});
});

describe("Schema: several violations in one run", () => {
	it("reports every violation, not just the first, each with its entity id", () => {
		const kb: Obj = { ...clone(), currency: "inr", colour: "red" };
		(kb.facts as Obj).rent = { type: "int" };
		(kb.facts as Obj).tier = { type: "enum", ask: "?" };
		(kb.rules as Obj[])[0] = {
			id: "R-1",
			cite: 4.2,
			set: "payable",
			to: "rent",
		};
		(kb.clauses as Obj)["4.2"] = { title: 1, text: "t" };
		const diags = run(kb);
		expect(diags.every((d) => d.code === "SCHEMA_INVALID")).toBe(true);
		expect(diags.every((d) => d.file === FILE)).toBe(true);
		const ids = new Set(diags.map((d) => d.id));
		expect(ids).toContain("rent");
		expect(ids).toContain("tier");
		expect(ids).toContain("R-1");
		expect(ids).toContain("4.2");
		expect(
			diags.some((d) => d.id === undefined && d.message.includes("'currency'")),
		).toBe(true);
		expect(diags.some((d) => d.message.includes("'colour'"))).toBe(true);
		expect(diags.length).toBeGreaterThanOrEqual(7);
	});

	it("sets the id of the offending entity and the file on every diagnostic", () => {
		const kb = clone();
		(kb.facts as Obj).rent = { type: "money", ask: 1 };
		const d = only(run(kb));
		expect(d.id).toBe("rent");
		expect(d.file).toBe(FILE);
		expect(d.severity).toBe("error");
	});

	it("does not stop at the first bad rule", () => {
		const kb = clone();
		kb.rules = [{ id: "A" }, { id: "B" }];
		const diags = run(kb);
		expect(diags.filter((d) => d.id === "A").length).toBeGreaterThan(0);
		expect(diags.filter((d) => d.id === "B").length).toBeGreaterThan(0);
	});
});

describe("Schema: non-mapping values", () => {
	it("rejects a facts value that is a list", () => {
		const d = only(run({ ...clone(), facts: [] }));
		expect(d.code).toBe("SCHEMA_INVALID");
		expect(d.message).toContain("facts");
	});

	it("rejects a top level that is not a mapping", () => {
		expect(only(run(["x"])).code).toBe("SCHEMA_INVALID");
		expect(only(run(null)).code).toBe("SCHEMA_INVALID");
	});
});
