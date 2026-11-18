import { useSyncExternalStore } from "react";
import { splitFragment } from "./session/replay";

export type Route =
	| { page: "check" }
	| { page: "rulebook"; clause: string | null }
	| { page: "notfound" };

/** Routes live in the fragment, so deep links need no server rewrite. */
export function parseRoute(hash: string): Route {
	const { path, query } = splitFragment(hash);
	if (path === "/") return { page: "check" };
	if (path === "/rulebook")
		return { page: "rulebook", clause: query.get("clause") };
	return { page: "notfound" };
}

const subscribe = (onChange: () => void) => {
	window.addEventListener("hashchange", onChange);
	return () => window.removeEventListener("hashchange", onChange);
};

export function useRoute(): Route {
	return parseRoute(useSyncExternalStore(subscribe, () => location.hash));
}
