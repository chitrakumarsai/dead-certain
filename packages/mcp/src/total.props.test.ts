import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { ToolResult } from "./payload";
import { realWorkspace } from "./testkit/workspaces";
import { consult } from "./tools/consult";
import { explainFact } from "./tools/explain";
import { listKbs } from "./tools/list";
import { validateKbs } from "./tools/validate";

const CODES = new Set([
	"INVALID_KB",
	"CYCLE",
	"UNKNOWN_FACT",
	"NOT_ANSWERABLE",
	"INVALID_ANSWER",
	"EVALUATION_ERROR",
	"NON_INTEGER_MONEY",
	"MALFORMED_TOKEN",
	"UNSUPPORTED_VERSION",
	"KB_MISMATCH",
	"NO_WORKSPACE",
	"UNKNOWN_KB",
	"KB_INVALID",
	"LIMIT_EXCEEDED",
	"INTERNAL",
]);

const { ws } = realWorkspace();

const key = fc.oneof(
	fc.constantFrom(
		"__proto__",
		"constructor",
		"kb",
		"fact",
		"answers",
		"token",
		"age",
		"claimed",
		"treatment",
	),
	fc.string({ maxLength: 12 }),
);
const scalar = fc.oneof(
	fc.constant(null),
	fc.boolean(),
	fc.integer(),
	fc.double({ noNaN: false }),
	fc.constantFrom(
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		-0,
	),
	fc.string({ maxLength: 40 }),
	fc.string({ minLength: 450, maxLength: 600 }),
);
const anyJson = fc.letrec((tie) => ({
	value: fc.oneof(
		{ depthSize: "small", maxDepth: 3 },
		scalar,
		fc.array(tie("value"), { maxLength: 4 }),
		fc.array(fc.tuple(key, tie("value")), { maxLength: 5 }).map((pairs) => {
			const o: Record<string, unknown> = {};
			// defineProperty keeps "__proto__" as an own key, as JSON.parse does.
			for (const [k, v] of pairs) {
				Object.defineProperty(o, k, {
					value: v,
					enumerable: true,
					writable: true,
					configurable: true,
				});
			}
			return o;
		}),
	),
})).value;

/** Mostly well-formed arguments with one wrong part. */
const nearlyValid = fc.record(
	{
		kb: fc.oneof(
			fc.constantFrom("claim-check/policy", "pre-flight/checklist"),
			anyJson,
		),
		fact: fc.oneof(
			fc.constantFrom("payable", "age", "outcome", "__proto__"),
			anyJson,
		),
		answers: fc.oneof(fc.dictionary(key, scalar, { maxKeys: 8 }), anyJson),
		token: fc.oneof(fc.string({ maxLength: 60 }), anyJson),
	},
	{ requiredKeys: [] },
);

const argsArb = fc.oneof(anyJson, nearlyValid);

function assertToolResult(r: ToolResult): void {
	expect(Array.isArray(r.content)).toBe(true);
	expect(r.content).toHaveLength(1);
	expect(r.content[0]?.type).toBe("text");
	expect(JSON.parse(r.content[0]?.text ?? "")).toEqual(r.structuredContent);
	if (r.isError === true) {
		const error = (
			r.structuredContent as { error: { code: string; message: string } }
		).error;
		expect(CODES.has(error.code)).toBe(true);
		expect(error.message.length).toBeLessThanOrEqual(500);
		expect(error.message).not.toMatch(/\bat .*\(.*:\d+:\d+\)/);
	} else {
		expect(r.isError).toBeUndefined();
	}
}

describe("mcp-server totality", () => {
	// Feature: mcp-server, Property 5: Handlers are total
	// **Validates: Requirements 6.2, 6.5, 8.5**
	it("every handler returns a Tool_Result for any arguments and never throws", () => {
		fc.assert(
			fc.property(argsArb, (args) => {
				assertToolResult(listKbs(ws));
				assertToolResult(consult(ws, args));
				assertToolResult(explainFact(ws, args));
				assertToolResult(validateKbs(ws, args));
			}),
			{ numRuns: 300 },
		);
	});

	it("also holds for undefined and for a workspace whose files cannot be read", () => {
		const broken = {
			root: () => "/x",
			listKbFiles: () => [{ ref: "a/b", path: "apps/a/kb/b.yaml" }],
			read: () => {
				throw new Error("EACCES /secret/path");
			},
		};
		for (const handler of [consult, explainFact, validateKbs]) {
			assertToolResult(handler(broken, undefined));
			assertToolResult(handler(broken, { kb: "a/b", fact: "x" }));
		}
		assertToolResult(listKbs(broken));
	});
});
