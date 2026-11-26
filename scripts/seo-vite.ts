// @ts-expect-error TS2591: no type definitions for node:child_process
import { execFileSync } from "node:child_process";
// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:url
import { fileURLToPath } from "node:url";
import {
	BASE,
	bgBase,
	type PageKey,
	pageKeyFor,
	pageTags,
	robotsTxt,
	sitemapXml,
	type ThemeColours,
	webManifest,
} from "../packages/ui/src/site.ts";

const REPO_ROOT = new URL("../", import.meta.url);

/** The folders whose last commit dates a page in the sitemap (requirement 5.2). */
const SOURCES: Partial<Record<PageKey, string[]>> = {
	home: ["apps/site/src/landing", "apps/site/index.html"],
	claimCheck: [
		"apps/claim-check/src",
		"apps/claim-check/kb",
		"apps/claim-check/rulebook",
		"apps/claim-check/index.html",
	],
	preFlight: [
		"apps/pre-flight/src",
		"apps/pre-flight/kb",
		"apps/pre-flight/rulebook",
		"apps/pre-flight/index.html",
	],
};

/** Each page's last commit date, or nothing in a shallow clone, where the date would be wrong. */
export function lastmods(
	git: (args: string[]) => string,
): Partial<Record<PageKey, string>> {
	try {
		if (git(["rev-parse", "--is-shallow-repository"]).trim() === "true")
			return {};
		const out: Partial<Record<PageKey, string>> = {};
		for (const [key, folders] of Object.entries(SOURCES)) {
			const date = git(["log", "-1", "--format=%cs", "--", ...folders]).trim();
			if (/^\d{4}-\d{2}-\d{2}$/.test(date)) out[key as PageKey] = date;
		}
		return out;
	} catch {
		// No git, or not a repository: the sitemap goes out without dates.
		return {};
	}
}

const git = (args: string[]): string =>
	execFileSync("git", args, {
		cwd: fileURLToPath(REPO_ROOT),
		encoding: "utf8",
	}) as string;

const colours = (): ThemeColours =>
	bgBase(
		readFileSync(
			new URL("packages/ui/tokens.css", REPO_ROOT),
			"utf8",
		) as string,
	);

/** The tags the plugin owns, so a page never carries two (requirement 4.1). */
export const stripOwned = (html: string): string =>
	html.replace(
		/^[ \t]*(<title>[\s\S]*?<\/title>|<meta\s+(name="(description|robots|theme-color|twitter:[^"]*)"|property="og:[^"]*")[^>]*>|<link\s+rel="(canonical|manifest)"[^>]*>)[ \t]*\r?\n/gm,
		"",
	);

/** The part of Vite's Plugin type this plugin uses; scripts/ cannot resolve "vite" itself. */
interface SeoPlugin {
	name: string;
	configResolved(config: { base: string }): void;
	transformIndexHtml(
		html: string,
		ctx: { path: string },
	):
		| string
		| {
				html: string;
				tags: {
					tag: string;
					attrs: Record<string, string>;
					children?: string;
					injectTo: "head";
				}[];
		  };
	generateBundle(this: {
		emitFile(file: { type: "asset"; fileName: string; source: string }): string;
	}): void;
}

/**
 * Writes each page's head from PAGES (seo requirement 4), each app's manifest,
 * and on the site build sitemap.xml and robots.txt (requirement 5).
 */
export function seoHead(): SeoPlugin {
	let prefix = "";
	return {
		name: "dead-certain:seo-head",
		configResolved(config) {
			if (!config.base.startsWith(BASE))
				throw new Error(`base ${config.base} is not under ${BASE}`);
			prefix = config.base.slice(BASE.length);
		},
		transformIndexHtml(html, ctx) {
			const key = pageKeyFor(`${prefix}${ctx.path.replace(/^\//, "")}`);
			// shortcut: an app made by pnpm new-app has no PAGES entry and keeps its
			// own title; pnpm seo:check reports it until the entry is added.
			if (!key) return html;
			return {
				html: stripOwned(html),
				tags: pageTags(key, colours()).map((t) => ({
					tag: t.tag,
					attrs: t.attrs,
					children: t.children,
					injectTo: "head" as const,
				})),
			};
		},
		generateBundle() {
			const own = pageKeyFor(`${prefix}index.html`);
			const c = colours();
			if (own && pageTags(own, c).some((t) => t.attrs.rel === "manifest"))
				this.emitFile({
					type: "asset",
					fileName: "manifest.webmanifest",
					source: webManifest(own, c.dark),
				});
			if (prefix !== "") return;
			this.emitFile({
				type: "asset",
				fileName: "sitemap.xml",
				source: sitemapXml(lastmods(git)),
			});
			this.emitFile({
				type: "asset",
				fileName: "robots.txt",
				source: robotsTxt(),
			});
		},
	};
}
