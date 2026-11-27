// Search metadata for every built page (seo spec, requirement 2). Pure, imports
// nothing, and is not part of the kit's public index: build scripts import it by
// relative path. A custom domain changes ORIGIN and BASE only.

export const ORIGIN = "https://chitrakumarsai.github.io";
export const BASE = "/dead-certain/";
export const REPO = "https://github.com/chitrakumarsai/dead-certain";

export interface PageSeo {
	/** Relative to BASE, ending in "/" or a file name; "" is the home page. Never "#" or "?". */
	path: string;
	/** The page's own name, for structured data and manifests. */
	name: string;
	title: string;
	description: string;
	index: boolean;
	/** Relative to BASE; written by pnpm og, with ogAlt equal to og.json's alt. */
	ogImage?: string;
	ogAlt?: string;
}

const ENTRIES = {
	home: {
		path: "",
		name: "Dead Certain",
		title: "Dead Certain. LLMs guess. The dead are certain.",
		description:
			"A model drafts the rules once. A small engine decides every verdict in your browser and shows the proof, clause by clause.",
		index: true,
		ogImage: "og/home.png",
		ogAlt:
			"The Dead Certain wordmark and tagline beside a sample verdict, ₹1,32,000 of ₹2,10,000 will be paid, with its proof.",
	},
	claimCheck: {
		path: "claim-check/",
		name: "Claim Check",
		title: "Claim Check: what a health policy pays on a hospital bill",
		description:
			"Answer a few questions and see the amount a sample health policy pays, each deduction, and the clause behind it.",
		index: true,
		ogImage: "og/claim-check.png",
		ogAlt:
			"A sample claim: ₹1,32,000 of ₹2,10,000 will be paid. The room rent over the limit line and its clause are marked.",
	},
	preFlight: {
		path: "pre-flight/",
		name: "Pre-Flight",
		title: "Pre-Flight: check a GitHub repository before you submit",
		description:
			"Enter a public repository and get a pass or fail for each checklist item, with the rule and evidence behind it. Runs in your browser.",
		index: true,
		ogImage: "og/pre-flight.png",
		ogAlt:
			"Five Pre-Flight checks on a sample repository: three passed and two failed, each with its rule.",
	},
	kit: {
		path: "kit/",
		name: "Dead Certain kit",
		title: "Dead Certain kit",
		description: "The component gallery of the Dead Certain design system.",
		index: false,
	},
	notFound: {
		path: "404.html",
		name: "Page not found",
		title: "Page not found. Dead Certain",
		description: "There is nothing at this address.",
		index: false,
	},
	// new-app:pages
} satisfies Record<string, PageSeo>;

/** Derived, so pnpm new-app adds a page by adding its entry alone (app-template 13.4). */
export type PageKey = keyof typeof ENTRIES;
export const PAGES: Record<PageKey, PageSeo> = ENTRIES;

/** The two apps, with their schema.org category. */
const APPS: Partial<Record<PageKey, string>> = {
	claimCheck: "FinanceApplication",
	preFlight: "DeveloperApplication",
};

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

