import type { KnowledgeBase } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { EXTRACTORS } from "../collectors/extractors";
import { preflightKb } from "../collectors/testing/kb";
import { CHECKLIST, GOAL, validateChecklists } from "./checklists";
import { compiledKb } from "./kb";
import { isKnowledgeBase } from "./kbShape";

const kb = preflightKb();
const withGroups = (groups: typeof CHECKLIST.groups) => ({
	...CHECKLIST,
	groups,
});

describe("the knowledge-base guard", () => {
	it("accepts the compiled knowledge base", () => {
		expect(isKnowledgeBase(compiledKb)).toBe(true);
	});

	it("rejects one without goals", () => {
		const { goals: _, ...rest } = kb;
		expect(isKnowledgeBase(rest)).toBe(false);
	});
});

describe("validateChecklists", () => {
	it("accepts the real knowledge base and checklist", () => {
		expect(validateChecklists(kb)).toEqual({ ok: true });
	});

	it("rejects a check listed in no group", () => {
		const [first, ...rest] = CHECKLIST.groups;
		if (first === undefined) throw new Error("no group");
		const r = validateChecklists(
			kb,
			withGroups([{ ...first, checks: first.checks.slice(1) }, ...rest]),
		);
		expect(r).toEqual({ ok: false, problem: "repo_public is in no group" });
	});

	it("rejects a check listed twice", () => {
		const r = validateChecklists(
			kb,
			withGroups([
				...CHECKLIST.groups,
				{
					title: "Again",
					checks: [{ fact: "repo_public", severity: "blocker" }],
				},
			]),
		);
		expect(r).toEqual({ ok: false, problem: "repo_public is listed twice" });
	});

	it("rejects an unknown fact, and a fact that is not a check", () => {
		for (const fact of ["no_such_fact", "repo_private"]) {
			const r = validateChecklists(
				kb,
				withGroups([
					...CHECKLIST.groups,
					{ title: "Extra", checks: [{ fact, severity: "warning" }] },
				]),
			);
			expect(r).toEqual({
				ok: false,
				problem: `${fact} is not a check of the knowledge base`,
			});
		}
	});

	it("rejects a knowledge base with no goal, two goals or another goal", () => {
		for (const goals of [[], [GOAL, "other"], ["other"]]) {
			const r = validateChecklists({ ...kb, goals } as KnowledgeBase);
			expect(r.ok, goals.join(",")).toBe(false);
		}
	});

	it("rejects a goal without exactly the values ready and not_ready", () => {
		const facts = {
			...kb.facts,
			[GOAL]: {
				...kb.facts[GOAL],
				type: "enum" as const,
				options: ["ready", "maybe"],
			},
		};
		expect(validateChecklists({ ...kb, facts }).ok).toBe(false);
	});
});

describe("facts the app reads or asks", () => {
	const nonDerived = Object.entries(kb.facts).filter(
		([, d]) => d.derived !== true,
	);

	it("gives every non-derived fact an extractor or a non-empty ask", () => {
		for (const [fact, def] of nonDerived)
			expect(
				Object.hasOwn(EXTRACTORS, fact) || (def.ask ?? "").trim() !== "",
				fact,
			).toBe(true);
	});

	it("has extractors only for non-derived facts of the knowledge base", () => {
		const names = new Set(nonDerived.map(([f]) => f));
		for (const fact of Object.keys(EXTRACTORS))
			expect(names.has(fact), fact).toBe(true);
	});

	it("collects every non-derived fact but the demo video length", () => {
		expect(
			nonDerived.map(([f]) => f).filter((f) => !Object.hasOwn(EXTRACTORS, f)),
		).toEqual(["demo_video_seconds"]);
	});
});
