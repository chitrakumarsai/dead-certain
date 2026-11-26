// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
	absolute,
	bgBase,
	type HeadTag,
	type PageKey,
	pageTags,
	robotsTxt,
	sitemapXml,
} from "../packages/ui/src/site.ts";
import { checkPage, checkRobots, checkSitemap } from "./seo-check.ts";
import { render } from "./seo-testing.ts";

const colours = bgBase(
	readFileSync(new URL("../packages/ui/tokens.css", import.meta.url), "utf8"),
);

const ok = { colours, exists: () => true };
const page = (key: PageKey, tags = pageTags(key, colours), body?: string) =>
	checkPage(render(tags, body), key, "index.html", ok);
const rules = (items: { rule: string }[]) => items.map((i) => i.rule);
const without = (key: PageKey, drop: (t: HeadTag) => boolean) =>
	pageTags(key, colours).filter((t) => !drop(t));
const swap = (key: PageKey, pick: (t: HeadTag) => boolean, attrs: object) =>
	pageTags(key, colours).map((t) =>
		pick(t) ? { ...t, attrs: { ...t.attrs, ...attrs } } : t,
	);

test("a page as the builder writes it passes", () => {
	for (const key of [
		"home",
		"claimCheck",
		"preFlight",
		"kit",
		"notFound",
	] as const)
		expect(page(key), key).toEqual([]);
});

test("each failure of requirement 8.2 is reported with its rule", () => {
	expect(
		rules(
			page(
				"home",
				without("home", (t) => t.tag === "title"),
			),
		),
	).toContain("title");
	const doubled = [
		...pageTags("home", colours),
		pageTags("home", colours)[1] as HeadTag,
	];
	expect(rules(page("home", doubled))).toContain("duplicated tag");
	expect(
		rules(
			page(
				"claimCheck",
				swap("claimCheck", (t) => t.attrs.name === "description", {
					content: "Something else",
				}),
			),
		),
	).toContain("wrong tag");
	expect(
		rules(
			page(
				"preFlight",
				without("preFlight", (t) => t.attrs.property === "og:url"),
			),
		),
	).toContain("missing tag");
	expect(
		rules(
			page(
				"home",
				swap("home", (t) => t.attrs.name === "robots", { content: "noindex" }),
			),
		),
	).toContain("wrong tag");
	// A canonical on a noindex page.
	expect(
		rules(
			page("kit", [
				...pageTags("kit", colours),
				{ tag: "link", attrs: { rel: "canonical", href: absolute("kit/") } },
			]),
		),
	).toContain("unexpected tag");
	// A canonical with a fragment.
	expect(
		rules(
			page(
				"home",
				swap("home", (t) => t.attrs.rel === "canonical", {
					href: `${absolute("")}#/`,
				}),
			),
		),
	).toContain("canonical");
	// No lang attribute.
	expect(
		rules(
			checkPage(
				render(pageTags("kit", colours)).replace(' lang="en"', ""),
				"kit",
				"kit/index.html",
				ok,
			),
		),
	).toContain("lang");
	// A link that does not resolve to a built file.
	expect(
		rules(
			checkPage(
				render(pageTags("kit", colours), '<a href="nowhere/">x</a>'),
				"kit",
				"kit/index.html",
				{
					colours,
					exists: (p: string) => p !== "kit/nowhere/index.html",
				},
			),
		),
	).toContain("link");
});

test("JSON-LD that does not parse, names a Person or points off-site is reported", () => {
	const ld = (children: string) =>
		pageTags("claimCheck", colours).map((t) =>
			t.tag === "script" ? { ...t, children } : t,
		);
	expect(rules(page("claimCheck", ld("{not json")))).toContain("json-ld");
	expect(
		rules(page("claimCheck", ld('{"@type":"Person","name":"Someone"}'))),
	).toContain("json-ld");
	expect(
		rules(
			page(
				"claimCheck",
				ld('{"@type":"WebApplication","url":"https://example.com/"}'),
			),
		),
	).toContain("json-ld");
});

test("an unknown page is reported by name", () => {
	expect(
		rules(checkPage("<html></html>", null, "loan-check/index.html", ok)),
	).toEqual(["not in PAGES"]);
});

test("the sitemap must list exactly the indexable pages, each with a built file", () => {
	expect(checkSitemap(sitemapXml({}), () => true)).toEqual([]);
	const short = sitemapXml({}).replace(
		/<url><loc>[^<]*pre-flight[^<]*<\/loc><\/url>\n/,
		"",
	);
	expect(rules(checkSitemap(short, () => true))).toEqual(["sitemap"]);
	expect(
		rules(checkSitemap(sitemapXml({}), (p) => p !== "claim-check/index.html")),
	).toEqual(["sitemap"]);
});

test("robots.txt must name the sitemap", () => {
	expect(checkRobots(robotsTxt())).toEqual([]);
	expect(rules(checkRobots("User-agent: *\nAllow: /\n"))).toEqual([
		"robots.txt",
	]);
});
