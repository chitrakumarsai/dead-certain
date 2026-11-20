import { HostError, type Host as KbHost, runCli } from "@dead-certain/kb-tools";
import { describe, expect, it } from "vitest";
import { MAX_KB_BYTES } from "../limits";
import type { ToolResult } from "../payload";
import type { MemoryHost } from "../testkit/memory-host";
import { realKb, TOY_KB, workspaceOf } from "../testkit/workspaces";
import { validateKbs } from "./validate";

interface Result {
	ref: string;
	path: string;
	ok: boolean;
	errors: number;
	warnings: number;
	diagnostics: {
		severity: string;
		code: string;
		file: string;
		message: string;
		id?: string;
	}[];
}
const results = (r: ToolResult) =>
	(r.structuredContent as unknown as { results: Result[] }).results;
type Err = { error: { code: string } };

/** A kb-tools Host over the in-memory files; any write is a failure. */
function cliHost(host: MemoryHost): KbHost {
	return {
		readFile: (p) => host.readFile(p),
		readDir: (p) => host.readDir(p),
		stat: (p) => {
			const s = host.stat(p);
			return s === "other" ? "none" : s;
		},
		writeFile: () => {
			throw new HostError("read only");
		},
		makeDir: () => {
			throw new HostError("read only");
		},
		cwd: () => host.cwd(),
	};
}

function line(d: Result["diagnostics"][number]): string {
	const id = d.id === undefined ? "" : ` [${d.id}]`;
	return `${d.file}: ${d.severity} ${d.code}${id} ${d.message}`;
}

describe("validate", () => {
	it("passes the clean pre-flight knowledge base", () => {
		const { ws } = workspaceOf({
			"pre-flight/checklist": realKb("pre-flight/checklist"),
		});
		const [one] = results(validateKbs(ws, { kb: "pre-flight/checklist" }));
		expect(one).toMatchObject({
			ref: "pre-flight/checklist",
			ok: true,
			errors: 0,
		});
		expect(one?.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
	});

	it("validates every file when kb is omitted, sorted by ref", () => {
		const { ws } = workspaceOf({ "b/two": TOY_KB, "a/one": TOY_KB });
		const all = results(validateKbs(ws, {}));
		expect(all.map((x) => x.ref)).toEqual(["a/one", "b/two"]);
		expect(Object.keys(all[0] as object)).toEqual([
			"ref",
			"path",
			"ok",
			"errors",
			"warnings",
			"diagnostics",
		]);
	});

	it("reports a removed clause with the same diagnostics as dc validate", () => {
		const broken = realKb("pre-flight/checklist").replace(
			/\n {2}"?[\w.-]+"?:\n {4}title:[^\n]*\n {4}text:[^\n]*/,
			"",
		);
		expect(broken).not.toBe(realKb("pre-flight/checklist"));
		const { ws, host } = workspaceOf({ "pre-flight/checklist": broken });
		const [one] = results(validateKbs(ws, { kb: "pre-flight/checklist" }));
		expect(one?.ok).toBe(false);
		expect(one?.errors).toBeGreaterThan(0);
		const cli = runCli(
			["validate", "apps/pre-flight/kb/checklist.yaml"],
			cliHost(host),
		);
		const printed = cli.stdout.trimEnd().split("\n");
		const summary = printed.pop();
		expect(printed).toEqual((one?.diagnostics ?? []).map(line));
		expect(summary).toBe(
			`1 files checked, ${one?.errors} errors, ${one?.warnings} warnings`,
		);
	});

	it("keeps a warning without failing", () => {
		const { ws } = workspaceOf({ "a/toy": TOY_KB });
		const [one] = results(validateKbs(ws, { kb: "a/toy" }));
		expect(one?.ok).toBe(true);
		expect(one?.warnings).toBe(
			one?.diagnostics.filter((d) => d.severity === "warning").length,
		);
	});

	it("returns READ_ERROR and other read diagnostics as results, not failures", () => {
		const { ws } = workspaceOf({ "a/gone": TOY_KB });
		const flaky = {
			...ws,
			read: () => {
				throw new Error("EACCES");
			},
		};
		const r = validateKbs(flaky, { kb: "a/gone" });
		expect(r.isError).toBeUndefined();
		expect(results(r)[0]?.diagnostics[0]?.code).toBe("READ_ERROR");
		const big = workspaceOf({ "a/big": TOY_KB + "#".repeat(MAX_KB_BYTES) }).ws;
		const bigResult = validateKbs(big, {});
		expect(bigResult.isError).toBeUndefined();
		expect(results(bigResult)[0]?.ok).toBe(false);
		const bad = workspaceOf({ "a/bin": new Uint8Array([0xff, 0xfe, 0x00]) }).ws;
		expect(results(validateKbs(bad, { kb: "a/bin" }))[0]?.ok).toBe(false);
	});

	it("gives UNKNOWN_KB for an unknown ref and an empty list for no files", () => {
		const { ws } = workspaceOf({ "a/toy": TOY_KB });
		const r = validateKbs(ws, { kb: "zzz" });
		expect((r.structuredContent as unknown as Err).error.code).toBe(
			"UNKNOWN_KB",
		);
		expect(validateKbs(workspaceOf({}).ws, {}).structuredContent).toEqual({
			results: [],
		});
	});

	it("never throws on bad shapes and rejects a non-string kb", () => {
		const { ws } = workspaceOf({ "a/toy": TOY_KB });
		for (const a of [undefined, null, 5, [], { kb: 1 }, { kb: null }]) {
			const r = validateKbs(ws, a);
			expect(r.structuredContent).toBeDefined();
		}
		expect(
			(validateKbs(ws, { kb: 1 }).structuredContent as unknown as Err).error
				.code,
		).toBe("UNKNOWN_KB");
	});
});
