import { encode, next } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { consultArb } from "../testing/consultArb";
import { realKb } from "../testing/realKb";
import { questionPath } from "./path";
import { decodeFragment, fragmentFor } from "./replay";

const kb = realKb();
const FAILURES = ["KB_MISMATCH", "MALFORMED_TOKEN", "UNSUPPORTED_VERSION"];

describe("session properties", () => {
	it("round-trips the fragment and never asks a known fact", () => {
		// Feature: app-template, Property 8: The Generated_App's session round-trips
		fc.assert(
			fc.property(consultArb(kb), (session) => {
				const result = decodeFragment(kb, fragmentFor(session));
				const answered = Object.keys(session.answers).length > 0;
				expect(result?.ok ?? !answered).toBe(true);
				if (result?.ok) {
					expect(result.session.answers).toEqual(session.answers);
					expect(next(result.session)).toEqual(next(session));
				}
				const path = questionPath(kb, session.answers);
				expect(new Set(path).size).toBe(path.length);
				const step = next(session);
				if (step.kind === "question")
					expect(session.answers[step.fact]).toBeUndefined();
			}),
			{ numRuns: 100 },
		);
	});

	it("never throws on a damaged fragment and fails only with the three codes", () => {
		const fragment = fc.oneof(
			fc.string(),
			fc.string().map((s) => `#/?r=${s}`),
			consultArb(kb, 2).chain((s) =>
				fc
					.tuple(fc.nat(), fc.string({ minLength: 1, maxLength: 3 }))
					.map(([at, junk]) => {
						const token = encode(s);
						const cut = at % (token.length + 1);
						return `#/?r=${token.slice(0, cut)}${junk}${token.slice(cut + 1)}`;
					}),
			),
		);
		fc.assert(
			fc.property(fragment, (hash) => {
				const result = decodeFragment(kb, hash);
				if (result !== null && !result.ok)
					expect(FAILURES).toContain(result.failure);
			}),
			{ numRuns: 200 },
		);
	});
});
