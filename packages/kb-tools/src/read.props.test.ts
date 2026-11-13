import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Host, HostError, readKbFile } from "./index";

const FILE = "apps/demo/kb/demo.yaml";
const BOM = "\uFEFF";

function hostReturning(bytes: Uint8Array): Host {
	return {
		readFile: () => bytes,
		readDir: () => [],
		stat: () => "file",
		writeFile: () => {},
		makeDir: () => {},
		cwd: () => "/",
	};
}

function hostFailing(reason: string): Host {
	return {
		...hostReturning(new Uint8Array()),
		readFile: () => {
			throw new HostError(reason);
		},
	};
}

// Well-formed text only (no lone surrogates), so UTF-8 encoding round-trips.
const textArb = fc.string({ unit: "grapheme", maxLength: 200 });

// 0xFF never occurs in valid UTF-8, so inserting it makes the bytes invalid.
const invalidBytesArb = fc
	.tuple(fc.uint8Array({ maxLength: 100 }), fc.uint8Array({ maxLength: 100 }))
	.map(([head, tail]) => Uint8Array.from([...head, 0xff, ...tail]));

describe("Property 19: UTF-8 decoding and read failures", () => {
	// Feature: kb-tools, Property 19: UTF-8 decoding and read failures
	// **Validates: Requirements 2.6, 2.7, 2.8, 2.9**
	it("round-trips arbitrary text, dropping one leading byte-order mark", () => {
		fc.assert(
			fc.property(textArb, fc.boolean(), (text, withBom) => {
				const source = withBom ? BOM + text : text;
				const bytes = new TextEncoder().encode(source);
				const result = readKbFile(FILE, FILE, hostReturning(bytes));
				const expected = source.startsWith(BOM) ? source.slice(1) : source;
				expect("text" in result && result.text).toBe(expected);
			}),
			{ numRuns: 100 },
		);
	});

	it("reports invalid UTF-8 as one READ_ERROR with no operating-system reason", () => {
		fc.assert(
			fc.property(invalidBytesArb, (bytes) => {
				const result = readKbFile(FILE, FILE, hostReturning(bytes));
				expect("diagnostics" in result).toBe(true);
				if (!("diagnostics" in result)) return;
				expect(result.diagnostics).toHaveLength(1);
				const [d] = result.diagnostics;
				expect(d?.code).toBe("READ_ERROR");
				expect(d?.file).toBe(FILE);
				expect(d?.message).toContain("not valid UTF-8");
				expect(d?.message).toBe(
					`Cannot read '${FILE}': the file is not valid UTF-8.`,
				);
			}),
			{ numRuns: 100 },
		);
	});

	it("reports a host failure as one READ_ERROR containing its reason", () => {
		fc.assert(
			fc.property(fc.string({ minLength: 1, maxLength: 80 }), (reason) => {
				const result = readKbFile(FILE, FILE, hostFailing(reason));
				expect("diagnostics" in result).toBe(true);
				if (!("diagnostics" in result)) return;
				expect(result.diagnostics).toHaveLength(1);
				const [d] = result.diagnostics;
				expect(d?.code).toBe("READ_ERROR");
				expect(d?.file).toBe(FILE);
				expect(d?.message).toContain(reason);
			}),
			{ numRuns: 100 },
		);
	});

	it("never uses YAML_SYNTAX for a read or decoding failure", () => {
		fc.assert(
			fc.property(
				invalidBytesArb,
				fc.string({ minLength: 1, maxLength: 40 }),
				(bytes, reason) => {
					for (const host of [hostReturning(bytes), hostFailing(reason)]) {
						const result = readKbFile(FILE, FILE, host);
						if ("diagnostics" in result) {
							for (const d of result.diagnostics) {
								expect(d.code).not.toBe("YAML_SYNTAX");
							}
						}
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});
