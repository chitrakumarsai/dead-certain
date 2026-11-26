import fc from "fast-check";
import { expect, test } from "vitest";
import {
	absolute,
	appNode,
	BASE,
	headTagsFor,
	ORIGIN,
	type PageSeo,
	serialise,
	sitemapXml,
} from "./site";

const RUNS = { numRuns: 200 };

// Path segments a page could have: never "#", "?", "." or "..".
const segment = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,11}$/);
const pathArb = fc.oneof(
	fc.constant(""),
	fc
		.array(segment, { minLength: 1, maxLength: 3 })
		.map((s) => `${s.join("/")}/`),
	segment.map((s) => `${s}.html`),
);
const pageArb: fc.Arbitrary<PageSeo> = fc.record({
	path: pathArb,
	name: fc.string({ minLength: 1, maxLength: 40 }),
	title: fc.string({ minLength: 1, maxLength: 60 }),
	description: fc.string({ minLength: 1, maxLength: 155 }),
	index: fc.boolean(),
});

const count = (tags: ReturnType<typeof headTagsFor>, id: string): number =>
	tags.filter(
		(t) =>
			t.tag === id ||
			t.attrs.name === id ||
			t.attrs.property === id ||
			t.attrs.rel === id,
	).length;

// Feature: seo, Property 1: Head tags are complete and single
test("Property 1: head tags are complete and single", () => {
	fc.assert(
		fc.property(pageArb, (page) => {
			const tags = headTagsFor(page);
			for (const id of ["title", "description", "robots"])
				expect(count(tags, id), id).toBe(1);
			if (!page.index) {
				expect(count(tags, "canonical")).toBe(0);
				expect(
					tags.some((t) =>
						/^(og|twitter):/.test(t.attrs.property ?? t.attrs.name ?? ""),
					),
				).toBe(false);
				expect(tags.find((t) => t.attrs.name === "robots")?.attrs.content).toBe(
					"noindex, nofollow",
				);
				return;
			}
			const canonical = tags.find((t) => t.attrs.rel === "canonical")?.attrs
				.href as string;
			expect(canonical).toBe(absolute(page.path));
			expect(canonical).not.toMatch(/[#?]/);
			for (const id of [
				"canonical",
				"og:title",
				"og:description",
				"og:type",
				"og:url",
				"og:site_name",
				"og:locale",
				"twitter:card",
				"twitter:title",
				"twitter:description",
			])
				expect(count(tags, id), id).toBe(1);
			expect(
				tags.find((t) => t.attrs.property === "og:url")?.attrs.content,
			).toBe(canonical);
		}),
		RUNS,
	);
});

// Feature: seo, Property 2: JSON-LD round-trips and cannot close the script
test("Property 2: JSON-LD round-trips and cannot close the script", () => {
	fc.assert(
		fc.property(pageArb, fc.string(), (page, category) => {
			const node = appNode(page, category);
			const text = serialise(node);
			expect(text).not.toContain("<");
			expect(JSON.parse(text)).toEqual(node);
			expect(JSON.parse(text)["@type"]).not.toBe("Person");
		}),
		RUNS,
	);
});

// Feature: seo, Property 3: The sitemap lists exactly the indexable pages
test("Property 3: the sitemap lists exactly the indexable pages", () => {
	const dateArb = fc
		.date({
			min: new Date("2000-01-01T00:00:00Z"),
			max: new Date("2099-12-31T00:00:00Z"),
			noInvalidDate: true,
		})
		.map((d) => d.toISOString().slice(0, 10));
	fc.assert(
		fc.property(
			fc.dictionary(fc.stringMatching(/^[a-z]{1,8}$/), pageArb),
			fc.dictionary(fc.stringMatching(/^[a-z]{1,8}$/), dateArb),
			(pages, lastmod) => {
				const xml = sitemapXml(lastmod, pages);
				const urls = [...xml.matchAll(/<url>(.*?)<\/url>/g)].map(
					(m) => m[1] as string,
				);
				const indexable = Object.entries(pages).filter(([, p]) => p.index);
				expect(urls).toHaveLength(indexable.length);
				for (const [i, [key, page]] of indexable.entries()) {
					const url = urls[i] as string;
					expect(url).toContain(`<loc>${absolute(page.path)}</loc>`);
					expect(url).not.toMatch(/<loc>[^<]*[#?]/);
					const date = url.match(/<lastmod>(.*)<\/lastmod>/)?.[1];
					expect(date).toBe(lastmod[key]);
					if (date) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
				}
			},
		),
		RUNS,
	);
});

// Feature: seo, Property 4: absolute stays inside the base
test("Property 4: absolute stays inside the base", () => {
	fc.assert(
		fc.property(pathArb, (path) => {
			expect(absolute(path).startsWith(ORIGIN + BASE)).toBe(true);
		}),
		RUNS,
	);
	fc.assert(
		fc.property(
			pathArb,
			fc.constantFrom("#", "?"),
			fc.string(),
			(path, mark, rest) => {
				expect(() => absolute(`${path}${mark}${rest}`)).toThrow();
			},
		),
		RUNS,
	);
});
