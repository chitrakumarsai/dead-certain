import type { Target } from "./types";

const API = "https://api.github.com/repos";

export interface RequestUrls {
	readonly metadata: string;
	readonly tree: string;
	readonly gitignore: string;
	readonly readme: string;
}

/**
 * The four request URLs (3.2 to 3.4). Take a Target only from parseTarget (3.6);
 * every part is percent-encoded as well, belt and braces. The branch must be a
 * well-formed string (task 4 checks default_branch), or encodeURIComponent throws.
 */
export function requestUrls(target: Target, branch: string): RequestUrls {
	const base = `${API}/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}`;
	return {
		metadata: base,
		tree: `${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
		gitignore: `${base}/contents/.gitignore`,
		readme: `${base}/readme`,
	};
}
