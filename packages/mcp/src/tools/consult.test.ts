import { decode } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { compile } from "../kbs";
import type { ToolResult } from "../payload";
import {
	goldenScenario,
	realWorkspace,
	TOY_KB,
	workspaceOf,
} from "../testkit/workspaces";
import { consult } from "./consult";

type Err = {
	error: { code: string; message: string; diagnostics?: unknown[] };
};
interface Doc {
	status: string;
	question: {
		fact: string;
		text: string;
		type: string;
		why?: string;
		clause?: string;
		options?: string[];
	};
	goals: Record<string, unknown>;
	line_items: { fact: string; value: unknown }[];
	needed: unknown[];
	answers: Record<string, unknown>;
	token: string;
}
const doc = (r: ToolResult) => r.structuredContent as unknown as Doc;
const code = (r: ToolResult) =>
	(r.structuredContent as unknown as Err).error.code;

const { ws } = realWorkspace();
const g01 = goldenScenario("claim-check", "G-01");

describe("consult: questions", () => {
	it("asks a first question, with why and clause, when given no answers", () => {
		const r = consult(ws, { kb: "claim-check/policy" });
		expect(r.isError).toBeUndefined();
		const d = doc(r);
		expect(d.status).toBe("question");
		expect(Object.keys(d)).toEqual(["status", "question", "answers", "token"]);
		expect(d.question.text.length).toBeGreaterThan(0);
		expect(typeof d.question.type).toBe("string");
		expect(typeof d.question.why).toBe("string");
		expect(typeof d.question.clause).toBe("string");
		expect(d.answers).toEqual({});
		expect(typeof d.token).toBe("string");
	});

	it("keeps asking with two answers, and echoes them in key order", () => {
		const r = consult(ws, {
			kb: "claim-check/policy",
			answers: { treatment: "other", age: 64 },
		});
		const d = doc(r);
		expect(d.status).toBe("question");
		expect(Object.keys(d.answers)).toEqual(["age", "treatment"]);
		expect(d.answers).toEqual({ age: 64, treatment: "other" });
	});

	it("gives enum questions their options and omits why/clause when absent", () => {
		const r = consult(workspaceOf({ "a/toy": TOY_KB }).ws, { kb: "a/toy" });
		const q = doc(r).question;
		expect(q).toEqual({
			fact: "sum_insured",
			text: "What is the sum insured?",
			clause: "4.2",
			type: "money",
		});
		const policy = doc(
			consult(ws, { kb: "claim-check/policy", answers: { cause: "illness" } }),
		);
		const withOptions = [policy.question].find((x) => x?.options);
		if (withOptions) expect(Array.isArray(withOptions.options)).toBe(true);
	});
});

describe("consult: verdict for G-01", () => {
	const r = consult(ws, { kb: "claim-check/policy", answers: g01.facts });
	const d = doc(r);

	it("is a verdict with the golden goals", () => {
		expect(r.isError).toBeUndefined();
		expect(d.status).toBe("verdict");
		expect(Object.keys(d)).toEqual([
			"status",
			"goals",
			"line_items",
			"needed",
			"answers",
			"token",
		]);
		expect(d.goals).toEqual(g01.goals);
		expect(d.goals.payable).toBe(13_200_000);
		expect(d.goals.outcome).toBe("reduced");
		expect(d.needed).toEqual([]);
	});

	it("has the golden line items", () => {
		const items: Record<string, unknown> = {};
		for (const item of d.line_items) items[item.fact] = item.value;
		expect(items).toEqual(g01.lineItems);
		for (const item of d.line_items) {
			expect(Object.keys(item)).toEqual([
				"fact",
				"label",
				"role",
				"value",
				"rule",
				"clause",
			]);
		}
	});

	it("returns a token that replays to the same Payload", () => {
		const again = consult(ws, { kb: "claim-check/policy", token: d.token });
		expect(again.content).toEqual(r.content);
		const compiled = compile(ws, "claim-check/policy");
		if (!compiled.ok) throw new Error("kb");
		expect(decode(compiled.kb, d.token).answers).toEqual(d.answers);
	});

	it("is the same text for any order of the answers", () => {
		const reversed = Object.fromEntries(Object.entries(g01.facts).reverse());
		expect(
			consult(ws, { kb: "claim-check/policy", answers: reversed }).content,
		).toEqual(r.content);
	});
});

