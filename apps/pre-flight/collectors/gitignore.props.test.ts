import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ignores } from "./gitignore";

const segment = fc.constantFrom(
	".kiro",
	"specs",
	"a",
	"b.md",
	"*.md",
	"**",
	"?",
	"build",
	"node_modules",
	"x*y",
);
const lineArb = fc.oneof(
	fc
		.array(segment, { minLength: 1, maxLength: 3 })
		.chain((segs) =>
			fc
				.tuple(
					fc.constantFrom("", "/", "!", "\\#", "#"),
					fc.constantFrom("", "/", "   "),
				)
				.map(([pre, post]) => `${pre}${segs.join("/")}${post}`),
		),
	fc.constantFrom("", "   ", "# comment", "[ab]", "a\\ b"),
	fc.string({ maxLength: 12 }),
);
const textArb = fc.array(lineArb, { maxLength: 8 }).map((ls) => ls.join("\n"));
const pathArb = fc
	.tuple(
		fc.array(fc.constantFrom(".kiro", "specs", "a", "b.md", "build", "x1y"), {
			minLength: 1,
			maxLength: 4,
		}),
		fc.boolean(),
	)
	.map(([segs, dir]) => `${segs.join("/")}${dir ? "/" : ""}`);

describe("ignores properties", () => {
	it("agrees with its own evidence", () => {
		// Feature: pre-flight-app, Property 5: The gitignore matcher agrees with its own evidence
		fc.assert(
			fc.property(textArb, pathArb, (text, path) => {
				const r = ignores(text, path);
				const lines = text.split("\n");
				if ("unsupported" in r) {
					expect(lines[r.line - 1]).toBe(r.text);
					return;
				}
				if (r.line === undefined) {
					expect(r.ignored).toBe(false);
					return;
				}
				expect(lines[r.line - 1]?.replace(/\r$/, "")).toBe(r.text);
				const body = (r.text ?? "").trim();
				expect(body).not.toBe("");
				expect(body.startsWith("#")).toBe(false);
				// The deciding line ignores; only a re-including ! line can say not ignored.
				expect(r.ignored).toBe(!(r.text ?? "").startsWith("!"));
				expect(ignores(text, path)).toEqual(r);
			}),
			{ numRuns: 500 },
		);
	});
});
