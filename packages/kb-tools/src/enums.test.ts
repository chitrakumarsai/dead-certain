import { describe, expect, it } from "vitest";
import type { Diagnostic } from "./index";
import { validateText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";

const FACTS = `  payable:
    type: money
    derived: true
  ok:
    type: boolean
    ask: Is it ok?
  tier:
    type: enum
    ask: Which tier?
    options: [gold, silver]
  wide:
    type: enum
    ask: Which wide tier?
    options: [gold, silver, bronze]
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
		`    set: ${opts.set ?? "out_e"}`,
		`    to: ${JSON.stringify(to)}`,
		"    because: Because.",
		when,
		"clauses:",
		'  "4.2":',
		"    title: Room",
		"    text: Room rent.",
	].join("\n");
}

function enumDiags(text: string): Diagnostic[] {
	return validateText(text, FILE).diagnostics.filter(
		(d) => d.code === "ENUM_VALUE_NOT_IN_OPTIONS",
	);
}

describe("ENUM_VALUE_NOT_IN_OPTIONS", () => {
	it("prints the full options list in declaration order", () => {
		const text = kb("'bronze'").replace(
			"options: [gold, silver]\n    derived: true",
			"options: [silver, gold]\n    derived: true",
		);
		const found = enumDiags(text);
		expect(found).toHaveLength(1);
		expect(found[0]?.message).toBe(
			"Rule 'R-1' field 'to': 'bronze' is not an option of enum fact 'out_e' (options: silver, gold).",
		);
	});

	it("clips only the whole message, and only past 200 characters", () => {
		const long = "x".repeat(300);
		const found = enumDiags(kb(`'${long}'`));
		expect(found).toHaveLength(1);
		const message = found[0]?.message ?? "";
		expect(message.length).toBeLessThanOrEqual(201);
		expect(message.endsWith("…")).toBe(true);
	});

	it("flags a literal in `to` that is not an option of the set fact", () => {
		const found = enumDiags(kb("'bronze'"));
		expect(found).toHaveLength(1);
		expect(found[0]?.id).toBe("R-1");
		expect(found[0]?.message).toContain("'R-1'");
		expect(found[0]?.message).toContain("field 'to'");
		expect(found[0]?.message).toContain("'bronze'");
		expect(found[0]?.message).toContain("'out_e'");
	});

	it("flags a literal in an `if` branch", () => {
		const found = enumDiags(kb("if(ok, 'gold', 'bronze')"));
		expect(found).toHaveLength(1);
		expect(found[0]?.message).toContain("'bronze'");
	});

	it("does not check a literal in an `if` condition under the `to` rule", () => {
		// 'bronze' is not an option of out_e but is one of `wide`.
		expect(
			enumDiags(kb("if(wide == 'bronze', 'gold', 'silver')")),
		).toHaveLength(0);
	});

	it.each([
		["tier == 'bronze'"],
		["'bronze' == tier"],
		["tier != 'bronze'"],
		["'bronze' != tier"],
	])("flags %s in `when`", (when) => {
		const found = enumDiags(kb("'gold'", { when }));
		expect(found).toHaveLength(1);
		expect(found[0]?.message).toContain("field 'when'");
		expect(found[0]?.message).toContain("'bronze'");
		expect(found[0]?.message).toContain("'tier'");
	});

	it("flags a comparison literal inside `to`", () => {
		const found = enumDiags(kb("if(tier == 'bronze', 'gold', 'silver')"));
		expect(found).toHaveLength(1);
		expect(found[0]?.message).toContain("field 'to'");
		expect(found[0]?.message).toContain("'tier'");
	});

	it("gives no diagnostic when every literal is valid", () => {
		expect(
			enumDiags(
				kb("if(tier == 'gold', 'gold', 'silver')", {
					when: "tier != 'silver'",
				}),
			),
		).toHaveLength(0);
	});
});
