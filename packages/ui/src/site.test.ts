// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
	absolute,
	BASE,
	bgBase,
	headTags,
	jsonLd,
	ORIGIN,
	PAGES,
	type PageKey,
	pageKeyFor,
	pageTags,
	REPO,
	robotsTxt,
	sitemapXml,
	webManifest,
} from "./site";

const KEYS = Object.keys(PAGES) as PageKey[];
const tokens: string = readFileSync(
	new URL("../tokens.css", import.meta.url),
	"utf8",
);

test("the owner's strings, within their limits and unique (requirements 2.4, 3.1)", () => {
	expect(PAGES.home.title).toBe(
		"Dead Certain. LLMs guess. The dead are certain.",
	);
	expect(PAGES.preFlight.description).not.toMatch(/\d/);
	for (const key of KEYS) {
		expect(PAGES[key].title.length, key).toBeLessThanOrEqual(60);
		expect(PAGES[key].description.length, key).toBeLessThanOrEqual(155);
		expect(`${PAGES[key].title}${PAGES[key].description}`).not.toMatch(/!/);
	}
	expect(new Set(KEYS.map((k) => PAGES[k].title)).size).toBe(KEYS.length);
	expect(new Set(KEYS.map((k) => PAGES[k].description)).size).toBe(KEYS.length);
	expect(KEYS.filter((k) => PAGES[k].index)).toEqual([
		"home",
		"claimCheck",
		"preFlight",
	]);
});

test("absolute stays under the base and refuses a hash, a query or a climb (requirement 1.4)", () => {
	expect(absolute("")).toBe(`${ORIGIN}${BASE}`);
	expect(absolute("claim-check/")).toBe(`${ORIGIN}${BASE}claim-check/`);
	for (const bad of [
		"#/?r=x",
		"claim-check/#/report",
		"?repo=a/b",
		"../",
		"/x",
	])
		expect(() => absolute(bad), bad).toThrow();
});

test("built paths map to their page, and an unknown one to null", () => {
	expect(pageKeyFor("index.html")).toBe("home");
	expect(pageKeyFor("404.html")).toBe("notFound");
	expect(pageKeyFor("claim-check/index.html")).toBe("claimCheck");
	expect(pageKeyFor("pre-flight/index.html")).toBe("preFlight");
	expect(pageKeyFor("kit/index.html")).toBe("kit");
	expect(pageKeyFor("kit/shell.html")).toBe("kit");
	expect(pageKeyFor("loan-check/index.html")).toBeNull();
	expect(pageKeyFor("claim-check/other.html")).toBeNull();
});

const attr = (key: PageKey, id: string): string | undefined =>
	headTags(key).find(
		(t) => t.attrs.name === id || t.attrs.property === id || t.attrs.rel === id,
	)?.attrs[id === "canonical" ? "href" : "content"];

test("an indexable page gets index, a canonical, and the Open Graph and Twitter text tags", () => {
	const tags = headTags("claimCheck");
	expect(tags.filter((t) => t.tag === "title")).toEqual([
		{ tag: "title", attrs: {}, children: PAGES.claimCheck.title },
	]);
	expect(attr("claimCheck", "robots")).toBe("index, follow");
	expect(attr("claimCheck", "canonical")).toBe(absolute("claim-check/"));
	expect(attr("claimCheck", "og:url")).toBe(absolute("claim-check/"));
	expect(attr("claimCheck", "og:type")).toBe("website");
	expect(attr("claimCheck", "og:site_name")).toBe("Dead Certain");
	expect(attr("claimCheck", "og:locale")).toBe("en");
	expect(attr("claimCheck", "twitter:card")).toBe("summary_large_image");
	expect(attr("claimCheck", "twitter:description")).toBe(
		PAGES.claimCheck.description,
	);
	// Task 8 sets ogImage; until then no image tag is written.
	expect(tags.some((t) => /image/.test(t.attrs.property ?? ""))).toBe(false);
});

test("kit and notFound are noindex, with no canonical and no Open Graph or Twitter tag", () => {
	for (const key of ["kit", "notFound"] as const) {
		expect(attr(key, "robots")).toBe("noindex, nofollow");
		expect(
			headTags(key).filter(
				(t) =>
					t.attrs.rel === "canonical" ||
					/^(og|twitter):/.test(t.attrs.property ?? t.attrs.name ?? ""),
			),
		).toEqual([]);
	}
});

