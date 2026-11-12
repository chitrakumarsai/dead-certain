import { describe, expect, it } from "vitest";
import { explain, next } from "./api";
import { EngineError } from "./errors";
import { parse } from "./lang/parse";
import type {
	Expr,
	FactValue,
	KnowledgeBase,
	ProofNode,
	Rule,
	Session,
} from "./types";

function expr(src: string): Expr {
	const r = parse(src);
	if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
	return r.expr;
}

function rule(id: string, set: string, to: string, when?: string): Rule {
	return {
		id,
		cite: `c-${id}`,
		set,
		to: expr(to),
		...(when === undefined ? {} : { when: expr(when) }),
		because: `because ${id}`,
	};
}

// ratio = if(a > 0, b / a, 0), where b = 10 / z is itself derived.
// With z answered 0, resolving b raises a division-by-zero EVALUATION_ERROR.
const kb: KnowledgeBase = {
	id: "skipped-branch",
	goals: ["ratio"],
	facts: {
		a: { type: "number", ask: "a?" },
		z: { type: "number", ask: "z?" },
		b: { type: "number", derived: true },
		ratio: { type: "number", derived: true },
	},
	rules: [
		rule("r-b", "b", "10 / z"),
		rule("r-ratio", "ratio", "if(a > 0, b / a, 0)"),
	],
	clauses: {
		"c-r-b": { id: "c-r-b", title: "B", text: "b" },
		"c-r-ratio": { id: "c-r-ratio", title: "Ratio", text: "ratio" },
	},
};

function session(answers: Record<string, FactValue>): Session {
	return { kb, answers };
}

function codeOf(fn: () => unknown): string {
	try {
		fn();
	} catch (e) {
		if (e instanceof EngineError) return e.code;
		throw e;
	}
	throw new Error("expected an EngineError");
}

function child(tree: ProofNode, name: string): ProofNode {
	const c = tree.children.find((n) => n.fact === name);
	if (c === undefined) throw new Error(`no child ${name}`);
	return c;
}

describe("explain with a Skipped_Branch", () => {
	it("returns a tree with a bare child when the skipped fact fails to resolve", () => {
		const s = session({ a: 0, z: 0 });
		expect(next(s).kind).toBe("verdict");

		const tree = explain(s, "ratio");
		expect(tree.value).toBe(0);
		expect(tree.rule).toBe("r-ratio");

		const b = child(tree, "b");
		expect(b.value).toBeUndefined();
		expect(b.children).toEqual([]);
		expect(b.source).toBe("derived");
		expect(b).not.toHaveProperty("rule");
		expect(b).not.toHaveProperty("clause");
		expect(b).not.toHaveProperty("because");
	});

	it("gives a full node when the skipped fact resolves without error", () => {
		const s = session({ a: 0, z: 2 });
		const tree = explain(s, "ratio");

		expect(tree.value).toBe(0);
		const b = child(tree, "b");
		expect(b.value).toBe(5);
		expect(b.source).toBe("derived");
		expect(b.rule).toBe("r-b");
		expect(b.clause).toBe("c-r-b");
		expect(b.because).toBe("because r-b");
		expect(b.children.map((c) => c.fact)).toEqual(["z"]);
	});
});

describe("explain throws the codes next throws", () => {
	it("EVALUATION_ERROR on an evaluated path", () => {
		const s = session({ a: 1, z: 0 });
		expect(codeOf(() => next(s))).toBe("EVALUATION_ERROR");
		expect(codeOf(() => explain(s, "ratio"))).toBe("EVALUATION_ERROR");
	});

	it("UNKNOWN_FACT for an answer naming a fact outside the knowledge base", () => {
		const s = session({ a: 1, nope: 3 });
		expect(codeOf(() => next(s))).toBe("UNKNOWN_FACT");
		expect(codeOf(() => explain(s, "ratio"))).toBe("UNKNOWN_FACT");
	});

	it("UNKNOWN_FACT for a fact name outside the knowledge base", () => {
		expect(codeOf(() => explain(session({}), "nope"))).toBe("UNKNOWN_FACT");
	});

	it("INVALID_ANSWER for an answer of the wrong type", () => {
		const s = session({ a: "x" as unknown as FactValue });
		expect(codeOf(() => next(s))).toBe("INVALID_ANSWER");
		expect(codeOf(() => explain(s, "ratio"))).toBe("INVALID_ANSWER");
	});
});
