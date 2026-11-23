import { defineConfig, devices } from "@playwright/test";

const SITE_URL = "http://localhost:4173/dead-certain/";
/** Claim Check is served on its own port; its specs open it with this absolute URL. */
export const CLAIM_CHECK_URL =
	"http://localhost:4174/dead-certain/claim-check/";
/** Pre-Flight is served on its own port, like Claim Check. */
export const PRE_FLIGHT_URL = "http://localhost:4175/dead-certain/pre-flight/";
// new-app:urls
const HEIGHT = 900;
const chrome = devices["Desktop Chrome"];

export default defineConfig({
	testDir: "e2e",
	forbidOnly: true,
	use: { baseURL: SITE_URL },
	// The design's three evidence widths, plus reduced motion at the widest.
	// Chrome reports a light system theme by default, so these run the light
	// theme; the dark project runs every spec again in the default dark room.
	projects: [
		{
			name: "390",
			use: { ...chrome, viewport: { width: 390, height: HEIGHT } },
		},
		{
			name: "768",
			use: { ...chrome, viewport: { width: 768, height: HEIGHT } },
		},
		{
			name: "1280",
			use: { ...chrome, viewport: { width: 1280, height: HEIGHT } },
		},
		{
			name: "reduced-motion",
			use: {
				...chrome,
				viewport: { width: 1280, height: HEIGHT },
				contextOptions: { reducedMotion: "reduce" },
			},
		},
		{
			name: "dark",
			use: {
				...chrome,
				viewport: { width: 1280, height: HEIGHT },
				colorScheme: "dark",
			},
		},
	],
	// Tests run against the built apps, never a watcher.
	webServer: [
		{
			command:
				"pnpm --filter @dead-certain/site build && pnpm --filter @dead-certain/site preview --port 4173 --strictPort",
			url: SITE_URL,
			reuseExistingServer: true,
		},
		{
			command:
				"pnpm --filter @dead-certain/claim-check build && pnpm --filter @dead-certain/claim-check preview --port 4174 --strictPort",
			url: CLAIM_CHECK_URL,
			reuseExistingServer: true,
		},
		{
			command:
				"pnpm --filter @dead-certain/pre-flight build && pnpm --filter @dead-certain/pre-flight preview --port 4175 --strictPort",
			url: PRE_FLIGHT_URL,
			reuseExistingServer: true,
		},
		// new-app:servers
	],
});