test("theme colours come from --bg-base in tokens.css, dark and light", () => {
	const colours = bgBase(tokens);
	expect(colours.dark).toMatch(/^#[0-9a-f]{6}$/i);
	expect(colours.light).toMatch(/^#[0-9a-f]{6}$/i);
	expect(colours.dark).not.toBe(colours.light);
	expect(() => bgBase(":root { --x: 1; }")).toThrow();
});

test("pageTags adds the two theme colours, the manifest on an app, and the JSON-LD", () => {
	const colours = bgBase(tokens);
	const app = pageTags("preFlight", colours);
	expect(
		app.filter((t) => t.attrs.name === "theme-color").map((t) => t.attrs),
	).toEqual([
		{
			name: "theme-color",
			media: "(prefers-color-scheme: dark)",
			content: colours.dark,
		},
		{
			name: "theme-color",
			media: "(prefers-color-scheme: light)",
			content: colours.light,
		},
	]);
	expect(app.find((t) => t.attrs.rel === "manifest")?.attrs.href).toBe(
		`${BASE}pre-flight/manifest.webmanifest`,
	);
	expect(app.filter((t) => t.tag === "script")).toHaveLength(1);
	expect(
		pageTags("home", colours).some((t) => t.attrs.rel === "manifest"),
	).toBe(false);
	expect(pageTags("kit", colours).some((t) => t.tag === "script")).toBe(false);
});

type Node = Record<string, unknown> & { "@type": string };
const graph = (key: PageKey): Node[] => {
	const doc = JSON.parse(jsonLd(key) as string);
	return doc["@graph"] ?? [doc];
};

test("home JSON-LD: an Organization that authors a WebSite and a SoftwareSourceCode (requirement 6.1)", () => {
	const nodes = graph("home");
	expect(nodes.map((n) => n["@type"]).sort()).toEqual([
		"Organization",
		"SoftwareSourceCode",
		"WebSite",
	]);
	const org = nodes.find((n) => n["@type"] === "Organization") as Node;
	expect(org).toMatchObject({ name: "Dead Certain", sameAs: [REPO] });
	const code = nodes.find((n) => n["@type"] === "SoftwareSourceCode") as Node;
	expect(code).toMatchObject({
		codeRepository: REPO,
		programmingLanguage: "TypeScript",
		author: { "@id": org["@id"] },
	});
	expect(nodes.find((n) => n["@type"] === "WebSite")).toMatchObject({
		url: absolute(""),
		publisher: { "@id": org["@id"] },
	});
	for (const n of nodes) expect(n["@id"]).toMatch(/^https:\/\//);
});

test("app JSON-LD: one WebApplication by the same Organization; none on kit or notFound (requirement 6.2)", () => {
	const orgId = (
		graph("home").find((n) => n["@type"] === "Organization") as Node
	)["@id"];
	for (const [key, category] of [
		["claimCheck", "FinanceApplication"],
		["preFlight", "DeveloperApplication"],
	] as const) {
		expect(graph(key)).toEqual([
			{
				"@context": "https://schema.org",
				"@type": "WebApplication",
				name: PAGES[key].name,
				url: absolute(PAGES[key].path),
				description: PAGES[key].description,
				applicationCategory: category,
				operatingSystem: "Any",
				browserRequirements: "Requires JavaScript",
				isAccessibleForFree: true,
				author: { "@id": orgId },
			},
		]);
	}
	expect(jsonLd("kit")).toBeNull();
	expect(jsonLd("notFound")).toBeNull();
	for (const key of KEYS) expect(jsonLd(key) ?? "").not.toMatch(/Person|</);
});

test("the sitemap lists the indexable pages with absolute URLs and optional dates (requirement 5.1)", () => {
	const xml = sitemapXml({ home: "2026-11-26" });
	expect(xml).toContain(
		`<url><loc>${absolute("")}</loc><lastmod>2026-11-26</lastmod></url>`,
	);
	expect(xml).toContain(`<url><loc>${absolute("claim-check/")}</loc></url>`);
	expect(xml).toContain(`<url><loc>${absolute("pre-flight/")}</loc></url>`);
	expect(xml.match(/<url>/g)).toHaveLength(3);
	expect(xml).not.toContain("kit");
	expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
});

test("robots.txt allows everything and names the sitemap (requirement 5.3)", () => {
	expect(robotsTxt()).toMatch(/^# /);
	expect(robotsTxt()).toContain("User-agent: *\nAllow: /\n");
	expect(robotsTxt()).toContain(`Sitemap: ${absolute("sitemap.xml")}\n`);
});

test("an app's manifest: its name, start and scope at its path, display browser, the colour given", () => {
	expect(JSON.parse(webManifest("claimCheck", "#000000"))).toEqual({
		name: "Claim Check",
		short_name: "Claim Check",
		start_url: `${BASE}claim-check/`,
		scope: `${BASE}claim-check/`,
		display: "browser",
		theme_color: "#000000",
		background_color: "#000000",
	});
	expect(() => webManifest("home", "#000000")).toThrow();
});
