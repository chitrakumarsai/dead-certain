import { describe, expect, it } from "vitest";
import { compileText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";

/** Input keys are deliberately written in a different order from the output. */
const FULL = `id: demo
goals: [out, flag]
currency: INR
facts:
  zeta:
    why: It matters.
    ask: How much?
    type: money
  alpha:
    type: number
    ask: How many?
  tier:
    options: [gold, silver]
    ask: Which tier?
    type: enum
  out:
    label: Out amount
    role: deduction
    derived: true
    type: money
  flag:
    derived: true
    type: boolean
rules:
  - because: Because one.
    when: "alpha > 1 and not (tier == 'gold')"
    to: "round(max(zeta, 0) * 2 - -alpha)"
    set: out
    cite: "4.2"
    id: R-1
  - because: Because two.
    to: "true"
    set: flag
    cite: "7.1"
    id: R-2
clauses:
  "7.1":
    text: Seven text.
    title: Seven
  "4.2":
    text: Room rent text.
    title: Room rent
`;

type Obj = Record<string, unknown>;

function ok(text: string) {
	const r = compileText(text, FILE);
	if (!r.ok) throw new Error(JSON.stringify(r.diagnostics));
	return r;
}

function keys(o: unknown): string[] {
	return Object.keys(o as Obj);
}

const EXPR_ORDER: Record<string, string[]> = {
	literal: ["kind", "type", "value"],
	fact: ["kind", "name"],
	unary: ["kind", "op", "operand"],
	binary: ["kind", "op", "left", "right"],
	call: ["kind", "fn", "args"],
};

/** Collect the key order of every Expr node, and the kinds seen. */
function checkExpr(e: unknown, seen: Set<string>): void {
	const o = e as Obj;
	const kind = o.kind as string;
	seen.add(kind);
	expect(keys(o)).toEqual(EXPR_ORDER[kind]);
	if (kind === "unary") checkExpr(o.operand, seen);
	if (kind === "binary") {
		checkExpr(o.left, seen);
		checkExpr(o.right, seen);
	}
	if (kind === "call") for (const a of o.args as unknown[]) checkExpr(a, seen);
}

describe("compileText key order", () => {
	const r = ok(FULL);
	const parsed = JSON.parse(r.json) as Obj;

	it("orders KnowledgeBase keys", () => {
		expect(keys(parsed)).toEqual([
			"id",
			"currency",
			"goals",
			"facts",
			"rules",
			"clauses",
		]);
		expect(keys(r.kb)).toEqual(keys(parsed));
	});

	it("orders FactDef keys and keeps facts in file order", () => {
		const facts = parsed.facts as Obj;
		expect(keys(facts)).toEqual(["zeta", "alpha", "tier", "out", "flag"]);
		expect(keys(facts.zeta)).toEqual(["type", "ask", "why"]);
		expect(keys(facts.tier)).toEqual(["type", "ask", "options"]);
		expect(keys(facts.out)).toEqual(["type", "derived", "role", "label"]);
	});

	it("orders Rule keys, with `when` between `to` and `because`", () => {
		const rules = parsed.rules as Obj[];
		expect(keys(rules[0])).toEqual([
			"id",
			"cite",
			"set",
			"to",
			"when",
			"because",
		]);
	});

	it("orders Clause keys and keeps clauses in file order", () => {
		const clauses = parsed.clauses as Obj;
		expect(keys(clauses)).toEqual(["7.1", "4.2"]);
		expect(keys(clauses["4.2"])).toEqual(["id", "title", "text"]);
	});

	it("orders the keys of every Expr kind", () => {
		const seen = new Set<string>();
		for (const rule of parsed.rules as Obj[]) {
			checkExpr(rule.to, seen);
			if (rule.when !== undefined) checkExpr(rule.when, seen);
		}
		expect([...seen].sort()).toEqual(
			["binary", "call", "fact", "literal", "unary"].sort(),
		);
	});
});

describe("compileText serialisation", () => {
	const r = ok(FULL);

	it("uses two-space indentation", () => {
		expect(r.json).toBe(`${JSON.stringify(JSON.parse(r.json), null, 2)}\n`);
		expect(r.json.split("\n")[1]).toBe('  "id": "demo",');
	});

	it("ends with exactly one line feed", () => {
		expect(r.json.endsWith("}\n")).toBe(true);
		expect(r.json.endsWith("\n\n")).toBe(false);
	});

	it("is deterministic and round-trips through JSON", () => {
		expect(ok(FULL).json).toBe(r.json);
		expect(JSON.parse(r.json)).toEqual(r.kb);
	});
});

describe("compileText optional fields", () => {
	it("omits `currency` and `when` when absent, and invents no `label`", () => {
		const text = FULL.replace("currency: INR\n", "").replace(
			/ {4}when: .*\n/,
			"",
		);
		const r = ok(text);
		expect("currency" in r.kb).toBe(false);
		expect(r.json).not.toContain('"currency"');
		expect(r.json).not.toContain('"when"');
		for (const rule of r.kb.rules) expect("when" in rule).toBe(false);
		// Only the one fact that supplied a label has one.
		expect(r.json.match(/"label"/g)).toHaveLength(1);
		expect(r.kb.facts.alpha && "label" in r.kb.facts.alpha).toBe(false);
	});

	it("keeps `currency` and `when` when present", () => {
		const r = ok(FULL);
		expect(r.kb.currency).toBe("INR");
		expect(r.kb.rules[0] && "when" in r.kb.rules[0]).toBe(true);
	});
});

describe("compileText identity and order", () => {
	it("sets each clause id from its key, including 4.2", () => {
		const r = ok(FULL);
		expect(r.kb.clauses["4.2"]?.id).toBe("4.2");
		expect(r.kb.clauses["7.1"]?.id).toBe("7.1");
		for (const [key, clause] of Object.entries(r.kb.clauses)) {
			expect(clause.id).toBe(key);
		}
	});

	it("keeps rules and goals in file order", () => {
		const r = ok(FULL);
		expect(r.kb.rules.map((x) => x.id)).toEqual(["R-1", "R-2"]);
		expect(r.kb.goals).toEqual(["out", "flag"]);
	});
});

describe("compileText failure", () => {
	it("has no kb and no json when the validator reports an error", () => {
		const r = compileText(FULL.replace("alpha > 1", "ghost > 1"), FILE);
		expect(r.ok).toBe(false);
		expect("kb" in r).toBe(false);
		expect("json" in r).toBe(false);
		expect(r.diagnostics.some((d) => d.severity === "error")).toBe(true);
	});

	it("returns no output for a 400-digit literal", () => {
		const digits = "9".repeat(400);
		const text = FULL.replace('"true"', `"${digits}"`).replace(
			"set: flag",
			"set: alpha",
		);
		const r = compileText(text, FILE);
		expect(r.ok).toBe(false);
		expect("kb" in r).toBe(false);
		expect("json" in r).toBe(false);
		expect(r.diagnostics.some((d) => d.code === "PARSE_ERROR")).toBe(true);
	});
});
