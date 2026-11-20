// No @types/node in the repo: the Node imports are untyped, as in kb-tools.
// @ts-expect-error TS2591: no type definitions for node:child_process
import * as cp from "node:child_process";
// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:os
import * as os from "node:os";
// @ts-expect-error TS2591: no type definitions for node:path
import * as path from "node:path";
// @ts-expect-error TS2591: no type definitions for node:url
import * as url from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TOY_KB } from "./testkit/workspaces";

declare const process: { execPath: string };

const pkgRoot: string = path.resolve(
	path.dirname(url.fileURLToPath(import.meta.url)),
	"..",
);

let dir = "";

/** Every path under a directory with its size, sorted. */
function listing(root: string): string[] {
	const out: string[] = [];
	const walk = (d: string): void => {
		for (const name of fs.readdirSync(d) as string[]) {
			const full = path.join(d, name);
			const stat = fs.lstatSync(full);
			out.push(
				`${path.relative(root, full)}:${stat.isDirectory() ? "d" : stat.size}`,
			);
			if (stat.isDirectory()) walk(full);
		}
	};
	walk(root);
	return out.sort();
}

interface Rpc {
	jsonrpc: string;
	id?: number;
	result?: Record<string, unknown>;
	error?: unknown;
}

describe("stdio smoke test (node bin/start.mjs)", () => {
	beforeAll(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-mcp-smoke-"));
		fs.mkdirSync(path.join(dir, "apps", "a", "kb"), { recursive: true });
		fs.writeFileSync(
			path.join(dir, "pnpm-workspace.yaml"),
			"packages:\n  - apps/*\n",
		);
		fs.writeFileSync(path.join(dir, "apps", "a", "kb", "toy.yaml"), TOY_KB);
	});
	afterAll(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("speaks MCP over stdio, calls every tool, and exits 0 when stdin closes", async () => {
		const before = listing(dir);
		const child = cp.spawn(
			process.execPath,
			[path.join(pkgRoot, "bin", "start.mjs")],
			{
				cwd: dir,
				stdio: ["pipe", "pipe", "pipe"],
			},
		);
		let stderr = "";
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk: string) => {
			stderr += chunk;
		});

		const lines: string[] = [];
		const responses = new Map<number, Rpc>();
		let buffered = "";
		const waiters: (() => void)[] = [];
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => {
			buffered += chunk;
			let nl = buffered.indexOf("\n");
			while (nl >= 0) {
				const line = buffered.slice(0, nl);
				buffered = buffered.slice(nl + 1);
				if (line.trim() !== "") {
					lines.push(line);
					const msg = JSON.parse(line) as Rpc;
					if (typeof msg.id === "number") responses.set(msg.id, msg);
					for (const w of waiters.splice(0)) w();
				}
				nl = buffered.indexOf("\n");
			}
		});
		const exited = new Promise<number | null>((resolve) => {
			child.on("close", (code: number | null) => resolve(code));
		});

		const send = (message: object): void => {
			child.stdin.write(`${JSON.stringify(message)}\n`);
		};
		const reply = (id: number): Promise<Rpc> =>
			new Promise((resolve, reject) => {
				const check = (): void => {
					const found = responses.get(id);
					if (found !== undefined) resolve(found);
					else waiters.push(check);
				};
				check();
				setTimeout(
					() => reject(new Error(`no reply to ${id}; stderr: ${stderr}`)),
					20_000,
				);
			});
		const call = (id: number, name: string, args: object) => {
			send({
				jsonrpc: "2.0",
				id,
				method: "tools/call",
				params: { name, arguments: args },
			});
			return reply(id);
		};

		send({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-06-18",
				capabilities: {},
				clientInfo: { name: "smoke", version: "0" },
			},
		});
		const init = await reply(1);
		expect(init.result?.serverInfo).toMatchObject({ name: "dead-certain" });
		send({ jsonrpc: "2.0", method: "notifications/initialized" });

		send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
		const list = await reply(2);
		const tools = (list.result?.tools ?? []) as { name: string }[];
		const names = tools.map((t) => t.name).sort();
		expect(names).toEqual(["consult", "explain", "list_kbs", "validate"]);

		const listKbs = await call(3, "list_kbs", {});
		expect(listKbs.result?.structuredContent).toMatchObject({
			kbs: [{ ref: "a/toy", id: "toy-money", ok: true }],
		});

		const consult = await call(4, "consult", {
			kb: "a/toy",
			answers: { sum_insured: 1_000_000 },
		});
		expect(consult.result?.structuredContent).toMatchObject({
			status: "verdict",
			goals: { payable: 10_000 },
		});
		const question = await call(5, "consult", { kb: "a/toy" });
		expect(question.result?.structuredContent).toMatchObject({
			status: "question",
			question: { fact: "sum_insured", clause: "4.2", type: "money" },
		});

		const explain = await call(6, "explain", {
			kb: "a/toy",
			fact: "payable",
			answers: { sum_insured: 1_000_000 },
		});
		const explained = explain.result?.structuredContent as {
			value: number;
			text: string;
		};
		expect(explained.value).toBe(10_000);
		expect(explained.text).toContain("sum_insured = 1000000 [answered]");

		const validate = await call(7, "validate", { kb: "a/toy" });
		expect(validate.result?.structuredContent).toMatchObject({
			results: [{ ref: "a/toy", ok: true }],
		});

		const started = Date.now();
		child.stdin.end();
		expect(await exited).toBe(0);
		expect(Date.now() - started).toBeLessThan(2_000);

		// Every line on standard output was JSON-RPC (parsed above, with an envelope).
		expect(lines.length).toBeGreaterThanOrEqual(7);
		for (const line of lines)
			expect(JSON.parse(line)).toMatchObject({ jsonrpc: "2.0" });
		expect(stderr).toContain("dead-certain mcp: ready");
		expect(listing(dir)).toEqual(before);
	}, 30_000);
});
