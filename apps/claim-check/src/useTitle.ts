import { useEffect } from "react";

// The title the build wrote from PAGES, read before any screen changes it.
const BUILT_TITLE = typeof document === "undefined" ? "" : document.title;

/** "<screen heading>. Claim Check" (requirement 1.9). */
export function useTitle(heading: string): void {
	useEffect(() => {
		document.title = `${heading}. Claim Check`;
	}, [heading]);
}

/** The start screen keeps the built title, so it matches the HTML a crawler reads (seo requirement 3.3). */
export function useBuiltTitle(): void {
	useEffect(() => {
		document.title = BUILT_TITLE;
	}, []);
}
