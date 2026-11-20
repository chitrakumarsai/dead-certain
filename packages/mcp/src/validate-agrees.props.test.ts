import { validateText } from "@dead-certain/kb-tools";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { faultArb, kbArb, renderYaml } from "../../kb-tools/src/testkit";
import { diagnosticJson } from "./kbs";
import { bodyOf } from "./testkit/body";
import { workspaceOf } from "./testkit/workspaces";
import { validateKbs } from "./tools/validate";

const PATH = "apps/gen/kb/kb.yaml";

const textArb = fc.oneof(
	kbArb.map((kb) => renderYaml(kb)),
	kbArb.chain((kb) => faultArb(kb).map((fault) => fault.text)),
	fc.string({ maxLength: 200 }),
	fc.string({ unit: "binary", maxLength: 100 }),
	fc.constantFrom(
		"",
		"---\n",
		"a: [",
		"id: x\ngoals: nope\n",
		"\t\t:",
		"- 1\n- 2\n",
	),
);

describe("mcp-server validate", () => {
	// Feature: mcp-server, Property 7: validate agrees with validateText
	// **Validates: Requirements 5.2, 5.3, 5.4**
	it("returns validateText's diagnostics, in order, for any file text", () => {
		let withDiagnostics = 0;
		let clean = 0;
		fc.assert(
			fc.property(textArb, (text) => {
				const { ws } = workspaceOf({ "gen/kb": text });
				const result = validateKbs(ws, { kb: "gen/kb" });
				expect(result.isError).toBeUndefined();
				const [one] = bodyOf(result).results;
				const expected = validateText(text, PATH);
				expect(one?.diagnostics).toEqual(
					expected.diagnostics.map(diagnosticJson),
				);
				expect(one?.ok).toBe(expected.ok);
				expect(one?.errors).toBe(
					expected.diagnostics.filter((d) => d.severity === "error").length,
				);
				expect(one?.warnings).toBe(
					expected.diagnostics.filter((d) => d.severity === "warning").length,
				);
				if (expected.diagnostics.length > 0) withDiagnostics++;
				else clean++;
				// The all-files form gives the same entry.
				expect(bodyOf(validateKbs(ws, {})).results).toEqual([one]);
			}),
			{ numRuns: 200 },
		);
		expect(withDiagnostics).toBeGreaterThan(20);
		expect(clean).toBeGreaterThan(5);
	});
});
