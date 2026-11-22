// Marker edits in the two shared files (requirements 2.4, 6.1 to 6.5). Pure.

export type MarkerName = "urls" | "servers" | "dc-build" | "copy";
export type MarkerResult =
	| { ok: true; text: string }
	| { ok: false; message: string };

/**
 * Inserts `lines` just before the single line holding `new-app:<marker>`, each
 * with that line's indentation and line ending. Refuses zero or two markers.
 * Every other byte is kept, so removing the inserted lines gives the input.
 */
export function insertAtMarker(
	text: string,
	marker: MarkerName,
	lines: readonly string[],
): MarkerResult {
	const tag = `new-app:${marker}`;
	const eol = text.includes("\r\n") ? "\r\n" : "\n";
	const parts = text.split(eol);
	const at = parts.flatMap((l, i) => (l.includes(tag) ? [i] : []));
	if (at.length === 0)
		return { ok: false, message: `The marker ${tag} is missing.` };
	if (at.length > 1)
		return { ok: false, message: `The marker ${tag} appears more than once.` };
	const index = at[0] as number;
	const indent = /^\s*/.exec(parts[index] as string)?.[0] ?? "";
	const added = lines.map((l) => `${indent}${l}`);
	return {
		ok: true,
		text: [...parts.slice(0, index), ...added, ...parts.slice(index)].join(eol),
	};
}

/** One more than the highest localhost port in the Playwright config, or 4174 when there is none (6.5). */
export function nextPort(playwright: string): number {
	const ports = [...playwright.matchAll(/localhost:(\d+)/g)].map((m) =>
		Number(m[1]),
	);
	return ports.length === 0 ? 4174 : Math.max(...ports) + 1;
}
