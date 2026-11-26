import type { HeadTag } from "../packages/ui/src/site.ts";

/** Serialises tags the way Vite writes them (key="value", children as text) into a page, for the checker's tests. */
export function render(
	tags: readonly HeadTag[],
	body = "<h1>Page</h1>",
): string {
	const html = tags
		.map((t) => {
			const attrs = Object.entries(t.attrs)
				.map(([k, v]) => ` ${k}=${JSON.stringify(v)}`)
				.join("");
			return t.tag === "meta" || t.tag === "link"
				? `<${t.tag}${attrs}>`
				: `<${t.tag}${attrs}>${t.children ?? ""}</${t.tag}>`;
		})
		.join("\n");
	return `<!doctype html><html lang="en"><head>${html}</head><body>${body}</body></html>`;
}
