import { describe, expect, it } from "vitest";
import { compile, resolve } from "./kbs";
import { MAX_KB_BYTES } from "./limits";
import type { ToolResult } from "./payload";
import { TOY_KB, workspaceOf } from "./testkit/workspaces";

type ErrorBody = {
	error: { code: string; message: string; diagnostics?: unknown[] };
};
const errorOf = (r: ToolResult) =>
	(r.structuredContent as unknown as ErrorBody).error;

describe("resolve", () => {
	it("returns the discovered file for a known ref", () => {
		const { ws } = workspaceOf({ "a/toy": TOY_KB });
		expect(resolve(ws, "a/toy")).toEqual({
			ok: true,
			file: { ref: "a/toy", path: "apps/a/kb/toy.yaml" },
		});
	});

	it("gives UNKNOWN_KB listing the valid refs", () => {
		const { ws } = workspaceOf({ "a/one": TOY_KB, "b/two": TOY_KB });
		const r = resolve(ws, "nope");
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(errorOf(r.error).code).toBe("UNKNOWN_KB");
		expect(errorOf(r.error).message).toContain("a/one");
		expect(errorOf(r.error).message).toContain("b/two");
	});

	it("gives NO_WORKSPACE with no pnpm-workspace.yaml", () => {
		const { ws } = workspaceOf({});
		// Same host, marker removed.
		const bare = { ...ws, root: () => undefined, listKbFiles: () => [] };
		const r = resolve(bare, "a/toy");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(errorOf(r.error).code).toBe("NO_WORKSPACE");
	});

	it.each([
		"../../etc/passwd",
		"claim-check/../pre-flight/checklist",
		"",
		"/etc/passwd",
		"a/toy.yaml",
	])("refuses %j and reads no file", (ref) => {
		const { ws, host } = workspaceOf({
			"a/toy": TOY_KB,
			"pre-flight/checklist": TOY_KB,
		});
		const r = resolve(ws, ref);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(errorOf(r.error).code).toBe("UNKNOWN_KB");
		expect(host.reads).toEqual([]);
	});
});

describe("compile", () => {
	it("compiles a valid knowledge base", () => {
		const { ws } = workspaceOf({ "a/toy": TOY_KB });
		const r = compile(ws, "a/toy");
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.kb.id).toBe("toy-money");
			expect(r.file.path).toBe("apps/a/kb/toy.yaml");
		}
	});

	it("gives KB_INVALID with the error diagnostics for a faulty file", () => {
		const { ws } = workspaceOf({
			"a/bad": TOY_KB.replace('cite: "4.2"', 'cite: "9.9"'),
		});
		const r = compile(ws, "a/bad");
		expect(r.ok).toBe(false);
		if (r.ok) return;
		const e = errorOf(r.error);
		expect(e.code).toBe("KB_INVALID");
		expect(e.message).toBe("a/bad has 1 errors");
		expect(e.diagnostics?.length).toBe(1);
		expect(e.diagnostics?.[0]).toMatchObject({
			severity: "error",
			file: "apps/a/kb/bad.yaml",
		});
	});

	it("caps the diagnostics at 20", () => {
		const rules = Array.from(
			{ length: 30 },
			(_, i) =>
				`  - id: R-${i + 2}\n    cite: "9.${i}"\n    set: payable\n    to: 1\n    because: x\n`,
		).join("");
		const { ws } = workspaceOf({
			"a/bad": TOY_KB.replace("clauses:", `${rules}clauses:`),
		});
		const r = compile(ws, "a/bad");
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(errorOf(r.error).message).toMatch(/^a\/bad has \d+ errors$/);
		expect(errorOf(r.error).diagnostics?.length).toBe(20);
	});

	it("gives LIMIT_EXCEEDED for a file over 1 MiB", () => {
		const { ws } = workspaceOf({ "a/big": TOY_KB + "#".repeat(MAX_KB_BYTES) });
		const r = compile(ws, "a/big");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(errorOf(r.error).code).toBe("LIMIT_EXCEEDED");
	});

	it("gives KB_INVALID with READ_ERROR for an unreadable file", () => {
		const { ws } = workspaceOf({ "a/gone": TOY_KB });
		// The file is listed but cannot be read.
		const flaky = {
			...ws,
			read: () => {
				throw new Error("EACCES");
			},
			listKbFiles: () => [{ ref: "a/gone", path: "apps/a/kb/gone.yaml" }],
		};
		const r = compile(flaky, "a/gone");
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(errorOf(r.error).code).toBe("KB_INVALID");
		expect(errorOf(r.error).diagnostics?.[0]).toMatchObject({
			code: "READ_ERROR",
		});
	});

	it("reads only the discovered file", () => {
		const { ws, host } = workspaceOf({ "a/toy": TOY_KB, "b/other": TOY_KB });
		compile(ws, "a/toy");
		expect(host.reads).toEqual(["/ws/apps/a/kb/toy.yaml"]);
	});
});
