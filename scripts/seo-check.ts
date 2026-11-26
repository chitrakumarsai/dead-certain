// pnpm seo:check (seo requirement 8). Reads the built site and fails on any page
// whose head disagrees with PAGES. Runs under Node 22 with --experimental-strip-types.
// @ts-expect-error TS2591: no type definitions for node:fs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
	absolute,
	BASE,
	bgBase,
	type HeadTag,
	ORIGIN,
	PAGES,
	type PageKey,
	pageKeyFor,
	pageTags,
	REPO,
	type ThemeColours,
} from "../packages/ui/src/site.ts";

export interface Item {
	page: string;
	rule: string;
	detail: string;
}

export interface CheckOptions {
	colours: ThemeColours;
	/** Whether a built file exists, by its path relative to BASE. */
	exists: (builtPath: string) => boolean;
}

const decode = (text: string): string =>
	text
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");

const attrsOf = (source: string): Record<string, string> =>
	Object.fromEntries(
		[...source.matchAll(/([^\s=/"']+)(?:\s*=\s*"([^"]*)")?/g)].map((m) => [
			m[1] as string,
			decode(m[2] ?? ""),
		]),
	);

/** The title, meta, link and script tags of a page, in the fixed shape the build writes. */
export function parseTags(html: string): HeadTag[] {
	return [
		...html.matchAll(
			/<(title|script)\b([^>]*)>([\s\S]*?)<\/\1>|<(meta|link)\b([^>]*?)\/?>/g,
		),
	].map((m) =>
		m[1]
			? {
					tag: m[1] as HeadTag["tag"],
					attrs: attrsOf(m[2] ?? ""),
					children: m[3] ?? "",
				}
			: { tag: m[4] as HeadTag["tag"], attrs: attrsOf(m[5] ?? "") },
	);
}

/** The identity of a tag the build owns, or null for one it does not (preloads, scripts with a src). */
function identity(t: HeadTag): string | null {
	if (t.tag === "title") return "title";
	if (t.tag === "script")
		return t.attrs.type === "application/ld+json" ? "json-ld" : null;
	if (t.tag === "link")
		return ["canonical", "manifest"].includes(t.attrs.rel ?? "")
			? `link ${t.attrs.rel}`
			: null;
	const id = t.attrs.name ?? t.attrs.property ?? "";
	if (
		/^(description|robots|theme-color)$/.test(id) ||
		/^(og|twitter):/.test(id)
	)
		return t.attrs.media ? `${id} ${t.attrs.media}` : id;
	return null;
}

const value = (t: HeadTag): string =>
	t.tag === "title" || t.tag === "script"
		? (t.children ?? "")
		: t.tag === "link"
			? (t.attrs.href ?? "")
			: (t.attrs.content ?? "");

/** Every URL string in a JSON-LD value. */
function urls(node: unknown): string[] {
	if (typeof node === "string") return /^https?:\/\//.test(node) ? [node] : [];
	if (Array.isArray(node)) return node.flatMap(urls);
	if (node && typeof node === "object")
		return Object.values(node).flatMap(urls);
	return [];
}

function hasPerson(node: unknown): boolean {
	if (Array.isArray(node)) return node.some(hasPerson);
	if (node && typeof node === "object")
		return (
			(node as Record<string, unknown>)["@type"] === "Person" ||
			Object.values(node).some(hasPerson)
		);
	return false;
}

function checkJsonLd(actual: string, expected: string): string | null {
	let doc: unknown;
	try {
		doc = JSON.parse(actual);
	} catch {
		return "does not parse";
	}
	if (hasPerson(doc)) return "names a Person";
	const off = urls(doc).find(
		(u) =>
			!u.startsWith(ORIGIN + BASE) &&
			!u.startsWith(REPO) &&
			!u.startsWith("https://schema.org") &&
			!u.startsWith("https://opensource.org/"),
	);
	if (off) return `points off the site: ${off}`;
	if (actual.includes("<")) return "holds a raw <";
	if (JSON.stringify(doc) !== JSON.stringify(JSON.parse(expected)))
		return "differs from PAGES";
	return null;
}

/** The built file an internal URL names, relative to BASE, or null for an external one. */
function builtFileOf(ref: string, pageUrl: string): string | null {
	if (/^(data:|mailto:|#)/.test(ref)) return null;
	const url = new URL(ref, pageUrl);
	if (url.origin !== ORIGIN) return null;
	if (!url.pathname.startsWith(BASE)) return `outside ${BASE}: ${url.pathname}`;
	const path = decodeURIComponent(url.pathname.slice(BASE.length));
	return path === "" || path.endsWith("/") ? `${path}index.html` : path;
}

/** The failures of one built page (requirement 8.2). */
export function checkPage(
	html: string,
	key: PageKey | null,
	builtPath: string,
	options: CheckOptions,
): Item[] {
	const items: Item[] = [];
	const fail = (rule: string, detail: string) =>
		items.push({ page: builtPath, rule, detail });
	if (!key) {
		fail("not in PAGES", "add an entry to PAGES in packages/ui/src/site.ts");
		return items;
	}
	if (!/<html\b[^>]*\slang="[^"]+"/.test(html))
		fail("lang", "the html element has no lang");

	const actual = parseTags(html);
	const expected = pageTags(key, options.colours);
	const expectedIds = new Set(expected.map(identity));
	for (const want of expected) {
		const id = identity(want) as string;
		const found = actual.filter((t) => identity(t) === id);
		if (found.length === 0) {
			fail(id === "title" ? "title" : "missing tag", id);
			continue;
		}
		if (found.length > 1) fail("duplicated tag", `${id} ×${found.length}`);
		const got = found[0] as HeadTag;
		if (id === "json-ld") {
			const problem = checkJsonLd(value(got), value(want));
			if (problem) fail("json-ld", problem);
		} else if (value(got) !== value(want)) {
			fail(id === "title" ? "title" : "wrong tag", `${id}: "${value(got)}"`);
		}
	}
	for (const t of actual) {
		const id = identity(t);
		if (id && !expectedIds.has(id)) fail("unexpected tag", id);
	}

	const page = PAGES[key];
	if (page.title.length > 60) fail("title", "over 60 characters");
	if (page.description.length > 155) fail("description", "over 155 characters");
	for (const t of actual.filter((t) => t.attrs.rel === "canonical")) {
		const href = t.attrs.href ?? "";
		if (!href.startsWith(ORIGIN + BASE) || /[#?]/.test(href))
			fail("canonical", `not absolute or holds a fragment: ${href}`);
	}

	const pageUrl = absolute(builtPath);
	for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
		const file = builtFileOf(decode(m[1] as string), pageUrl);
		if (file?.startsWith("outside ")) fail("link", file);
		else if (file && !options.exists(file))
			fail("link", `${m[1]} has no built file`);
	}
	return items;
}

/** The sitemap lists exactly the indexable pages, each with a built file (requirement 8.3). */
export function checkSitemap(
	xml: string,
	exists: (builtPath: string) => boolean,
): Item[] {
	const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(
		(m) => m[1] as string,
	);
	const want = Object.values(PAGES)
		.filter((p) => p.index)
		.map((p) => absolute(p.path));
	const items: Item[] = [];
	if ([...locs].sort().join() !== [...want].sort().join())
		items.push({
			page: "sitemap.xml",
			rule: "sitemap",
			detail: `lists ${locs.join(", ")}`,
		});
	for (const loc of locs) {
		const file = builtFileOf(loc, absolute(""));
		if (!file || !exists(file))
			items.push({
				page: "sitemap.xml",
				rule: "sitemap",
				detail: `${loc} has no built file`,
			});
	}
	return items;
}

export function checkRobots(text: string): Item[] {
	return text.includes(`Sitemap: ${absolute("sitemap.xml")}`)
		? []
		: [{ page: "robots.txt", rule: "robots.txt", detail: "no Sitemap line" }];
}

/** The Built_Site: the site's dist, with each app's dist mounted at its folder, as CI copies them. */
function builtFiles(root: URL): Map<string, URL> {
	const files = new Map<string, URL>();
	const mount = (dist: URL, prefix: string, skip: string[]) => {
		for (const rel of readdirSync(dist, { recursive: true }) as string[]) {
			const path = `${prefix}${rel.split("\\").join("/")}`;
			if (skip.some((s) => path.startsWith(s))) continue;
			files.set(path, new URL(rel, dist));
		}
	};
	const apps = Object.values(PAGES)
		.map((p) => p.path)
		.filter((path) => /^[\w-]+\/$/.test(path))
		.filter((path) => existsSync(new URL(`apps/${path}dist/`, root)));
	mount(new URL("apps/site/dist/", root), "", apps);
	for (const path of apps) mount(new URL(`apps/${path}dist/`, root), path, []);
	return files;
}

function main(): number {
	const root = new URL("../", import.meta.url);
	const colours = bgBase(
		readFileSync(new URL("packages/ui/tokens.css", root), "utf8") as string,
	);
	const files = builtFiles(root);
	const exists = (path: string) => files.has(path);
	const read = (path: string) =>
		readFileSync(files.get(path) as URL, "utf8") as string;
	const items: Item[] = [];
	for (const path of [...files.keys()]
		.filter((p) => p.endsWith(".html"))
		.sort())
		items.push(
			...checkPage(read(path), pageKeyFor(path), path, { colours, exists }),
		);
	items.push(
		...(exists("sitemap.xml")
			? checkSitemap(read("sitemap.xml"), exists)
			: [{ page: "sitemap.xml", rule: "sitemap", detail: "missing" }]),
		...(exists("robots.txt")
			? checkRobots(read("robots.txt"))
			: [{ page: "robots.txt", rule: "robots.txt", detail: "missing" }]),
	);
	for (const i of items) console.error(`${i.page}: ${i.rule}: ${i.detail}`);
	const pages = [...files.keys()].filter((p) => p.endsWith(".html")).length;
	if (items.length === 0)
		console.log(`seo:check: ${pages} pages, the sitemap and robots.txt pass.`);
	return items.length === 0 ? 0 : 1;
}

type Proc = { argv: string[]; exitCode?: number };
const proc = (globalThis as unknown as { process?: Proc }).process;
if (
	proc?.argv[1] &&
	import.meta.url.endsWith(proc.argv[1].split("/").pop() ?? "\0")
)
	proc.exitCode = main();
