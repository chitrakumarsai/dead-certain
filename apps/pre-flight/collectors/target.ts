import type { Target } from "./types";

export type ParseResult =
	| { ok: true; target: Target }
	| { ok: false; reason: "empty" | "not_github" };

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;
const HOSTS = new Set(["github.com", "www.github.com"]);
const NOT_GITHUB: ParseResult = { ok: false, reason: "not_github" };

/** The two segments, with a .git suffix dropped, if they make a valid Target (2.4). */
function validTarget(
	owner: string | undefined,
	raw: string | undefined,
): ParseResult {
	const name = raw?.endsWith(".git") ? raw.slice(0, -4) : raw;
	if (owner === undefined || name === undefined) return NOT_GITHUB;
	if (!OWNER.test(owner) || !NAME.test(name) || name === "." || name === "..")
		return NOT_GITHUB;
	return { ok: true, target: { owner, name } };
}

/** The first two path segments of a github.com URL, or nothing for any other host. */
function fromUrl(text: string): ParseResult {
	const withScheme = text.includes("://") ? text : `https://${text}`;
	// The authority as typed, so a port, credentials or a look-alike host never pass,
	// even where the URL parser would drop a default port.
	const authority = /^https?:\/\/([^/?#\\]*)/i.exec(withScheme)?.[1];
	if (authority === undefined || !HOSTS.has(authority.toLowerCase()))
		return NOT_GITHUB;
	let path: string;
	try {
		path = new URL(withScheme).pathname;
	} catch {
		return NOT_GITHUB;
	}
	const [, owner, name] = path.split("/");
	return validTarget(owner, name);
}

/** Reads owner/name or a GitHub URL. Never throws and never reads the network (2.3 to 2.6). */
export function parseTarget(input: string): ParseResult {
	const text = input.trim();
	if (text === "") return { ok: false, reason: "empty" };
	if (/^(?:www\.)?github\.com\//i.test(text) || text.includes("://"))
		return fromUrl(text);
	const parts = text.split("/");
	return parts.length === 2 ? validTarget(parts[0], parts[1]) : NOT_GITHUB;
}