/** The absolute URL of a path under BASE. Throws on a hash, a query or a path that leaves BASE. */
export function absolute(path: string): string {
	if (/[#?]/.test(path)) throw new Error(`"${path}" holds a hash or a query`);
	const url = new URL(path, ORIGIN + BASE).href;
	if (!url.startsWith(ORIGIN + BASE))
		throw new Error(`"${path}" leaves ${BASE}`);
	return url;
}

/** The page a built HTML file (relative to BASE) belongs to, or null when it has none. */
export function pageKeyFor(builtPath: string): PageKey | null {
	// Every fixture page under kit/ is the noindex gallery.
	if (builtPath.startsWith("kit/") && builtPath.endsWith(".html")) return "kit";
	const keys = Object.keys(PAGES) as PageKey[];
	return (
		keys.find((key) => {
			const { path } = PAGES[key];
			return path === builtPath || `${path}index.html` === builtPath;
		}) ?? null
	);
}

export interface HeadTag {
	tag: "title" | "meta" | "link" | "script";
	attrs: Record<string, string>;
	children?: string;
}

const meta = (name: string, content: string): HeadTag => ({
	tag: "meta",
	attrs: { name, content },
});
const property = (name: string, content: string): HeadTag => ({
	tag: "meta",
	attrs: { property: name, content },
});

/** Title, description, robots, and for an indexable page the canonical, Open Graph and Twitter tags. */
export function headTags(key: PageKey): HeadTag[] {
	return headTagsFor(PAGES[key]);
}

/** headTags for any page record; the build only ever passes PAGES entries. */
export function headTagsFor(page: PageSeo): HeadTag[] {
	if (page.title.length > TITLE_MAX)
		throw new Error(`${page.name}: the title is over ${TITLE_MAX} characters`);
	if (page.description.length > DESCRIPTION_MAX)
		throw new Error(`${page.name}: the description is over ${DESCRIPTION_MAX}`);
	const base: HeadTag[] = [
		{ tag: "title", attrs: {}, children: page.title },
		meta("description", page.description),
		meta("robots", page.index ? "index, follow" : "noindex, nofollow"),
	];
	if (!page.index) return base;
	const url = absolute(page.path);
	const image = page.ogImage
		? [
				property("og:image", absolute(page.ogImage)),
				property("og:image:width", "1200"),
				property("og:image:height", "630"),
				property("og:image:alt", page.ogAlt ?? ""),
			]
		: [];
	const twitterImage = page.ogImage
		? [
				meta("twitter:image", absolute(page.ogImage)),
				meta("twitter:image:alt", page.ogAlt ?? ""),
			]
		: [];
	return [
		...base,
		{ tag: "link", attrs: { rel: "canonical", href: url } },
		property("og:title", page.title),
		property("og:description", page.description),
		property("og:type", "website"),
		property("og:url", url),
		property("og:site_name", "Dead Certain"),
		property("og:locale", "en"),
		...image,
		meta("twitter:card", "summary_large_image"),
		meta("twitter:title", page.title),
		meta("twitter:description", page.description),
		...twitterImage,
	];
}

export interface ThemeColours {
	dark: string;
	light: string;
}

/** The declarations of the first rule whose prelude is exactly `selector`. */
function block(css: string, selector: string): Map<string, string> {
	const start = css.indexOf(`${selector} {`);
	if (start < 0) throw new Error(`tokens.css has no rule for ${selector}`);
	const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
	return new Map(
		[...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
			m[1] as string,
			(m[2] as string).trim(),
		]),
	);
}

/** `--bg-base` of the dark and light themes, read from tokens.css so no colour is written here. */
export function bgBase(tokensCss: string): ThemeColours {
	const root = block(tokensCss, ":root");
	const resolve = (value: string | undefined): string => {
		const ref = value?.match(/^var\((--[\w-]+)\)$/);
		if (ref) return resolve(root.get(ref[1] as string));
		if (!value) throw new Error("tokens.css has no --bg-base value");
		return value;
	};
	return {
		dark: resolve(root.get("--bg-base")),
		light: resolve(
			block(tokensCss, ':root[data-theme="light"]').get("--bg-base"),
		),
	};
}

const ORG_ID = `${absolute("")}#org`;

/** Serialised once; "<" is escaped so no value can close the script (requirement 6.3). */
export const serialise = (value: unknown): string =>
	JSON.stringify(value).replace(/</g, "\\u003c");

/** The page's structured data, or null for a page that carries none. */
export function jsonLd(key: PageKey): string | null {
	const page = PAGES[key];
	const category = APPS[key];
	if (key === "home") {
		const url = absolute(page.path);
		return serialise({
			"@context": "https://schema.org",
			"@graph": [
				{
					"@type": "Organization",
					"@id": ORG_ID,
					name: "Dead Certain",
					url,
					sameAs: [REPO],
				},
				{
					"@type": "WebSite",
					"@id": `${url}#site`,
					name: page.name,
					url,
					publisher: { "@id": ORG_ID },
				},
				{
					"@type": "SoftwareSourceCode",
					"@id": `${url}#code`,
					name: page.name,
					codeRepository: REPO,
					programmingLanguage: "TypeScript",
					license: "https://opensource.org/license/mit",
					author: { "@id": ORG_ID },
				},
			],
		});
	}
	return category ? serialise(appNode(page, category)) : null;
}

/** An app's WebApplication node, authored by the Organization. */
export function appNode(page: PageSeo, category: string): object {
	return {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		name: page.name,
		url: absolute(page.path),
		description: page.description,
		applicationCategory: category,
		operatingSystem: "Any",
		browserRequirements: "Requires JavaScript",
		isAccessibleForFree: true,
		// Inlined, so the page's data stands alone: the Organization node is on home only.
		author: { "@type": "Organization", "@id": ORG_ID, name: "Dead Certain" },
	};
}

/** The icon links every page carries, and the two PNGs each manifest lists (requirement 7.5). */
export const ICONS = {
	favicon: `${BASE}favicon.ico`,
	appleTouch: `${BASE}apple-touch-icon.png`,
	manifest: [
		{ src: `${BASE}icon-192.png`, sizes: "192x192", type: "image/png" },
		{ src: `${BASE}icon-512.png`, sizes: "512x512", type: "image/png" },
	],
} as const;

/** Every head tag the build writes for a page: headTags, theme colours, icons, the manifest link and the JSON-LD. */
export function pageTags(key: PageKey, colours: ThemeColours): HeadTag[] {
	const tags = [
		...headTags(key),
		{
			tag: "meta" as const,
			attrs: {
				name: "theme-color",
				media: "(prefers-color-scheme: dark)",
				content: colours.dark,
			},
		},
		{
			tag: "meta" as const,
			attrs: {
				name: "theme-color",
				media: "(prefers-color-scheme: light)",
				content: colours.light,
			},
		},
		{
			tag: "link" as const,
			attrs: { rel: "icon", href: ICONS.favicon, sizes: "32x32" },
		},
		{
			tag: "link" as const,
			attrs: { rel: "apple-touch-icon", href: ICONS.appleTouch },
		},
	];
	if (APPS[key])
		tags.push({
			tag: "link",
			attrs: {
				rel: "manifest",
				href: `${BASE}${PAGES[key].path}manifest.webmanifest`,
			},
		});
	const data = jsonLd(key);
	if (data)
		tags.push({
			tag: "script",
			attrs: { type: "application/ld+json" },
			children: data,
		});
	return tags;
}

/** An app's web manifest, with the two PNG icons. */
export function webManifest(key: PageKey, colour: string): string {
	if (!APPS[key]) throw new Error(`${key} is not an app`);
	const page = PAGES[key];
	const scope = `${BASE}${page.path}`;
	return `${JSON.stringify(
		{
			name: page.name,
			short_name: page.name,
			start_url: scope,
			scope,
			display: "browser",
			theme_color: colour,
			background_color: colour,
			icons: ICONS.manifest,
		},
		null,
		"\t",
	)}\n`;
}

/** One <url> per indexable page, with its YYYY-MM-DD lastmod when known. */
export function sitemapXml(
	lastmod: Partial<Record<string, string>>,
	pages: Record<string, PageSeo> = PAGES,
): string {
	const urls = Object.entries(pages)
		.filter(([, page]) => page.index)
		.map(([key, page]) => {
			const date = lastmod[key];
			return `<url><loc>${absolute(page.path)}</loc>${date ? `<lastmod>${date}</lastmod>` : ""}</url>`;
		});
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls,
		"</urlset>",
		"",
	].join("\n");
}

/** Read only at a host root, so inert under BASE until a custom domain (requirement 5.4). */
export function robotsTxt(): string {
	return [
		"# Crawlers read robots.txt only at the root of a host. Under a project path",
		"# it is inert; noindex is carried by each page's robots meta.",
		"User-agent: *",
		"Allow: /",
		`Sitemap: ${absolute("sitemap.xml")}`,
		"",
	].join("\n");
}
