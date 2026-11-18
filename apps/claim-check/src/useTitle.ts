import { useEffect } from "react";

/** "<screen heading>. Claim Check" (requirement 1.9). */
export function useTitle(heading: string): void {
	useEffect(() => {
		document.title = `${heading}. Claim Check`;
	}, [heading]);
}
