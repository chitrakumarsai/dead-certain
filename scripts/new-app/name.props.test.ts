import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RESERVED, validateName } from "./name.ts";

describe("name properties", () => {
	it("decides every string, and an accepted name is safe everywhere it goes", () => {
		// Feature: app-template, Property 1: Names are decided totally and consistently
		const near = fc
			.array(
				fc.constantFrom(
					"a",
					"b",
					"z",
					"0",
					"9",
					"-",
					"_",
					"A",
					".",
					"/",
					" ",
					"%",
				),
				{ minLength: 0, maxLength: 34 },
			)
			.map((cs) => cs.join(""));
		fc.assert(
			fc.property(
				fc.oneof(fc.string({ unit: "binary", maxLength: 40 }), near),
				(name) => {
					const r = validateName(name, ["claim-check", "pre-flight"]);
					expect(typeof r.ok).toBe("boolean");
					if (!r.ok) return;
					expect(r.title.length).toBeGreaterThan(0);
					expect(r.slugConst).toMatch(/^[A-Z][A-Z0-9_]*$/);
					expect(RESERVED).not.toContain(name);
					for (const place of [
						`apps/${name}`,
						`/dead-certain/${name}/`,
						`@dead-certain/${name}`,
					])
						expect(
							place.slice(
								place.indexOf(name),
								place.indexOf(name) + name.length,
							),
						).not.toMatch(/[/\\.%\s\p{Cc}]/u);
				},
			),
			{ numRuns: 500 },
		);
	});
});
