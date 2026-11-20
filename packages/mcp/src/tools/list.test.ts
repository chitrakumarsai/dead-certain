import { describe, expect, it } from "vitest";
import type { ToolResult } from "../payload";
import { realKb, TOY_KB, workspaceOf } from "../testkit/workspaces";
import { listKbs } from "./list";

const body = (r: ToolResult) =>
	r.structuredContent as unknown as { kbs: Record<string, unknown>[] };

describe("list_kbs", () => {
	it("lists the real knowledge bases with their goals", () => {
		const { ws } = workspaceOf({
			"pre-flight/checklist": realKb("pre-flight/checklist"),
			"claim-check/policy": realKb("claim-check/policy"),
		});
		const r = listKbs(ws);
		expect(r.isError).toBeUndefined();
		const kbs = body(r).kbs;
		expect(kbs.map((k) => k.ref)).toEqual([
			"claim-check/policy",
			"pre-flight/checklist",
		]);
		const policy = kbs[0] as Record<string, unknown>;
		expect(policy).toMatchObject({
			path: "apps/claim-check/kb/policy.yaml",
			currency: "INR",
			ok: true,
		});
		expect(policy.goals).toContain("payable");
		expect(policy.goals).toContain("outcome");
		const flight = kbs[1] as Record<string, unknown>;
		expect(flight.ok).toBe(true);
		expect((flight.goals as string[]).length).toBeGreaterThan(0);
	});

	it("counts facts, askable facts, rules and clauses, keys in a fixed order", () => {
		const { ws } = workspaceOf({ "a/toy": TOY_KB });
		const entry = body(listKbs(ws)).kbs[0] as Record<string, unknown>;
		expect(entry).toEqual({
			ref: "a/toy",
			path: "apps/a/kb/toy.yaml",
			id: "toy-money",
			currency: "INR",
			goals: ["payable"],
			facts: 2,
			askable: 1,
			rules: 1,
			clauses: 1,
			ok: true,
		});
		expect(Object.keys(entry)).toEqual([
			"ref",
			"path",
			"id",
			"currency",
			"goals",
			"facts",
			"askable",
			"rules",
			"clauses",
			"ok",
		]);
	});

	it("gives currency null when the knowledge base has none", () => {
		const { ws } = workspaceOf({
			"a/toy": TOY_KB.replace("currency: INR\n", "").replace(
				"type: money",
				"type: number",
			),
		});
		const entry = body(listKbs(ws)).kbs[0] as Record<string, unknown>;
		expect(entry.currency).toBeNull();
	});

	it("reports a broken file as ok: false with its error count, without failing", () => {
		const { ws } = workspaceOf({
			"a/bad": TOY_KB.replace('cite: "4.2"', 'cite: "9.9"'),
			"a/toy": TOY_KB,
		});
		const r = listKbs(ws);
		expect(r.isError).toBeUndefined();
		const kbs = body(r).kbs;
		expect(kbs[0]).toEqual({
			ref: "a/bad",
			path: "apps/a/kb/bad.yaml",
			ok: false,
			errors: 1,
		});
		expect(kbs[1]?.ok).toBe(true);
	});

	it("gives an empty list for an empty workspace", () => {
		const { ws } = workspaceOf({});
		expect(listKbs(ws).structuredContent).toEqual({ kbs: [] });
	});

	it("gives NO_WORKSPACE without a root", () => {
		const { ws } = workspaceOf({});
		const r = listKbs({ ...ws, root: () => undefined });
		expect(r.isError).toBe(true);
		expect(
			(r.structuredContent as unknown as { error: { code: string } }).error
				.code,
		).toBe("NO_WORKSPACE");
	});
});
