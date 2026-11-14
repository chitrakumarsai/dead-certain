import { describe, expect, it } from "vitest";
import { validateText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";

const BOOLS = ["a", "b", "c", "d", "x", "y", "z"];

function boolFacts(): string {
	return BOOLS.map(
		(n) => `  ${n}:\n    type: boolean\n    ask: Is ${n} true?\n`,
	).join("");
}

interface RuleSpec {
	id: string;
	set: string;
	when?: string;
	to?: string;
}

function rulesYaml(rules: RuleSpec[]): string {
	return rules
		.map((r) => {
			const when =
				r.when === undefined ? "" : `    when: ${JSON.stringify(r.when)}\n`;
			return [
				`  - id: ${r.id}`,
				'    cite: "4.2"',
				`    set: ${r.set}`,
				`    to: ${JSON.stringify(r.to ?? "1")}`,
				"    because: Because.",
				when,
			].join("\n");
		})
		.join("\n");
}

/**
 * A knowledge base with number facts `m`, `n` and a derived fact `out`. A role fixes the
 * type of `out`: a check is boolean and a deduction is money.
 */
function kb(opts: { role?: string; rules: RuleSpec[] }): string {
	const outType =
		opts.role === "check"
			? "boolean"
			: opts.role === "deduction"
				? "money"
				: "number";
	const outTo = outType === "boolean" ? "true" : "1";
	const rules = opts.rules.map((r) =>
		r.set === "out" ? { ...r, to: outTo } : r,
	);
	const role = opts.role === undefined ? "" : `    role: ${opts.role}\n`;
	return [
		"id: demo",
		"goals: [payable]",
		"facts:",
		"  payable:\n    type: money\n    derived: true\n",
		boolFacts(),
		"  m:\n    type: number\n    ask: m?\n",
		"  n:\n    type: number\n    ask: n?\n",
		`  out:\n    type: ${outType}\n    derived: true\n${role}`,
		"rules:",
		rulesYaml(rules),
		"clauses:",
		'  "4.2":',
		"    title: Room",
		"    text: Room rent.",
	].join("\n");
}

const PAYABLE: RuleSpec = { id: "R-PAY", set: "payable" };

function run(rules: RuleSpec[], role?: string) {
	return validateText(kb({ role, rules: [PAYABLE, ...rules] }), FILE);
}

function codes(text: string, code: string) {
	return validateText(text, FILE).diagnostics.filter((d) => d.code === code);
}

describe("NO_FALLBACK_RULE", () => {
	const guarded: RuleSpec = { id: "R-1", set: "out", when: "a" };

	it("is raised for a deduction with only guarded rules", () => {
		const res = run([guarded], "deduction");
		const found = res.diagnostics.filter((d) => d.code === "NO_FALLBACK_RULE");
		expect(found).toHaveLength(1);
		expect(found[0]?.severity).toBe("warning");
		expect(found[0]?.id).toBe("out");
		expect(found[0]?.message).toContain("'out'");
		expect(found[0]?.message).toContain("Add an unguarded default rule.");
	});

	it("is raised for a deduction that no rule sets at all", () => {
		const res = run([], "deduction");
		expect(
			res.diagnostics.filter((d) => d.code === "NO_FALLBACK_RULE"),
		).toHaveLength(1);
	});

	it("is absent when an unguarded rule also sets the fact", () => {
		const res = run([guarded, { id: "R-2", set: "out" }], "deduction");
		expect(
			res.diagnostics.filter((d) => d.code === "NO_FALLBACK_RULE"),
		).toHaveLength(0);
	});

	it("is absent for a role: check fact", () => {
		const res = run([guarded], "check");
		expect(
			res.diagnostics.filter((d) => d.code === "NO_FALLBACK_RULE"),
		).toHaveLength(0);
	});

	it("is absent for a fact with no role", () => {
		const res = run([guarded]);
		expect(
			res.diagnostics.filter((d) => d.code === "NO_FALLBACK_RULE"),
		).toHaveLength(0);
	});

	it("leaves ok true when warnings are the only diagnostics", () => {
		const res = run([guarded], "deduction");
		expect(res.diagnostics.length).toBeGreaterThan(0);
		expect(res.diagnostics.every((d) => d.severity === "warning")).toBe(true);
		expect(res.ok).toBe(true);
	});
});

describe("DEAD_GUARD", () => {
	function dead(when: string) {
		return codes(
			kb({ rules: [PAYABLE, { id: "R-D", set: "out", when }] }),
			"DEAD_GUARD",
		);
	}

	const flagged = [
		"false",
		"x and not x",
		"not x and x",
		"(x and not x) and y and z",
		"a and (b and false) and c",
		// four-operand chain: dead operand at left, middle and right
		"false and b and c and d",
		"a and b and false and d",
		"a and b and c and false",
		"(a and not a) and b and c and d",
		"a and b and (c and not c) and d",
		"a and b and c and (d and not d)",
		"a and ((b and (c and false)) and d)",
	];

	for (const when of flagged) {
		it(`flags '${when}'`, () => {
			const found = dead(when);
			expect(found).toHaveLength(1);
			expect(found[0]?.severity).toBe("warning");
			expect(found[0]?.id).toBe("R-D");
			expect(found[0]?.message).toContain("'R-D'");
		});
	}

	const notFlagged = [
		"a and b and not a",
		"a < b",
		"false or x and not x",
		"a and b",
		"x or not x",
	];

	for (const when of notFlagged) {
		it(`does not flag '${when}'`, () => {
			// `a < b` compares numbers; use the number facts so the guard is valid.
			const guard = when === "a < b" ? "m < n" : when;
			expect(dead(guard)).toHaveLength(0);
		});
	}

	it("includes the printed guard in the message", () => {
		const found = dead("x and not x");
		expect(found[0]?.message).toContain("x and not x");
	});

	it("does not fail the run: a dead guard alone leaves ok true", () => {
		const res = validateText(
			kb({ rules: [PAYABLE, { id: "R-D", set: "out", when: "x and not x" }] }),
			FILE,
		);
		expect(res.diagnostics.some((d) => d.code === "DEAD_GUARD")).toBe(true);
		expect(res.ok).toBe(true);
	});
});
