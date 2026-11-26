// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import fc from "fast-check";
import { expect, test } from "vitest";
import {
	bgBase,
	type HeadTag,
	PAGES,
	type PageKey,
	pageTags,
} from "../packages/ui/src/site.ts";
import { checkPage } from "./seo-check.ts";
import { render } from "./seo-testing.ts";

const colours = bgBase(
	readFileSync(new URL("../packages/ui/tokens.css", import.meta.url), "utf8"),
);
const options = { colours, exists: () => true };
const keyArb = fc.constantFrom(...(Object.keys(PAGES) as PageKey[]));

type Mutation = "remove" | "duplicate" | "alter";

function mutate(tags: HeadTag[], at: number, how: Mutation): HeadTag[] {
	const tag = tags[at] as HeadTag;
	if (how === "remove") return tags.filter((_, i) => i !== at);
	if (how === "duplicate") return [...tags, tag];
	const changed: HeadTag =
		tag.tag === "title" || tag.tag === "script"
			? { ...tag, children: `${tag.children ?? ""}x` }
			: tag.tag === "link"
				? { ...tag, attrs: { ...tag.attrs, href: `${tag.attrs.href}x/` } }
				: { ...tag, attrs: { ...tag.attrs, content: `${tag.attrs.content}x` } };
	return tags.map((t, i) => (i === at ? changed : t));
}

// Feature: seo, Property 5: The checker agrees with the builder
test("Property 5: the checker agrees with the builder", () => {
	fc.assert(
		fc.property(keyArb, (key) => {
			expect(
				checkPage(render(pageTags(key, colours)), key, "index.html", options),
			).toEqual([]);
		}),
		{ numRuns: 100 },
	);
	fc.assert(
		fc.property(
			keyArb.chain((key) =>
				fc.tuple(
					fc.constant(key),
					fc.nat({ max: pageTags(key, colours).length - 1 }),
					fc.constantFrom<Mutation>("remove", "duplicate", "alter"),
				),
			),
			([key, at, how]) => {
				const tags = mutate(pageTags(key, colours), at, how);
				const items = checkPage(render(tags), key, "index.html", options);
				expect(items.length).toBeGreaterThan(0);
			},
		),
		{ numRuns: 300 },
	);
});
