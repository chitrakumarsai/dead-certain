import { defineConfig, devices } from "@playwright/test";

const SITE_URL = "http://localhost:4173/dead-certain/";

export default defineConfig({
	testDir: "e2e",
	forbidOnly: true,
	use: { baseURL: SITE_URL },
	projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
	webServer: {
		command: "pnpm --filter @dead-certain/site dev --port 4173 --strictPort",
		url: SITE_URL,
		reuseExistingServer: true,
	},
});
