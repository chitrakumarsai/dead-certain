import { defineConfig, devices } from "@playwright/test";

const SITE_URL = "http://localhost:4173/dead-certain/";
const HEIGHT = 900;
const chrome = devices["Desktop Chrome"];

export default defineConfig({
	testDir: "e2e",
	forbidOnly: true,
	use: { baseURL: SITE_URL },
	// The design's three evidence widths, plus reduced motion at the widest.
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
	],
	// Tests run against the built site, never a watcher.
	webServer: {
		command:
			"pnpm --filter @dead-certain/site build && pnpm --filter @dead-certain/site preview --port 4173 --strictPort",
		url: SITE_URL,
		reuseExistingServer: true,
	},
});
