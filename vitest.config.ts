import { defineConfig } from "vitest/config";

export default defineConfig({
	// Playwright owns e2e/. Vitest runs unit and property tests (*.props.test.ts) only.
	test: {
		include: ["packages/**/*.test.{ts,tsx}", "apps/**/*.test.{ts,tsx}"],
		// Property tests take about 5 s each under a full parallel run and time out
		// at the 5 s default (Kiro's kb-props-timeout analysis). 60 s matches the
		// per-test limits already in cycles.test.ts and dist-smoke.test.ts.
		testTimeout: 60_000,
	},
});
