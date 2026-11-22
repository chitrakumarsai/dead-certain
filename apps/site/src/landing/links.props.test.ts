import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { linksFor } from "./config";

// Vite's BASE_URL: "/" or "/a/b/", always with a trailing slash.
const segment = fc.stringMatching(/^[a-z0-9-]{1,12}$/);
const base = fc
	.array(segment, { maxLength: 3 })
	.map((parts) => (parts.length === 0 ? "/" : `/${parts.join("/")}/`));

describe("links", () => {
	it("are built from the base", () => {
		// Feature: landing-page, Property 6: Links are built from the base
		fc.assert(
			fc.property(base, fc.string({ minLength: 1, maxLength: 8 }), (b, id) => {
				const l = linksFor(b);
				for (const href of [l.claimCheck, l.preFlight, l.kit, l.clause(id)]) {
					expect(href.startsWith(b)).toBe(true);
					expect(href.slice(b.length)).not.toContain("//");
				}
				expect(l.clause(id)).toBe(
					`${b}claim-check/#/rulebook?clause=${encodeURIComponent(id)}`,
				);
			}),
			{ numRuns: 100 },
		);
	});

	it("give the deployed addresses under /dead-certain/", () => {
		expect(linksFor("/dead-certain/")).toMatchObject({
			claimCheck: "/dead-certain/claim-check/",
			preFlight: "/dead-certain/pre-flight/",
			kit: "/dead-certain/kit/",
		});
	});
});
