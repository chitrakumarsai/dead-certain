// Field checks and classification for the four GitHub responses (design:
// "Classification" and "Field checks"). Every string from GitHub is untrusted:
// each used field is read with a type guard, and a wrong type is unreadable,
// never coerced (3.18).

/** A response as the collector sees it: lower-case header names, the body as text. */
export interface RawResponse {
	readonly status: number;
	readonly headers: Readonly<Record<string, string>>;
	readonly body: string;
}

export type StepId = "metadata" | "tree" | "gitignore" | "readme";

export type CollectError =
	| { kind: "not_found" }
	| { kind: "rate_limited"; resetAt?: number }
	| { kind: "unreachable" }
	| { kind: "unreadable" };

export type Classified =
	| { kind: "ok" }
	| { kind: "absent" }
	| { kind: "empty" }
	| CollectError;

export interface Metadata {
	fullName: string;
	defaultBranch: string;
	private: boolean;
	archived: boolean;
	description: string | null;
	license: { spdxId: string | null } | null;
	size: number;
	pushedAt: string | null;
}

export interface TreeEntry {
	path: string;
	type: "blob" | "tree";
}

/** GitHub's own limit for a recursive tree. */
export const TREE_LIMIT = 100_000;
/** Bytes kept of .gitignore and the README (3.11). */
export const FILE_LIMIT = 65_536;
const PATH_LIMIT = 1_024;
const DESCRIPTION_LIMIT = 500;

/** A positive integer from a header, or undefined. */
function positiveInt(value: string | undefined): number | undefined {
	if (value === undefined || !/^\d+$/.test(value.trim())) return undefined;
	const n = Number(value.trim());
	return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

/** Sorts a response into ok, absent, empty or one of the errors (design rules 1, 2 and 4). */
export function classify(
	step: StepId,
	res: RawResponse,
	now: Date,
): Classified {
	const remaining = res.headers["x-ratelimit-remaining"]?.trim();
	const retryAfter = res.headers["retry-after"];
	if (
		res.status === 429 ||
		(res.status === 403 && (remaining === "0" || retryAfter !== undefined))
	) {
		const wait = positiveInt(retryAfter);
		const resetAt =
			positiveInt(res.headers["x-ratelimit-reset"]) ??
			(wait === undefined
				? undefined
				: Math.floor(now.getTime() / 1000) + wait);
		return resetAt === undefined
			? { kind: "rate_limited" }
			: { kind: "rate_limited", resetAt };
	}
	if (res.status >= 200 && res.status < 300) return { kind: "ok" };
	if (res.status === 404)
		return step === "metadata" ? { kind: "not_found" } : { kind: "absent" };
	if (res.status === 409 && step === "tree") return { kind: "empty" };
	return { kind: "unreadable" };
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
	typeof v === "object" && v !== null && !Array.isArray(v);

/** JSON from an untrusted body, or undefined. Deep nesting that overflows the stack is caught too. */
function readJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

/** False for a string with a lone surrogate, which encodeURIComponent would throw on. */
const wellFormed = (s: string): boolean =>
	!/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(
		s,
	);

const clip = (s: string, limit: number): string =>
	s.length > limit ? s.slice(0, limit) : s;
const stringOrNull = (v: unknown): v is string | null =>
	v === null || typeof v === "string";

export function parseMetadata(text: string): Metadata | null {
	const m = readJson(text);
	if (!isObj(m)) return null;
	const {
		full_name,
		default_branch,
		archived,
		description,
		license,
		size,
		pushed_at,
	} = m;
	if (typeof full_name !== "string" || typeof m.private !== "boolean")
		return null;
	if (
		typeof default_branch !== "string" ||
		default_branch === "" ||
		!wellFormed(default_branch)
	)
		return null;
	if (
		typeof archived !== "boolean" ||
		!stringOrNull(description) ||
		!stringOrNull(pushed_at)
	)
		return null;
	if (typeof size !== "number" || !Number.isFinite(size) || size < 0)
		return null;
	let spdx: { spdxId: string | null } | null = null;
	if (license !== null) {
		if (!isObj(license) || !stringOrNull(license.spdx_id)) return null;
		spdx = { spdxId: license.spdx_id };
	}
	return {
		fullName: clip(full_name, PATH_LIMIT),
		defaultBranch: default_branch,
		private: m.private,
		archived,
		description:
			description === null ? null : clip(description, DESCRIPTION_LIMIT),
		license: spdx,
		size,
		pushedAt: pushed_at,
	};
}

export function parseTree(
	text: string,
): { entries: TreeEntry[]; truncated: boolean } | null {
	const t = readJson(text);
	if (!isObj(t) || typeof t.truncated !== "boolean" || !Array.isArray(t.tree))
		return null;
	const entries: TreeEntry[] = [];
	for (const e of t.tree as unknown[]) {
		if (!isObj(e) || typeof e.path !== "string" || typeof e.type !== "string")
			return null;
		// A submodule ("commit") is neither a file nor a folder of this repository.
		if ((e.type === "blob" || e.type === "tree") && entries.length < TREE_LIMIT)
			entries.push({ path: clip(e.path, PATH_LIMIT), type: e.type });
	}
	return {
		entries,
		truncated: t.truncated || (t.tree as unknown[]).length > TREE_LIMIT,
	};
}

/** A raw file body, cut to FILE_LIMIT bytes of UTF-8 without splitting a character. */
export function parseFile(text: string): { text: string; clipped: boolean } {
	const bytes = new TextEncoder().encode(text);
	if (bytes.length <= FILE_LIMIT) return { text, clipped: false };
	const cut = new TextDecoder().decode(bytes.slice(0, FILE_LIMIT));
	return { text: cut.replace(/�$/, ""), clipped: true };
}
