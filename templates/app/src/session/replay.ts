import {
	decode,
	EngineError,
	encode,
	type KnowledgeBase,
	type Session,
} from "@dead-certain/engine";
import type { ReplayFailure } from "@dead-certain/ui";

export type DecodeResult =
	| { ok: true; session: Session }
	| { ok: false; failure: ReplayFailure };

const FAILURES: ReadonlySet<string> = new Set<ReplayFailure>([
	"KB_MISMATCH",
	"MALFORMED_TOKEN",
	"UNSUPPORTED_VERSION",
]);

/** Splits "#/?r=<token>" into its path and query. */
export function splitFragment(hash: string): {
	path: string;
	query: URLSearchParams;
} {
	const body = hash.startsWith("#") ? hash.slice(1) : hash;
	const at = body.indexOf("?");
	const path = (at === -1 ? body : body.slice(0, at)) || "/";
	return {
		path,
		query: new URLSearchParams(at === -1 ? "" : body.slice(at + 1)),
	};
}

/** The replay token on the check route, or null. */
export function readFragment(hash: string): string | null {
	const { path, query } = splitFragment(hash);
	return path === "/" ? query.get("r") : null;
}

/** "#/" with no answers, otherwise "#/?r=<token>". */
export function fragmentFor(s: Session): string {
	return Object.keys(s.answers).length === 0 ? "#/" : `#/?r=${encode(s)}`;
}

/** Mirrors the session in the fragment without adding a history entry. */
export function writeFragment(s: Session): void {
	const hash = fragmentFor(s);
	if (location.hash !== hash) history.replaceState(null, "", hash);
}

/** Null when the fragment carries no token; never throws (requirement 5.7). */
export function decodeFragment(
	kb: KnowledgeBase,
	hash: string,
): DecodeResult | null {
	const token = readFragment(hash);
	if (token === null) return null;
	try {
		return { ok: true, session: decode(kb, token) };
	} catch (error) {
		const failure =
			error instanceof EngineError && FAILURES.has(error.code)
				? (error.code as ReplayFailure)
				: "MALFORMED_TOKEN";
		return { ok: false, failure };
	}
}
