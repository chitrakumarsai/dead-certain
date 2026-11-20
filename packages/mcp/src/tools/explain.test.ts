import { describe, expect, it } from "vitest";
import type { ToolResult } from "../payload";
import {
	goldenScenario,
	realWorkspace,
	TOY_KB,
	workspaceOf,
} from "../testkit/workspaces";
import { consult } from "./consult";
import { explainFact, proofText } from "./explain";

interface Proof {
	fact: string;
	value: unknown;
	source: string;
	rule?: string;
	clause?: string;
	because?: string;
	children: Proof[];
}
interface Doc {
	fact: string;
	value: unknown;
	proof: Proof;
	text: string;
	clauses: Record<string, { title: string; text: string }>;
}
type Err = { error: { code: string } };
const doc = (r: ToolResult) => r.structuredContent as unknown as Doc;
const code = (r: ToolResult) =>
	(r.structuredContent as unknown as Err).error.code;

const { ws } = realWorkspace();
const g01 = goldenScenario("claim-check", "G-01");
const args = { kb: "claim-check/policy", answers: g01.facts };

function leaves(n: Proof): Proof[] {
	return n.children.length === 0 ? [n] : n.children.flatMap(leaves);
}

describe("explain on G-01", () => {
	it("explains payable: root value, answered leaves, clause text", () => {
		const r = explainFact(ws, { ...args, fact: "payable" });
		expect(r.isError).toBeUndefined();
		const d = doc(r);
		expect(Object.keys(d)).toEqual([
			"fact",
			"value",
			"proof",
			"text",
			"clauses",
		]);
		expect(d.fact).toBe("payable");
		expect(d.value).toBe(13_200_000);
		expect(d.proof.value).toBe(13_200_000);
		expect(d.proof.source).toBe("derived");
		for (const leaf of leaves(d.proof)) expect(leaf.source).toBe("answered");
		expect(Object.keys(d.proof)).toEqual(
			[
				"fact",
				"value",
				"source",
				"rule",
				"clause",
				"because",
				"children",
			].filter((k) => k in d.proof),
		);
		const cited = d.proof.clause as string;
		expect(d.clauses[cited]?.text.length).toBeGreaterThan(0);
		expect(d.clauses[cited]?.title.length).toBeGreaterThan(0);
	});

	it("explains a deduction fact", () => {
		const d = doc(explainFact(ws, { ...args, fact: "room_rent_deduction" }));
		expect(d.value).toBe(g01.lineItems.room_rent_deduction);
		expect(d.proof.fact).toBe("room_rent_deduction");
		expect(d.proof.rule).toBeDefined();
	});

	it("explains an askable fact as an answered leaf", () => {
		const d = doc(explainFact(ws, { ...args, fact: "age" }));
		expect(d.value).toBe(64);
		expect(d.proof.source).toBe("answered");
		expect(d.text).toBe("age = 64 [answered]\n");
	});

	it("agrees with consult on the goals", () => {
		const verdict = consult(ws, args).structuredContent as unknown as {
			goals: Record<string, unknown>;
		};
		for (const goal of Object.keys(verdict.goals)) {
			expect(doc(explainFact(ws, { ...args, fact: goal })).value).toEqual(
				verdict.goals[goal],
			);
		}
	});

	it("indents two spaces per depth, one node per line", () => {
		const d = doc(explainFact(ws, { ...args, fact: "payable" }));
		const lines = d.text.trimEnd().split("\n");
		expect(lines[0]).toMatch(
			/^payable = 13200000 \[derived\] by \S+ \(clause \S+\): .+/,
		);
		const depths: number[] = [];
		const walk = (n: Proof, depth: number) => {
			depths.push(depth);
			for (const c of n.children) walk(c, depth + 1);
		};
		walk(d.proof, 0);
		expect(lines.length).toBe(depths.length);
		lines.forEach((line, i) => {
			const indent = line.length - line.trimStart().length;
			expect(indent).toBe((depths[i] ?? 0) * 2);
		});
	});
});

describe("explain with unknown facts", () => {
	it("shows an unknown fact as null in proof and unknown in the text", () => {
		const d = doc(
			explainFact(ws, {
				kb: "claim-check/policy",
				answers: { age: 64 },
				fact: "payable",
			}),
		);
		expect(d.value).toBeNull();
		expect(d.proof.value).toBeNull();
		expect(d.text).toContain("= unknown");
		const unknownLeaf = leaves(d.proof).find((l) => l.value === null);
		expect(unknownLeaf).toBeDefined();
	});
});

describe("explain errors", () => {
	it("gives UNKNOWN_FACT for a name not in the knowledge base", () => {
		expect(code(explainFact(ws, { ...args, fact: "nope" }))).toBe(
			"UNKNOWN_FACT",
		);
	});
	it("gives UNKNOWN_KB, KB_INVALID, and the engine's answer errors", () => {
		expect(code(explainFact(ws, { kb: "zzz", fact: "payable" }))).toBe(
			"UNKNOWN_KB",
		);
		const bad = workspaceOf({
			"a/bad": TOY_KB.replace('cite: "4.2"', 'cite: "9.9"'),
		}).ws;
		expect(code(explainFact(bad, { kb: "a/bad", fact: "payable" }))).toBe(
			"KB_INVALID",
		);
		expect(
			code(
				explainFact(ws, {
					kb: "claim-check/policy",
					fact: "payable",
					answers: { age: "x" },
				}),
			),
		).toBe("INVALID_ANSWER");
	});
	it("gives LIMIT_EXCEEDED for a fact name over 100 characters", () => {
		expect(
			code(
				explainFact(ws, { kb: "claim-check/policy", fact: "x".repeat(101) }),
			),
		).toBe("LIMIT_EXCEEDED");
	});
	it("never throws on bad shapes", () => {
		for (const a of [
			undefined,
			null,
			[],
			{},
			{ kb: "claim-check/policy" },
			{ kb: "claim-check/policy", fact: 3 },
		]) {
			expect(explainFact(ws, a).isError).toBe(true);
		}
	});
});

describe("proofText", () => {
	it("prints a node with a rule in the by-form", () => {
		const text = proofText({
			fact: "a",
			value: 1,
			source: "derived",
			rule: "R-1",
			clause: "4.2",
			because: "since",
			children: [{ fact: "b", value: null, source: "answered", children: [] }],
		});
		expect(text).toBe(
			"a = 1 [derived] by R-1 (clause 4.2): since\n  b = unknown [answered]\n",
		);
	});
});
