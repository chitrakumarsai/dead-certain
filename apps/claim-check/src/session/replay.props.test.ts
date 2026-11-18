import { encode, next } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { consultArb } from "../testing/consultArb";
import { realKb } from "../testing/realKb";
import { decodeFragment } from "./replay";

const kb = realKb();
const FAILURES = ["KB_MISMATCH", "MALFORMED_TOKEN", "UNSUPPORTED_VERSION"];

describe("replay properties", () => {
	it("round-trips every session reached by valid answers", () => {
		// Feature: claim-check-app, Property 3: Replay round trip
		fc.assert(
			fc.property(consultArb(kb), (session) => {
				const result = decodeFragment(kb, `#/?r=${encode(session)}`);
				expect(result?.ok).toBe(true);
				if (result?.ok) expect(next(result.session)).toEqual(next(session));
			}),
			{ numRuns: 100 },
		);
	});

	it("never throws on a damaged fragment and fails only with the three codes", () => {
		// Feature: claim-check-app, Property 4: A damaged fragment never produces a verdict
		const fragment = fc.oneof(
			fc.string(),
			fc.string().map((s) => `#/?r=${s}`),
			consultArb(kb, 4).chain((s) =>
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
