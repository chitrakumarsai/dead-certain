import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server";
import { goldenScenario, realWorkspace } from "./testkit/workspaces";

/// <reference types="vite/client" />
const pkgText: Record<string, string> = import.meta.glob("../package.json", {
	eager: true,
	query: "?raw",
	import: "default",
});

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
	while (closers.length > 0) await closers.pop()?.();
});

async function connect() {
	const server = createServer(realWorkspace().ws);
	const client = new Client({ name: "test", version: "0" });
	const [a, b] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(a), client.connect(b)]);
	closers.push(() => client.close());
	return client;
}

describe("createServer", () => {
	it("names itself dead-certain with the package version", async () => {
		const client = await connect();
		expect(client.getServerVersion()).toMatchObject({
			name: "dead-certain",
			version: SERVER_VERSION,
		});
		expect(SERVER_NAME).toBe("dead-certain");
		const pkg = JSON.parse(Object.values(pkgText)[0] ?? "{}") as {
			version: string;
		};
		expect(SERVER_VERSION).toBe(pkg.version);
	});

	it("lists exactly the four tools, each read-only, with a description and a schema", async () => {
		const client = await connect();
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name).sort()).toEqual([
			"consult",
			"explain",
			"list_kbs",
			"validate",
		]);
		for (const tool of tools) {
			expect(tool.annotations).toMatchObject({
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			});
			expect((tool.description ?? "").length).toBeGreaterThan(40);
			expect(tool.inputSchema.type).toBe("object");
			expect(tool.inputSchema.additionalProperties).toBe(false);
		}
	});

	it("returns the Payload as text and as structuredContent", async () => {
		const client = await connect();
		const r = await client.callTool({ name: "list_kbs", arguments: {} });
		const text = (r.content as { type: string; text: string }[])[0]?.text ?? "";
		expect(JSON.parse(text)).toEqual(r.structuredContent);
		expect(r.isError).toBeFalsy();
	});

	it("consult reaches G-01's verdict through the protocol", async () => {
		const client = await connect();
		const { facts } = goldenScenario("claim-check", "G-01");
		const r = await client.callTool({
			name: "consult",
			arguments: { kb: "claim-check/policy", answers: facts },
		});
		expect(r.structuredContent).toMatchObject({
			status: "verdict",
			goals: { payable: 13_200_000, outcome: "reduced" },
		});
	});

	it("marks a Tool_Error with isError", async () => {
		const client = await connect();
		const r = await client.callTool({
			name: "consult",
			arguments: { kb: "nope" },
		});
		expect(r.isError).toBe(true);
		expect(r.structuredContent).toMatchObject({
			error: { code: "UNKNOWN_KB" },
		});
	});

	// SDK 1.32.2 reports invalid arguments as a Tool_Result with isError and the
	// text "MCP error -32602: Input validation error: ...", not as a JSON-RPC
	// error. No handler runs, so there is no structuredContent.
	it("refuses consult with no kb before any handler runs", async () => {
		const client = await connect();
		const r = await client.callTool({ name: "consult", arguments: {} });
		expect(r.isError).toBe(true);
		expect(JSON.stringify(r.content)).toContain("-32602");
		expect(JSON.stringify(r.content)).toContain("kb");
		expect(r.structuredContent).toBeUndefined();
	});

	it("refuses an extra argument (strict schema)", async () => {
		const client = await connect();
		const r = await client.callTool({
			name: "list_kbs",
			arguments: { surprise: 1 },
		});
		expect(r.isError).toBe(true);
		expect(JSON.stringify(r.content)).toContain("-32602");
		expect(r.structuredContent).toBeUndefined();
	});

	it("refuses a wrong type and a non-finite answer", async () => {
		const client = await connect();
		for (const args of [
			{ kb: 5 },
			{ kb: "claim-check/policy", answers: { age: null } },
			{ kb: "claim-check/policy", answers: [] },
		]) {
			const r = await client.callTool({ name: "consult", arguments: args });
			expect(r.isError).toBe(true);
			expect(JSON.stringify(r.content)).toContain("-32602");
		}
	});
});