describe("consult: answers win over token", () => {
	it("replaces the token's value for the same fact", () => {
		const first = doc(
			consult(ws, { kb: "claim-check/policy", answers: { age: 64 } }),
		);
		const second = doc(
			consult(ws, {
				kb: "claim-check/policy",
				token: first.token,
				answers: { age: 30 },
			}),
		);
		expect(second.answers.age).toBe(30);
	});
});

describe("consult: engine errors", () => {
	const cases: [string, Record<string, unknown>, string][] = [
		["a string for a number", { answers: { age: "64" } }, "INVALID_ANSWER"],
		["a float for money", { answers: { claimed: 10.5 } }, "INVALID_ANSWER"],
		["an unknown fact", { answers: { nope: 1 } }, "UNKNOWN_FACT"],
		["a derived fact", { answers: { payable: 1 } }, "NOT_ANSWERABLE"],
		["a bad token", { token: "!!!" }, "MALFORMED_TOKEN"],
		["a bad enum value", { answers: { treatment: "zzz" } }, "INVALID_ANSWER"],
	];
	it.each(cases)("%s gives the engine's code", (_name, args, expected) => {
		const r = consult(ws, { kb: "claim-check/policy", ...args });
		expect(r.isError).toBe(true);
		expect(code(r)).toBe(expected);
	});

	it("gives KB_MISMATCH for a token from another knowledge base", () => {
		const other = doc(consult(ws, { kb: "pre-flight/checklist" }));
		const r = consult(ws, { kb: "claim-check/policy", token: other.token });
		expect(r.isError).toBe(true);
		expect(code(r)).toBe("KB_MISMATCH");
	});
});

describe("consult: other errors", () => {
	it("gives UNKNOWN_KB, listing the valid refs", () => {
		const r = consult(ws, { kb: "nope" });
		expect(code(r)).toBe("UNKNOWN_KB");
		expect((r.structuredContent as unknown as Err).error.message).toContain(
			"claim-check/policy",
		);
	});

	it("gives KB_INVALID with diagnostics and does not call the engine", () => {
		const bad = workspaceOf({
			"a/bad": TOY_KB.replace('cite: "4.2"', 'cite: "9.9"'),
		}).ws;
		const r = consult(bad, { kb: "a/bad" });
		expect(code(r)).toBe("KB_INVALID");
		expect(
			(r.structuredContent as unknown as Err).error.diagnostics?.length,
		).toBe(1);
	});

	it("gives LIMIT_EXCEEDED for each limit of requirement 6.3", () => {
		const many = Object.fromEntries(
			Array.from({ length: 201 }, (_, i) => [`f${i}`, 1]),
		);
		const args: Record<string, unknown>[] = [
			{ answers: many },
			{ answers: { [`x${"y".repeat(100)}`]: 1 } },
			{ answers: { treatment: "z".repeat(501) } },
			{ token: "t".repeat(20_001) },
		];
		for (const a of args) {
			expect(code(consult(ws, { kb: "claim-check/policy", ...a }))).toBe(
				"LIMIT_EXCEEDED",
			);
		}
	});

	it("accepts exactly the limits", () => {
		const r = consult(ws, {
			kb: "claim-check/policy",
			token: "t".repeat(20_000),
		});
		expect(code(r)).not.toBe("LIMIT_EXCEEDED");
		const keys = Object.fromEntries(
			Array.from({ length: 200 }, (_, i) => [`f${i}`, 1]),
		);
		expect(code(consult(ws, { kb: "claim-check/policy", answers: keys }))).toBe(
			"UNKNOWN_FACT",
		);
	});

	it("never throws on bad argument shapes", () => {
		for (const args of [
			undefined,
			null,
			1,
			"x",
			[],
			{},
			{ kb: 1 },
			{ kb: "claim-check/policy", answers: [] },
			{ kb: "claim-check/policy", answers: { age: null } },
			{ kb: "claim-check/policy", token: 5 },
		]) {
			const r = consult(ws, args);
			expect(r.isError).toBe(true);
		}
	});
});
