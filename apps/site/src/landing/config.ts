// The compiled Claim Check knowledge base, written by `pnpm dc build apps/claim-check`.
// The one file the page reads from an app (requirement 1.7).
import compiled from "../../../claim-check/kb/dist/policy.json";

/** The compiled JSON, not yet shape-checked. */
export const compiledKb: unknown = compiled;

export const REPO_URL = "https://github.com/chitrakumarsai/dead-certain";

/** Internal links, built from Vite's base so they follow it (requirement 5.2). */
export const linksFor = (base: string) => ({
	claimCheck: `${base}claim-check/`,
	preFlight: `${base}pre-flight/`,
	kit: `${base}kit/`,
	clause: (id: string) =>
		`${base}claim-check/#/rulebook?clause=${encodeURIComponent(id)}`,
});

export const links = linksFor(import.meta.env.BASE_URL);

/** The shell's four entries (requirement 6.1). */
export const NAV = [
	{ label: "Claim Check", href: links.claimCheck },
	{ label: "Pre-Flight", href: links.preFlight },
	{ label: "Component kit", href: links.kit },
	{ label: "Source", href: REPO_URL },
];
