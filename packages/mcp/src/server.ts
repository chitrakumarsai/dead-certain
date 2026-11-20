import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { consult } from "./tools/consult";
import { explainFact } from "./tools/explain";
import { listKbs } from "./tools/list";
import { validateKbs } from "./tools/validate";
import type { Workspace } from "./workspace";

/** Kept equal to package.json's version; a test checks it. */
export const SERVER_NAME = "dead-certain";
export const SERVER_VERSION = "0.0.0";

const READ_ONLY = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
} as const;

// Types only here. The size limits of requirement 6.3 are checked in the
// handlers, which answer LIMIT_EXCEEDED and name the limit.
const kb = z
	.string()
	.describe(
		"Which knowledge base, as <app>/<name>, for example claim-check/policy. Call list_kbs for the valid values.",
	);
const answers = z
	.record(z.string(), z.union([z.boolean(), z.number(), z.string()]))
	.optional()
	.describe(
		"Facts you know, as { fact_name: value }. Money is an integer in minor units (paise, cents). A date is an ISO string such as 2025-01-31. An enum is one of the fact's options. Leave out any fact you do not know: it stays unknown and is never guessed.",
	);
const token = z
	.string()
	.optional()
	.describe(
		"A replay token from an earlier consult result. Its answers are applied first; any in `answers` replace them.",
	);

/**
 * The four tools over a Workspace. Each handler is a pure function that never
 * throws; this function only registers them.
 */
export function createServer(ws: Workspace): McpServer {
	const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

	server.registerTool(
		"list_kbs",
		{
			title: "List knowledge bases",
			description:
				"List the knowledge bases in this repository (apps/*/kb/*.yaml), compiled fresh from the YAML. Each entry gives its ref (the value to pass as `kb` to the other tools), goals, and counts of facts, askable facts, rules and clauses, or ok:false with an error count if it does not compile. Call this first.",
			inputSchema: z.strictObject({}),
			annotations: READ_ONLY,
		},
		async () => listKbs(ws),
	);

	server.registerTool(
		"consult",
		{
			title: "Consult a knowledge base",
			description:
				"Run the deterministic engine on the answers you have. Returns either the next question to ask (status question, with why it matters and the clause behind it) or the verdict (status verdict: goal values, line items with the rule and clause for each, and any questions still open). Nothing is guessed: facts you leave out stay unknown. Money is an integer in minor units. The result includes a token that replays the same state. To see why a value came out as it did, call explain with a goal.",
			inputSchema: z.strictObject({ kb, answers, token }),
			annotations: READ_ONLY,
		},
		async (args) => consult(ws, args),
	);

	server.registerTool(
		"explain",
		{
			title: "Explain a fact",
			description:
				"Show the proof of one fact for the given answers: the rules that fired, the facts they used, and the rulebook clause each rule cites. Works for goals, derived facts and askable facts. Returns the proof as JSON, as an indented text outline (unknown facts print as unknown), and the title and text of each clause cited. Takes the same kb, answers and token as consult.",
			inputSchema: z.strictObject({
				kb,
				fact: z
					.string()
					.describe(
						"The fact name, for example payable. consult's goals and line items name facts you can explain.",
					),
				answers,
				token,
			}),
			annotations: READ_ONLY,
		},
		async (args) => explainFact(ws, args),
	);

	server.registerTool(
		"validate",
		{
			title: "Validate knowledge bases",
			description:
				"Run the knowledge-base validator, the same checks as `pnpm dc validate`, on the YAML as saved on disk. Use it after editing rules. Returns, per file, ok, the error and warning counts and each diagnostic (severity, code, file, message, and the rule, fact or clause id where one applies). Omit `kb` to check every knowledge base.",
			inputSchema: z.strictObject({
				kb: kb.optional(),
			}),
			annotations: READ_ONLY,
		},
		async (args) => validateKbs(ws, args),
	);

	return server;
}
