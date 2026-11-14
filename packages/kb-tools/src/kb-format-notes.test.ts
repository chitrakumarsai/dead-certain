import { describe, expect, it } from "vitest";
import { validateText } from "./index";

// The four notes at the end of docs/kb-format.md.

const FILE = "apps/demo/kb/demo.yaml";

interface Opts {
	label?: string;
	rules?: string;
	cite?: string;
	to?: string;
	role?: string;
	extraRules?: string;
}

function kb(o: Opts = {}): string {
	return `id: demo
goals: [payable]
facts:
  rent:
    type: money
    ask: What is the rent?
  ok:
    type: boolean
    ask: Is it ok?
  payable:
    type: money
    derived: true
${o.role === undefined ? "" : `    role: ${o.role}\n`}${o.label === undefined ? "" : `    label: ${o.label}\n`}rules:
  - id: R-1
    cite: "${o.cite ?? "4.2"}"
    set: payable
    to: "${o.to ?? "round(rent)"}"
    when: ok
    because: Because.
${o.extraRules ?? ""}clauses:
  "4.2":
    title: Room
    text: Room rent.
`;
}

const FALLBACK = `  - id: R-2
    cite: "4.2"
    set: payable
    to: "0"
    because: Otherwise nothing.
`;

function validate(text: string) {
	return validateText(text, FILE).diagnostics;
}

describe("kb-format notes", () => {
	it("note 1: a fact may carry an optional label", () => {
		expect(
			validate(kb({ label: "Payable amount", extraRules: FALLBACK })),
		).toEqual([]);
	});

	it("note 2: a deduction fact with no unguarded fallback raises NO_FALLBACK_RULE", () => {
		const bad = validate(kb({ role: "deduction" }));
		expect(bad.map((d) => d.code)).toEqual(["NO_FALLBACK_RULE"]);
		expect(bad[0]?.severity).toBe("warning");
		const good = validate(kb({ role: "deduction", extraRules: FALLBACK }));
		expect(good).toEqual([]);
	});

	it("note 3: a money rule without an explicit round raises MONEY_NOT_ROUNDED", () => {
		const bad = validate(kb({ to: "rent * 0.01", extraRules: FALLBACK }));
		expect(bad.map((d) => d.code)).toEqual(["MONEY_NOT_ROUNDED"]);
		expect(bad[0]?.severity).toBe("error");
		const good = validate(
			kb({ to: "round(rent * 0.01)", extraRules: FALLBACK }),
		);
		expect(good).toEqual([]);
	});

	it("note 4: a cite that names no clause raises UNKNOWN_CLAUSE", () => {
		const bad = validate(kb({ cite: "9.9", extraRules: FALLBACK }));
		expect(bad.map((d) => d.code)).toEqual(["UNKNOWN_CLAUSE"]);
		expect(bad[0]?.severity).toBe("error");
		expect(validate(kb({ extraRules: FALLBACK }))).toEqual([]);
	});
});
