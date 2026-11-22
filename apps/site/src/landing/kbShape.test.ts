// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import { compileText } from "@dead-certain/kb-tools";
import { describe, expect, it } from "vitest";
import { isKnowledgeBase } from "./kbShape";

const yaml = readFileSync(
	new URL("../../../claim-check/kb/policy.yaml", import.meta.url),
	"utf8",
) as string;
const compiled = compileText(yaml, "policy.yaml");
if (!compiled.ok)
	throw new Error("apps/claim-check/kb/policy.yaml does not compile");
const kb = JSON.parse(compiled.json) as Record<string, unknown>;

describe("isKnowledgeBase", () => {
	it("accepts the compiled Claim Check knowledge base", () => {
		expect(isKnowledgeBase(kb)).toBe(true);
	});

	it.each([
		["null", null],
		["an array", []],
		["no goals", { ...kb, goals: [] }],
		["a fact of unknown type", { ...kb, facts: { x: { type: "text" } } }],
		[
			"a rule with no cite",
			{ ...kb, rules: [{ id: "R", set: "x", to: {}, because: "" }] },
		],
		[
			"a clause with no text",
			{ ...kb, clauses: { "1": { id: "1", title: "T" } } },
		],
	])("rejects %s", (_name, value) => {
		expect(isKnowledgeBase(value)).toBe(false);
	});
});
