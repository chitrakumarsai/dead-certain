import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText } from "./index";
import { faultArb, kbArb, renderYaml } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

type Obj = Record<string, unknown>;

const KB_ORDER = ["id", "currency", "goals", "facts", "rules", "clauses"];
const FACT_ORDER = [
	"type",
	"ask",
	"why",
	"derived",
	"options",
	"role",
	"label",
];
const RULE_ORDER = ["id", "cite", "set", "to", "when", "because"];
const CLAUSE_ORDER = ["id", "title", "text"];
const EXPR_ORDER: Record<string, string[]> = {
	literal: ["kind", "type", "value"],
	fact: ["kind", "name"],
	unary: ["kind", "op", "operand"],
	binary: ["kind", "op", "left", "right"],
	call: ["kind", "fn", "args"],
};

/** Keys must appear as a subsequence of the table order (absent optionals are omitted). */
function expectOrdered(actual: string[], order: readonly string[]): void {
	const indexes = actual.map((k) => order.indexOf(k));
	expect(indexes.every((i) => i >= 0)).toBe(true);
	expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
}

function checkExpr(e: unknown): void {
	const o = e as Obj;
	const kind = o.kind as string;
	expect(Object.keys(o)).toEqual(EXPR_ORDER[kind]);
	if (kind === "unary") checkExpr(o.operand);
	if (kind === "binary") {
		checkExpr(o.left);
		checkExpr(o.right);
	}
	if (kind === "call") for (const a of o.args as unknown[]) checkExpr(a);
}

/** Key order of the parsed JSON; maps are skipped as to their own key order. */
function checkKeyOrder(parsed: Obj): void {
	expectOrdered(Object.keys(parsed), KB_ORDER);
	for (const f of Object.values(parsed.facts as Obj))
		expectOrdered(Object.keys(f as Obj), FACT_ORDER);
	for (const r of parsed.rules as Obj[]) {
		expectOrdered(Object.keys(r), RULE_ORDER);
		checkExpr(r.to);
		if ("when" in r) checkExpr(r.when);
	}
	for (const c of Object.values(parsed.clauses as Obj))
		expectOrdered(Object.keys(c as Obj), CLAUSE_ORDER);
}

describe("Property 5: compiled output is deterministic and round-trips through JSON", () => {
	/** **Validates: Requirements 15.6, 15.7, 15.9, 15.10** */
	it("compiles to byte-identical, well-formed JSON that round-trips", () => {
		fc.assert(
			fc.property(kbArb, (k) => {
				const text = renderYaml(k);
				const a = compileText(text, FILE);
				const b = compileText(text, FILE);
				expect(a.ok).toBe(true);
				expect(b.ok).toBe(true);
				if (!a.ok || !b.ok) return;
				expect(a.json).toBe(b.json);
				expect(JSON.parse(a.json)).toEqual(a.kb);

				// Exactly one trailing line feed.
				expect(a.json.endsWith("\n")).toBe(true);
				expect(a.json.endsWith("\n\n")).toBe(false);
				// Two-space indentation: this is exactly JSON.stringify's two-space layout.
				expect(a.json).toBe(`${JSON.stringify(a.kb, null, 2)}\n`);
				for (const line of a.json.split("\n")) {
					const lead = line.length - line.trimStart().length;
					expect(lead % 2).toBe(0);
					expect(line.startsWith("\t")).toBe(false);
				}
				// No absolute path.
				expect(a.json).not.toContain(FILE);
				expect(a.json).not.toMatch(/(^|[\s"])\/(Users|home|tmp|var)\//);
				expect(a.json).not.toMatch(/[A-Za-z]:\\/);

				checkKeyOrder(JSON.parse(a.json) as Obj);
			}),
			{ numRuns: 200 },
		);
	}, 60_000);

	/** **Validates: Requirements 15.12** */
	it("a failed compile has no kb and no json", () => {
		fc.assert(
			fc.property(
				kbArb.chain((k) => faultArb(k, "all")),
				(fault) => {
					const r = compileText(fault.text, FILE);
					expect(r.ok).toBe(false);
					expect("kb" in r).toBe(false);
					expect("json" in r).toBe(false);
				},
			),
			{ numRuns: 100 },
		);
	}, 60_000);
});
