import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { insertAtMarker, nextPort } from "./markers.ts";

const line = fc
	.string({ maxLength: 20 })
	.map((s) => s.replace(/[\r\n]/g, "").replace(/new-app:/g, ""));

describe("marker properties", () => {
	it("a marker edit adds the lines and changes nothing else", () => {
		// Feature: app-template, Property 4: A marker edit changes one thing
		fc.assert(
			fc.property(
				fc.array(line, { maxLength: 6 }),
				fc.array(line, { maxLength: 6 }),
				fc.constantFrom("", "  ", "\t\t"),
				fc.array(line, { minLength: 1, maxLength: 3 }),
				fc.boolean(),
				(before, after, indent, inserted, crlf) => {
					const eol = crlf ? "\r\n" : "\n";
					const text = [
						...before,
						`${indent}# new-app:copy`,
						...after,
						"",
					].join(eol);
					const r = insertAtMarker(text, "copy", inserted);
					if (!r.ok) throw new Error(r.message);
					const expected = [
						...before,
						...inserted.map((l) => `${indent}${l}`),
						`${indent}# new-app:copy`,
						...after,
						"",
					].join(eol);
					expect(r.text).toBe(expected);
				},
			),
			{ numRuns: 200 },
		);
	});

	it("ports are unique and increasing", () => {
		// Feature: app-template, Property 5: Ports are unique and increasing
		fc.assert(
			fc.property(
				fc.uniqueArray(fc.integer({ min: 1024, max: 65000 }), { maxLength: 6 }),
				(ports) => {
					const text = ports
						.map((p) => `"http://localhost:${p}/x/"`)
						.join("\n");
					const next = nextPort(text);
					expect(ports).not.toContain(next);
					for (const p of ports) expect(next).toBeGreaterThan(p);
					const again = nextPort(`${text}\n"http://localhost:${next}/y/"`);
					expect(again).toBe(next + 1);
				},
			),
			{ numRuns: 200 },
		);
	});
});
