import { useEffect } from "react";

/** "<screen heading>. __APP_TITLE__" (requirement 5.10). */
export function useTitle(heading: string): void {
	useEffect(() => {
		document.title = `${heading}. __APP_TITLE__`;
	}, [heading]);
}
