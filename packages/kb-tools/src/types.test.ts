import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./index";
import { validateText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";

const FACTS = `  rent:
    type: money
    ask: What is the rent?
  qty:
    type: number
    ask: How many?
  due:
    type: date
    ask: When is it due?
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
  out_n:
    type: number
    derived: true
  out_b:
    type: boolean
    derived: true
  out_d:
    type: date
    derived: true
  out_e:
    type: enum
    options: [gold, silver]
    derived: true
`;

/** One rule setting `set` from `to`, with an optional `when`. */
function kb(to: string, opts: { set?: string; when?: string } = {}): string {
	const when =
		opts.when === undefined ? "" : `    when: ${JSON.stringify(opts.when)}\n`;
	return [
		"id: demo",
		"goals: [payable]",
		"facts:",
		FACTS,
		"rules:",
		"  - id: R-1",
		'    cite: "4.2"',
		`    set: ${opts.set ?? "payable"}`,
		`    to: ${JSON.stringify(to)}`,
		"    because: Because.",
		when,
		"clauses:",
		'  "4.2":',
		"    title: Room",
		"    text: Room rent.",
	].join("\n");
}

const TYPE_CODES = new Set(["TYPE_MISMATCH", "NOT_BOOLEAN"]);

/** The type diagnostics for a knowledge base. */
function typeDiags(text: string): Diagnostic[] {
	return validateText(text, FILE).diagnostics.filter((d) =>
		TYPE_CODES.has(d.code),
	);
}

/** Asserts exactly one TYPE_MISMATCH inside `field`, returning it. */
function oneMismatch(text: string, field = "to"): Diagnostic {
	const diags = typeDiags(text);
	expect(diags.map((d) => d.code)).toEqual(["TYPE_MISMATCH"]);
	const d = diags[0] as Diagnostic;
	expect(d.id).toBe("R-1");
	expect(d.field).toBe(field);
	expect(d.file).toBe(FILE);
	return d;
}

function accepted(to: string, set = "payable", when?: string): void {
	const text = kb(to, { set, when });
	expect(typeDiags(text)).toEqual([]);
}

describe("arithmetic and unary minus (10.2)", () => {
	it("accepts numbers and money", () => {
		accepted("rent + qty * 2 - 1 / 4");
		accepted("-rent");
	});

	it.each(["rent + ok", "rent - due", "tier * 2", "rent / 'gold'"])(
		"rejects %s",
		(to) => {
			oneMismatch(kb(to));
		},
	);

	it("rejects unary minus on a boolean and names rule, field and sub-expression", () => {
		const d = oneMismatch(kb("-ok"));
		expect(d.message).toContain("Rule 'R-1' field 'to'");
		expect(d.message).toContain("-ok");
	});

	it("names the printed sub-expression, not the whole expression", () => {
		const d = oneMismatch(kb("rent + (qty * ok)"));
		expect(d.message).toContain("qty * ok");
		expect(d.message).not.toContain("rent +");
	});

	it("clips a long printed sub-expression to 200 characters plus an ellipsis", () => {
		const long = `${Array.from({ length: 80 }, () => "rent").join(" + ")} + ok`;
		const d = oneMismatch(kb(long));
		expect(d.message).toContain("…");
		expect(d.message).not.toContain(long);
		const quoted = /in '(.*)'\.$/.exec(d.message)?.[1] ?? "";
		expect(quoted.length).toBe(201);
	});
});

describe("== and != (10.3)", () => {
	it("rejects a date compared with an enum", () => {
		oneMismatch(kb("if(due == 'gold', 1, 2)"));
		oneMismatch(kb("if(due != tier, 1, 2)"));
	});

	it("accepts two operands of the same type, money against number", () => {
		accepted('if(due == "2026-11-10", 1, 2)');
		accepted("if(tier == 'gold', 1, 2)");
		accepted("if(ok != true, 1, 2)");
		accepted("if(rent == qty, 1, 2)");
	});
});

describe("ordering operators (10.4)", () => {
	it.each([
		"if(ok < true, 1, 2)",
		"if(tier >= 'gold', 1, 2)",
		"if(due < rent, 1, 2)",
		"if(rent > due, 1, 2)",
	])("rejects %s", (to) => {
		oneMismatch(kb(to));
	});

	it("accepts two numbers (money included) and two dates", () => {
		accepted("if(rent <= qty, 1, 2)");
		accepted('if(due > "2026-01-01", 1, 2)');
	});
});

describe("and, or and not (10.5)", () => {
	it.each([
		"if(ok and rent, 1, 2)",
		"if(qty or ok, 1, 2)",
		"if(not rent, 1, 2)",
	])("rejects %s", (to) => {
		oneMismatch(kb(to));
	});

	it("accepts booleans", () => {
		accepted("if(ok and not ok or ok, 1, 2)");
	});
});

describe("min, max, round and days_between (10.6)", () => {
	it.each(["min(rent, ok)", "max(due, 1)", "round(ok)", "round(tier)"])(
		"rejects %s",
		(to) => {
			oneMismatch(kb(to));
		},
	);

	it.each(["days_between(due, 1)", 'days_between(rent, "2026-01-01")'])(
		"rejects %s",
		(to) => {
			oneMismatch(kb(to));
		},
	);

	it("accepts well-typed calls; days_between yields a number", () => {
		accepted("min(rent, qty) + max(1, 2) + round(rent / 3)");
		accepted('days_between(due, "2026-12-31") * 2');
	});
});

describe("if condition and branches (10.7)", () => {
	it("rejects a condition that is not boolean", () => {
		oneMismatch(kb("if(rent, 1, 2)"));
	});

	it("rejects branches of different types", () => {
		oneMismatch(kb("if(ok, 1, 'gold')"));
		oneMismatch(kb("if(ok, true, 2)", { set: "out_b" }));
	});

	it("accepts matching branches and takes their type", () => {
		accepted("if(ok, 1, rent)");
		accepted("if(ok, 'gold', 'silver')", "out_e");
	});
});

describe("to against the set fact (10.8, 10.9, 11.3)", () => {
	it("names the rule, fact, expected and found type", () => {
		const d = oneMismatch(kb("true", { set: "payable" }));
		expect(d.message).toBe(
			"Rule 'R-1' sets fact 'payable' which expects number, but 'to' has type boolean.",
		);
	});

	it("accepts a matching type for each fact type", () => {
		accepted("rent", "payable");
		accepted("qty", "out_n");
		accepted("ok", "out_b");
		accepted("due", "out_d");
		accepted("tier", "out_e");
	});

	it("accepts a number for a money fact and money for a number fact", () => {
		accepted("qty * 2", "payable");
		accepted("rent", "out_n");
	});

	it("rejects an enum, boolean or date expression for another type", () => {
		oneMismatch(kb("tier", { set: "out_b" }));
		oneMismatch(kb("ok", { set: "out_e" }));
		oneMismatch(kb("due", { set: "payable" }));
	});

	it("rejects a number assigned to a date fact", () => {
		const d = oneMismatch(kb("qty + 1", { set: "out_d" }));
		expect(d.message).toContain("expects date");
		expect(d.message).toContain("type number");
	});

	it("rejects a money expression assigned to a boolean fact", () => {
		const d = oneMismatch(kb("rent * 2", { set: "out_b" }));
		expect(d.message).toContain("expects boolean");
		expect(d.message).toContain("type number");
	});

	it("rejects a money expression assigned to a date or enum fact", () => {
		oneMismatch(kb("rent", { set: "out_d" }));
		oneMismatch(kb("rent", { set: "out_e" }));
	});
});

describe("when must be boolean (10.10)", () => {
	it("reports NOT_BOOLEAN naming the rule and the found type", () => {
		const diags = typeDiags(kb("rent", { when: "rent + 1" }));
		expect(diags.map((d) => d.code)).toEqual(["NOT_BOOLEAN"]);
		const d = diags[0] as Diagnostic;
		expect(d.id).toBe("R-1");
		expect(d.field).toBe("when");
		expect(d.message).toBe(
			"Rule 'R-1' field 'when' must be boolean but has type number.",
		);
	});

	it("reports NOT_BOOLEAN for an enum and a date", () => {
		expect(typeDiags(kb("rent", { when: "tier" })).map((d) => d.code)).toEqual([
			"NOT_BOOLEAN",
		]);
		expect(typeDiags(kb("rent", { when: "due" })).map((d) => d.code)).toEqual([
			"NOT_BOOLEAN",
		]);
	});

	it("accepts a boolean when", () => {
		accepted("rent", "payable", "ok and rent > 10");
	});

	it("reports a TYPE_MISMATCH inside when with field 'when', not NOT_BOOLEAN", () => {
		const d = oneMismatch(kb("rent", { when: "rent and ok" }), "when");
		expect(d.message).toContain("field 'when'");
	});
});

describe("no cascade (10.11)", () => {
	it("one inner mismatch gives one diagnostic, not one per enclosing node", () => {
		const diags = typeDiags(kb("min(rent + ok, 5) * 2 + 1"));
		expect(diags.map((d) => d.code)).toEqual(["TYPE_MISMATCH"]);
		expect(diags[0]?.message).toContain("rent + ok");
	});

	it("an inner mismatch hides the set-fact check and the when check", () => {
		expect(typeDiags(kb("ok + 1", { set: "out_b" })).length).toBe(1);
		expect(typeDiags(kb("rent", { when: "(ok + 1) and ok" })).length).toBe(1);
	});

	it("an unknown fact gives UNKNOWN_FACT only, with no TYPE_MISMATCH", () => {
		const all = validateText(kb("ghost + 1 > rent"), FILE).diagnostics;
		expect(all.filter((d) => TYPE_CODES.has(d.code))).toEqual([]);
		expect(all.map((d) => d.code)).toContain("UNKNOWN_FACT");
	});

	it("an unknown fact in a boolean position gives no NOT_BOOLEAN", () => {
		const all = validateText(kb("rent", { when: "ghost" }), FILE).diagnostics;
		expect(all.filter((d) => TYPE_CODES.has(d.code))).toEqual([]);
		expect(all.map((d) => d.code)).toContain("UNKNOWN_FACT");
	});

	it("still reports an independent mismatch beside an unknown fact", () => {
		const d = oneMismatch(kb("(ghost + 1) + (rent + ok)"));
		expect(d.message).toContain("rent + ok");
	});
});

describe("a well-typed knowledge base (10.12)", () => {
	it("gives no type diagnostic and no diagnostic at all", () => {
		const text = kb("if(ok and rent > 0, min(rent, round(qty)), 0)", {
			when: 'due < "2030-01-01"',
		});
		expect(validateText(text, FILE).diagnostics).toEqual([]);
	});
});
