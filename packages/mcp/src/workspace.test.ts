import { describe, expect, it } from "vitest";
import {
	MAX_ANSWER_KEYS,
	MAX_FACT_NAME,
	MAX_KB_BYTES,
	MAX_MESSAGE,
	MAX_PAYLOAD,
	MAX_STRING_VALUE,
	MAX_TOKEN,
} from "./limits";
import { clip, fail, ok } from "./payload";
import { memoryHost } from "./testkit/memory-host";
import { makeWorkspace } from "./workspace";

const MARK = { "/ws/pnpm-workspace.yaml": "packages:\n  - apps/*\n" };

describe("makeWorkspace", () => {
	it("finds the root by walking up from the working directory", () => {
		const host = memoryHost(
			{ ...MARK, "/ws/apps/a/kb/x.yaml": "id: x" },
			{ cwd: "/ws/apps/a/kb" },
		);
		expect(makeWorkspace(host).root()).toBe("/ws");
	});

	it("has no root without a pnpm-workspace.yaml", () => {
		const host = memoryHost({ "/ws/apps/a/kb/x.yaml": "id: x" });
		const ws = makeWorkspace(host);
		expect(ws.root()).toBeUndefined();
		expect(ws.listKbFiles()).toEqual([]);
	});

	it("lists apps/*/kb/*.yaml sorted by ref in code-unit order", () => {
		const host = memoryHost({
			...MARK,
			"/ws/apps/pre-flight/kb/checklist.yaml": "",
			"/ws/apps/claim-check/kb/policy.yaml": "",
			"/ws/apps/claim-check/kb/B.yaml": "",
			"/ws/apps/claim-check/kb/a.yaml": "",
		});
		expect(makeWorkspace(host).listKbFiles()).toEqual([
			{ ref: "claim-check/B", path: "apps/claim-check/kb/B.yaml" },
			{ ref: "claim-check/a", path: "apps/claim-check/kb/a.yaml" },
			{ ref: "claim-check/policy", path: "apps/claim-check/kb/policy.yaml" },
			{
				ref: "pre-flight/checklist",
				path: "apps/pre-flight/kb/checklist.yaml",
			},
		]);
	});

	it("ignores kb/dist, other extensions and nested folders", () => {
		const host = memoryHost({
			...MARK,
			"/ws/apps/a/kb/dist/policy.yaml": "",
			"/ws/apps/a/kb/x.yml": "",
			"/ws/apps/a/kb/notes.md": "",
			"/ws/apps/a/kb/sub/deep.yaml": "",
			"/ws/apps/a/src/y.yaml": "",
			"/ws/apps/a/kb/ok.yaml": "",
		});
		expect(
			makeWorkspace(host)
				.listKbFiles()
				.map((f) => f.ref),
		).toEqual(["a/ok"]);
	});

	it("reports a symlink as not a regular file", () => {
		const host = memoryHost(
			{ ...MARK, "/ws/apps/a/kb/real.yaml": "", "/ws/apps/a/kb/link.yaml": "" },
			{ links: ["/ws/apps/a/kb/link.yaml"] },
		);
		expect(
			makeWorkspace(host)
				.listKbFiles()
				.map((f) => f.ref),
		).toEqual(["a/real"]);
	});

	it("skips an app whose kb folder is a symlink", () => {
		const host = memoryHost(
			{ ...MARK, "/ws/apps/a/kb/x.yaml": "", "/ws/apps/b/kb/y.yaml": "" },
			{ links: ["/ws/apps/b"] },
		);
		expect(
			makeWorkspace(host)
				.listKbFiles()
				.map((f) => f.ref),
		).toEqual(["a/x"]);
	});

	it("returns an empty list when apps/ is missing", () => {
		const host = memoryHost({ ...MARK });
		expect(makeWorkspace(host).listKbFiles()).toEqual([]);
	});

	it("reads a listed path relative to the root", () => {
		const host = memoryHost({ ...MARK, "/ws/apps/a/kb/x.yaml": "id: x" });
		const bytes = makeWorkspace(host).read("apps/a/kb/x.yaml");
		expect(new TextDecoder().decode(bytes)).toBe("id: x");
	});
});

describe("limits", () => {
	it("match requirement 6.3 and 6.4", () => {
		expect([
			MAX_ANSWER_KEYS,
			MAX_FACT_NAME,
			MAX_STRING_VALUE,
			MAX_TOKEN,
			MAX_KB_BYTES,
			MAX_PAYLOAD,
			MAX_MESSAGE,
		]).toEqual([200, 100, 500, 20_000, 1_048_576, 200_000, 500]);
	});
});

describe("payload", () => {
	it("ok wraps one text block and the same object as structuredContent", () => {
		const r = ok({ a: 1, b: [null] });
		expect(r.isError).toBeUndefined();
		expect(r.content).toEqual([{ type: "text", text: '{"a":1,"b":[null]}' }]);
		expect(r.structuredContent).toEqual({ a: 1, b: [null] });
	});

	it("fail sets isError and clips the message to 500 characters", () => {
		const r = fail("INTERNAL", "x".repeat(900));
		expect(r.isError).toBe(true);
		const error = (
			r.structuredContent as { error: { code: string; message: string } }
		).error;
		expect(error.code).toBe("INTERNAL");
		expect(error.message.length).toBe(500);
	});

	it("ok turns a Payload over 200,000 characters into LIMIT_EXCEEDED", () => {
		const r = ok({ big: "y".repeat(MAX_PAYLOAD) });
		expect(r.isError).toBe(true);
		expect(
			(r.structuredContent as { error: { code: string } }).error.code,
		).toBe("LIMIT_EXCEEDED");
	});

	it("clip leaves short text alone", () => {
		expect(clip("abc", 3)).toBe("abc");
		expect(clip("abcd", 3)).toBe("ab…");
	});
});
