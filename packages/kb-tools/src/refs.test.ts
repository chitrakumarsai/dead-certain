import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./index";
import { validateText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";

interface Parts {
	goals?: string;
	facts?: string;
	rules?: string;
	clauses?: string;
}

const DEFAULT_FACTS = `  rent:
    type: money
    ask: What is the rent?
  tier:
    type: enum
    ask: Which tier?
    options: [gold, silver]
  payable:
    type: money
    derived: true
`;

const DEFAULT_RULES = `  - id: R-1
    cite: "4.2"
    set: payable
    to: rent
    because: Rent is payable.
`;

/** Builds a knowledge base that passes every check; tests override one part. */
function kb(parts: Parts = {}): string {
	return [
		"id: demo",
		`goals: ${parts.goals ?? "[payable]"}`,
		"facts:",
		parts.facts ?? DEFAULT_FACTS,
		"rules:",
		parts.rules ?? DEFAULT_RULES,
		"clauses:",
		parts.clauses ?? '  "4.2":\n    title: Room\n    text: Room rent.\n',
	].join("\n");
}

/** One rule setting `payable`, with the given `to` line and optional extras. */
function rule(to: string, extra = ""): string {
	return `  - id: R-1
    cite: "4.2"
    set: payable
    to: ${to}
    because: Because.
${extra}`;
}

function run(text: string): readonly Diagnostic[] {
	return validateText(text, FILE).diagnostics;
}

function codes(diags: readonly Diagnostic[]): string[] {
	return diags.map((d) => d.code);
}

function only(diags: readonly Diagnostic[], code: string): Diagnostic {
	expect(codes(diags)).toEqual([code]);
	return diags[0] as Diagnostic;
}

describe("baseline", () => {
	it("validates the passing base knowledge base", () => {
		expect(run(kb())).toEqual([]);
	});
});

describe("UNKNOWN_FACT and the quoted-literal hint", () => {
	it("gives the hint for an unquoted lone identifier (to: 'gold' in YAML)", () => {
		const d = only(run(kb({ rules: rule("'gold'") })), "UNKNOWN_FACT");
		expect(d.message).toBe(
			`Fact 'gold' is not defined — did you mean the enum literal 'gold'? Corrected YAML: "'gold'"`,
		);
		expect(d.id).toBe("R-1");
		expect(d.field).toBe("to");
		expect(d.file).toBe(FILE);
	});

	it("validates the corrected form to: \"'gold'\" as an enum literal", () => {
		const facts = DEFAULT_FACTS.replace(
			"    type: money\n    derived: true",
			"    type: enum\n    options: [gold, silver]\n    derived: true",
		);
		expect(run(kb({ facts, rules: rule(`"'gold'"`) }))).toEqual([]);
	});

	it("gives the plain message when the unknown name is part of a larger expression", () => {
		const d = only(run(kb({ rules: rule("gold + 1") })), "UNKNOWN_FACT");
		expect(d.message).toBe("Fact 'gold' is not defined.");
	});

	it("gives no diagnostic for a defined bare identifier", () => {
		expect(run(kb({ rules: rule("rent") }))).toEqual([]);
	});

	it("reports an unknown name in `when` with the field", () => {
		const d = only(
			run(kb({ rules: rule("rent", "    when: missing > 1\n") })),
			"UNKNOWN_FACT",
		);
		expect(d.field).toBe("when");
		expect(d.message).toBe("Fact 'missing' is not defined.");
	});

	it("reports each distinct unknown name once per field", () => {
		const diags = run(kb({ rules: rule("a + a + b") }));
		expect(codes(diags)).toEqual(["UNKNOWN_FACT", "UNKNOWN_FACT"]);
		expect(diags.map((d) => d.message)).toEqual([
			"Fact 'a' is not defined.",
			"Fact 'b' is not defined.",
		]);
	});

	it("does not find prototype names: toString and __proto__ are unknown", () => {
		const diags = run(kb({ rules: rule("toString + __proto__") }));
		expect(codes(diags)).toEqual(["UNKNOWN_FACT", "UNKNOWN_FACT"]);
		expect(diags.map((d) => d.message).join(" ")).toContain("'toString'");
		expect(diags.map((d) => d.message).join(" ")).toContain("'__proto__'");
	});

	it("finds a fact that is named toString", () => {
		const facts = `${DEFAULT_FACTS}  toString:\n    type: money\n    ask: Q?\n`;
		expect(run(kb({ facts, rules: rule("toString") }))).toEqual([]);
	});
});

describe("PARSE_ERROR", () => {
	it("names the rule, the field, the parse code and the position", () => {
		const d = only(run(kb({ rules: rule('"rent +"') })), "PARSE_ERROR");
		expect(d.id).toBe("R-1");
		expect(d.field).toBe("to");
		expect(d.message).toContain("Rule 'R-1'");
		expect(d.message).toContain("'to'");
		expect(d.message).toMatch(/\([A-Z_]+ at position \d+\)/);
		expect(d.message).toContain("Source: 'rent +'");
	});

	it("names the `when` field for a bad guard", () => {
		const d = only(
			run(kb({ rules: rule("rent", '    when: "1 <"\n') })),
			"PARSE_ERROR",
		);
		expect(d.field).toBe("when");
	});

	it("reports a 400-digit literal as PARSE_ERROR", () => {
		const digits = "9".repeat(400);
		const d = only(run(kb({ rules: rule(`"${digits}"`) })), "PARSE_ERROR");
		expect(d.id).toBe("R-1");
		expect(d.message.length).toBeLessThan(600);
	});

	it("returns a result, without throwing, for a 5,000-term chain", () => {
		const chain = `"rent${" + 1".repeat(5000)}"`;
		let diags: readonly Diagnostic[] = [];
		expect(() => {
			diags = run(kb({ rules: rule(chain) }));
		}).not.toThrow();
		for (const d of diags) expect(d.code).toBe("PARSE_ERROR");
	});

	it("passes: a well-formed expression has no PARSE_ERROR", () => {
		expect(run(kb({ rules: rule("round(rent * 2)") }))).toEqual([]);
	});
});

describe("DUPLICATE_RULE", () => {
	it("reports each rule after the first", () => {
		const rules = DEFAULT_RULES + DEFAULT_RULES + DEFAULT_RULES;
		const diags = run(kb({ rules }));
		expect(codes(diags)).toEqual(["DUPLICATE_RULE", "DUPLICATE_RULE"]);
		expect(diags.every((d) => d.id === "R-1")).toBe(true);
	});

	it("passes with distinct ids", () => {
		const rules = DEFAULT_RULES + DEFAULT_RULES.replace("R-1", "R-2");
		expect(run(kb({ rules }))).toEqual([]);
	});
});

describe("DUPLICATE_FACT and DUPLICATE_CLAUSE (from the Loader)", () => {
	it("reports a repeated fact name", () => {
		const facts = `${DEFAULT_FACTS}  rent:\n    type: money\n    ask: Again?\n`;
		const diags = run(kb({ facts }));
		expect(codes(diags)).toContain("DUPLICATE_FACT");
		expect(diags.find((d) => d.code === "DUPLICATE_FACT")?.id).toBe("rent");
	});

	it("reports a repeated clause id", () => {
		const clauses =
			'  "4.2":\n    title: A\n    text: A.\n  "4.2":\n    title: B\n    text: B.\n';
		const diags = run(kb({ clauses }));
		expect(codes(diags)).toContain("DUPLICATE_CLAUSE");
		expect(diags.find((d) => d.code === "DUPLICATE_CLAUSE")?.id).toBe("4.2");
	});
});

describe("UNKNOWN_GOAL", () => {
	it("reports a goal that is not a fact", () => {
		const d = only(run(kb({ goals: "[payable, nothing]" })), "UNKNOWN_GOAL");
		expect(d.id).toBe("nothing");
		expect(d.file).toBe(FILE);
	});

	it("does not find a goal by prototype lookup", () => {
		const d = only(run(kb({ goals: "[payable, toString]" })), "UNKNOWN_GOAL");
		expect(d.id).toBe("toString");
	});

	it("passes when every goal is a fact", () => {
		expect(run(kb({ goals: "[payable]" }))).toEqual([]);
	});
});

describe("UNKNOWN_SET_FACT", () => {
	it("reports a rule that sets a name that is not a fact", () => {
		const rules = DEFAULT_RULES.replace("set: payable", "set: ghost");
		// The goal `payable` is then set by no rule, so GOAL_UNSET is also expected.
		const diags = run(kb({ rules }));
		expect(codes(diags)).toEqual(["GOAL_UNSET", "UNKNOWN_SET_FACT"]);
		const d = diags.find((x) => x.code === "UNKNOWN_SET_FACT") as Diagnostic;
		expect(d.id).toBe("R-1");
		expect(d.field).toBe("set");
		expect(d.message).toContain("'ghost'");
	});

	it("passes when `set` is a fact", () => {
		expect(run(kb())).toEqual([]);
	});
});

describe("UNKNOWN_CLAUSE", () => {
	it("reports a cite that is not a clause, naming rule and cite", () => {
		const rules = DEFAULT_RULES.replace('"4.2"', '"9.9"');
		const d = only(run(kb({ rules })), "UNKNOWN_CLAUSE");
		expect(d.id).toBe("R-1");
		expect(d.field).toBe("cite");
		expect(d.message).toContain("'9.9'");
	});

	it("does not find a clause by prototype lookup", () => {
		const rules = DEFAULT_RULES.replace('"4.2"', "constructor");
		const d = only(run(kb({ rules })), "UNKNOWN_CLAUSE");
		expect(d.message).toContain("'constructor'");
	});

	it("passes when the cite is a clause", () => {
		expect(run(kb())).toEqual([]);
	});
});

describe("UNKNOWN_PLACEHOLDER", () => {
	it("reports a placeholder naming no fact, once per name", () => {
		const rules = DEFAULT_RULES.replace(
			"because: Rent is payable.",
			"because: Rent {ghost} and {ghost} and {rent}.",
		);
		const d = only(run(kb({ rules })), "UNKNOWN_PLACEHOLDER");
		expect(d.id).toBe("R-1");
		expect(d.field).toBe("because");
		expect(d.message).toContain("{ghost}");
	});

	it("passes when placeholders name facts", () => {
		const rules = DEFAULT_RULES.replace(
			"because: Rent is payable.",
			"because: Rent {rent} for {tier}.",
		);
		expect(run(kb({ rules }))).toEqual([]);
	});
});

describe("GOAL_UNSET", () => {
	const facts = `${DEFAULT_FACTS}  other:\n    type: money\n    derived: true\n`;

	it("reports a goal fact that no rule sets", () => {
		const d = only(run(kb({ facts, goals: "[payable, other]" })), "GOAL_UNSET");
		expect(d.id).toBe("other");
	});

	it("passes when a rule sets every goal", () => {
		expect(run(kb({ facts, goals: "[payable]" }))).toEqual([]);
	});
});

describe("MISSING_ASK", () => {
	it("reports an askable fact without ask text", () => {
		const facts = DEFAULT_FACTS.replace("    ask: What is the rent?\n", "");
		const d = only(run(kb({ facts })), "MISSING_ASK");
		expect(d.id).toBe("rent");
		expect(d.field).toBe("ask");
	});

	it("passes for a derived fact without ask", () => {
		expect(run(kb())).toEqual([]);
	});

	it("gives no diagnostic for a derived fact that also has ask", () => {
		const facts = DEFAULT_FACTS.replace(
			"    derived: true",
			"    derived: true\n    ask: Override?",
		);
		expect(run(kb({ facts }))).toEqual([]);
	});
});

describe("SET_NON_DERIVED", () => {
	it("reports a rule that sets a fact not marked derived", () => {
		const rules = DEFAULT_RULES.replace("set: payable", "set: rent").replace(
			"to: rent",
			"to: 100",
		);
		const diags = run(kb({ rules, goals: "[rent]" }));
		const d = only(diags, "SET_NON_DERIVED");
		expect(d.id).toBe("R-1");
		expect(d.field).toBe("set");
	});

	it("passes when the set fact is derived", () => {
		expect(run(kb())).toEqual([]);
	});
});
