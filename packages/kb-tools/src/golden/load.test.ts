import { describe, expect, it } from "vitest";
import { loadGolden, loadGoldenRaw } from "./load";

const FILE = "apps/demo/golden/main.yaml";

const EXAMPLE = `kb: claim-check
scenarios:
  - id: G-01
    title: Room rent over the limit
    mode: consult
    facts:
      sum_insured: 500000
      room_rent_per_day: 600000
    expect:
      goals:
        payable_amount: 14250000
        verdict: reduced
      line_items:
        room_rent_deduction: 3800000
      fires: [ROOM-01, ROOM-02]
  - id: G-02
    title: The first question
    facts: {}
    expect:
      ask: sum_insured
  - id: G-03
    title: Unknown until answered
    mode: audit
    facts:
      sum_insured: 500000
    expect:
      goals:
        payable_amount: null
      needed: [room_rent_per_day]
`;

const scenario = (extra: Record<string, unknown>) => ({
	id: "G-01",
	title: "t",
	facts: { a: 1 },
	expect: { goals: { x: 1 } },
	...extra,
});
const file = (...scenarios: unknown[]) => ({ kb: "demo", scenarios });

/** The diagnostics of a raw value that must fail, as [id, field, message]. */
function failures(value: unknown) {
	const result = loadGoldenRaw(value, FILE);
	expect(result.ok).toBe(false);
	return result.diagnostics.map((d) => {
		expect(d.code).toBe("SCHEMA_INVALID");
		expect(d.severity).toBe("error");
		expect(d.file).toBe(FILE);
		return [d.id, d.field, d.message];
	});
}

describe("loadGolden", () => {
	it("reads the example into a GoldenSet", () => {
		const result = loadGolden(EXAMPLE, FILE);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.set).toEqual({
			kb: "claim-check",
			scenarios: [
				{
					id: "G-01",
					title: "Room rent over the limit",
					mode: "consult",
					facts: { sum_insured: 500000, room_rent_per_day: 600000 },
					expect: {
						goals: { payable_amount: 14250000, verdict: "reduced" },
						lineItems: { room_rent_deduction: 3800000 },
						fires: ["ROOM-01", "ROOM-02"],
					},
				},
				{
					id: "G-02",
					title: "The first question",
					mode: "consult",
					facts: {},
					expect: { ask: "sum_insured" },
				},
				{
					id: "G-03",
					title: "Unknown until answered",
					mode: "audit",
					facts: { sum_insured: 500000 },
					expect: {
						goals: { payable_amount: null },
						needed: ["room_rent_per_day"],
					},
				},
			],
		});
	});

	it("defaults the mode to consult and keeps the facts key order", () => {
		const result = loadGolden(
			"kb: k\nscenarios:\n  - id: a\n    title: t\n    facts: { z: 1, a: 2, m: 3 }\n    expect: { goals: {} }\n",
			FILE,
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.set.scenarios[0]?.mode).toBe("consult");
		expect(Object.keys(result.set.scenarios[0]?.facts ?? {})).toEqual([
			"z",
			"a",
			"m",
		]);
	});

	it("reports invalid YAML as YAML_SYNTAX with a line", () => {
		const result = loadGolden("kb: [unclosed\n", FILE);

		expect(result.ok).toBe(false);
		expect(result.diagnostics[0]?.code).toBe("YAML_SYNTAX");
		expect(result.diagnostics[0]?.message).toContain("line 2");
	});

	it("names a golden file, not a knowledge base, when the file is empty", () => {
		const result = loadGolden("", FILE);

		expect(result.diagnostics[0]).toMatchObject({
			code: "SCHEMA_INVALID",
			message: `File '${FILE}' is empty. A golden file is a YAML mapping.`,
		});
	});

	it("turns a knowledge-base-only code from the YAML stage into SCHEMA_INVALID", () => {
		const result = loadGolden("facts:\n  a: 1\n  a: 2\n", FILE);

		expect(result.ok).toBe(false);
		expect(result.diagnostics.map((d) => d.code)).toEqual(["SCHEMA_INVALID"]);
	});

	it("returns no partial set on failure", () => {
		const result = loadGolden("kb: k\nscenarios: []\n", FILE);

		expect(result.ok).toBe(false);
		expect("set" in result).toBe(false);
	});
});

