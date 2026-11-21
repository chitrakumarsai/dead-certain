import { useSyncExternalStore } from "react";
import { splitFragment } from "./session/replay";

export type Route = { page: "check" } | { page: "notfound" };

/** Routes live in the fragment, so deep links need no server rewrite. */
export function parseRoute(hash: string): Route {
	return splitFragment(hash).path === "/"
		? { page: "check" }
		: { page: "notfound" };
}

const subscribe = (onChange: () => void) => {
	window.addEventListener("hashchange", onChange);
	return () => window.removeEventListener("hashchange", onChange);
};

export function useRoute(): Route {
	return parseRoute(useSyncExternalStore(subscribe, () => location.hash));
}
