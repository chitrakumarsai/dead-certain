import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseTarget } from "./target";
import { requestUrls } from "./urls";

const RUNS = { numRuns: 300 };
const ALNUM =
	"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

/** An owner GitHub allows: 1 to 39 letters, digits and inner hyphens. */
const ownerArb = fc
	.tuple(
		fc.constantFrom(...ALNUM),
		fc.array(fc.constantFrom(...ALNUM, "-"), { maxLength: 37 }),
		fc.constantFrom(...ALNUM),
		fc.boolean(),
	)
	.map(([a, mid, z, short]) => (short ? a : `${a}${mid.join("")}${z}`));

/** A name GitHub allows, never . or .., and never ending in .git (the suffix is stripped). */
const nameArb = fc
	.array(fc.constantFrom(...ALNUM, ".", "_", "-"), {
		minLength: 1,
		maxLength: 100,
	})
	.map((cs) => cs.join(""))
	.filter((n) => n !== "." && n !== ".." && !n.endsWith(".git"));

const forms = (o: string, n: string) => [
	`${o}/${n}`,
	`${o}/${n}.git`,
	`github.com/${o}/${n}`,
	`https://github.com/${o}/${n}`,
	`https://github.com/${o}/${n}/`,
	`https://www.github.com/${o}/${n}.git`,
	`https://github.com/${o}/${n}/tree/main/src`,
	`  https://github.com/${o}/${n}  `,
];

describe("target properties", () => {
	it("never throws, and every form of a valid repository gives the same Target", () => {
		// Feature: pre-flight-app, Property 1: Target parsing is total and normalises
		fc.assert(
			fc.property(fc.string({ unit: "binary", maxLength: 200 }), (s) => {
				const r = parseTarget(s);
				expect(typeof r.ok).toBe("boolean");
			}),
			RUNS,
		);
		fc.assert(
			fc.property(ownerArb, nameArb, (owner, name) => {
				for (const form of forms(owner, name))
					expect(parseTarget(form), form).toEqual({
						ok: true,
						target: { owner, name },
					});
			}),
			RUNS,
		);
	});

	it("a parsed Target cannot bend a request URL", () => {
		// Feature: pre-flight-app, Property 2: A parsed Target cannot bend a URL
		const anyText = fc.oneof(
			fc.string({ unit: "binary", maxLength: 120 }),
			fc
				.tuple(ownerArb, nameArb, fc.string({ maxLength: 20 }))
				.map(([o, n, junk]) => `https://github.com/${o}/${n}${junk}`),
			fc
				.tuple(fc.string({ maxLength: 20 }), fc.string({ maxLength: 20 }))
				.map(([o, n]) => `${o}/${n}`),
		);
		fc.assert(
			fc.property(anyText, fc.string({ maxLength: 40 }), (text, branch) => {
				const r = parseTarget(text);
				if (!r.ok) return;
				for (const part of [r.target.owner, r.target.name])
					expect(part).not.toMatch(/[/?#%\\\s\p{Cc}]/u);
				const base = `https://api.github.com/repos/${r.target.owner}/${r.target.name}`;
				const urls = requestUrls(r.target, branch);
				expect(urls.metadata).toBe(base);
				expect(urls.gitignore).toBe(`${base}/contents/.gitignore`);
				expect(urls.readme).toBe(`${base}/readme`);
				// Any branch, however odd, stays one encoded segment.
				expect(urls.tree.startsWith(`${base}/git/trees/`)).toBe(true);
				const rest = urls.tree.slice(`${base}/git/trees/`.length);
				expect(rest).toMatch(/^[^/?#]*\?recursive=1$/);
				expect(decodeURIComponent(rest.slice(0, -"?recursive=1".length))).toBe(
					branch,
				);
				for (const url of Object.values(urls))
					expect(new URL(url).host).toBe("api.github.com");
			}),
			RUNS,
		);
	});
});