describe("loadGoldenRaw: each shape error, with its exact message", () => {
	it("a missing kb", () => {
		expect(failures({ scenarios: [scenario({})] })).toEqual([
			[undefined, "kb", "The top level is missing the required field 'kb'."],
		]);
	});

	it("an empty scenarios list", () => {
		expect(failures({ kb: "d", scenarios: [] })).toEqual([
			[
				undefined,
				"scenarios",
				"Field 'scenarios' must list at least one scenario.",
			],
		]);
	});

	it("scenarios that is not a list", () => {
		expect(failures({ kb: "d", scenarios: {} })).toEqual([
			[undefined, "scenarios", "Field 'scenarios' must be a list."],
		]);
	});

	it("a top level that is a list", () => {
		expect(failures([])).toEqual([
			[undefined, undefined, `The top level of '${FILE}' must be a mapping.`],
		]);
	});

	it("an unknown top-level field", () => {
		expect(failures({ ...file(scenario({})), extra: 1 })).toEqual([
			[
				undefined,
				"extra",
				"Unknown field 'extra' in the top level. Allowed fields: kb, scenarios.",
			],
		]);
	});

	it("an unknown scenario field", () => {
		expect(failures(file(scenario({ colour: 1 })))).toEqual([
			[
				"G-01",
				"colour",
				"Unknown field 'colour' in scenario 'G-01'. Allowed fields: id, title, mode, facts, expect.",
			],
		]);
	});

	it("an unknown expect field", () => {
		expect(
			failures(file(scenario({ expect: { goals: {}, bogus: 1 } }))),
		).toEqual([
			[
				"G-01",
				"bogus",
				"Unknown field 'bogus' in expect of scenario 'G-01'. Allowed fields: ask, goals, line_items, needed, fires.",
			],
		]);
	});

	it("a bad mode", () => {
		expect(failures(file(scenario({ mode: "x" })))).toEqual([
			[
				"G-01",
				"mode",
				"Field 'mode' of scenario 'G-01' must be consult or audit. Found 'x'.",
			],
		]);
	});

	it.each(["-x", "a b", "_a", ""])("a bad id %j", (id) => {
		const [diag] = failures(file(scenario({ id })));

		expect(diag?.[2]).toBe(
			`Scenario id '${id}' must start with a letter or a digit and use only letters, digits, '_' and '-'.`,
		);
	});

	it("an empty and a missing and a non-string title", () => {
		expect(failures(file(scenario({ title: "" })))).toEqual([
			["G-01", "title", "Field 'title' of scenario 'G-01' must not be empty."],
		]);
		expect(
			failures(file({ id: "G-01", facts: {}, expect: { goals: {} } })),
		).toEqual([
			[
				"G-01",
				"title",
				"Scenario 'G-01' is missing the required field 'title'.",
			],
		]);
		expect(failures(file(scenario({ title: 5 })))).toEqual([
			["G-01", "title", "Field 'title' of scenario 'G-01' must be a string."],
		]);
	});

	it("needed in a consult scenario, ask in an audit scenario", () => {
		expect(
			failures(file(scenario({ expect: { goals: {}, needed: [] } }))),
		).toEqual([
			[
				"G-01",
				"expect",
				"Field 'expect.needed' of scenario 'G-01' is for audit scenarios, and this one is consult.",
			],
		]);
		expect(
			failures(file(scenario({ mode: "audit", expect: { ask: "a" } }))),
		).toEqual([
			[
				"G-01",
				"expect",
				"Field 'expect.ask' of scenario 'G-01' is for consult scenarios, and this one is audit.",
			],
		]);
	});

	it("ask beside another expect field", () => {
		expect(
			failures(file(scenario({ expect: { ask: "a", goals: {} } }))),
		).toEqual([
			[
				"G-01",
				"expect",
				"Field 'expect.goals' of scenario 'G-01' cannot be given with 'expect.ask', which must be the only field of expect.",
			],
		]);
	});

	it("an expect with neither goals nor ask", () => {
		expect(failures(file(scenario({ expect: {} })))).toEqual([
			[
				"G-01",
				"expect",
				"Scenario 'G-01' is missing the required field 'expect.goals'. Give it, or give expect.ask alone.",
			],
		]);
	});

	it("a list where a mapping belongs", () => {
		expect(failures(file(scenario({ facts: [] })))).toEqual([
			["G-01", "facts", "Field 'facts' of scenario 'G-01' must be a mapping."],
		]);
	});

	it.each([
		[[1], "[1]"],
		[Number.POSITIVE_INFINITY, "Infinity"],
		[Number.NaN, "NaN"],
		[1n, "1n"],
	])("a fact value that is not a scalar: %s", (value, shown) => {
		expect(failures(file(scenario({ facts: { a: value } })))).toEqual([
			[
				"G-01",
				"facts",
				`Field 'facts.a' of scenario 'G-01' must be a boolean, a finite number, a string or null. Found '${shown}'.`,
			],
		]);
	});

	it("lets null through in facts, goals and line items for the checker to judge", () => {
		const result = loadGoldenRaw(
			file(
				scenario({
					facts: { a: null },
					expect: { goals: { x: null }, line_items: { y: null } },
				}),
			),
			FILE,
		);

		expect(result.ok).toBe(true);
	});

	it("names a scenario by position when its id is unreadable", () => {
		const messages = failures(
			file(scenario({}), { title: 5, facts: {}, expect: { goals: {} } }),
		).map((d) => d[2]);

		expect(messages).toEqual([
			"Scenario '#2' is missing the required field 'id'.",
			"Field 'title' of scenario '#2' must be a string.",
		]);
	});
});
