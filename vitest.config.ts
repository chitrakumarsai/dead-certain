import { defineConfig } from "vitest/config";

export default defineConfig({
	// Playwright owns e2e/. Vitest runs unit and property tests (*.props.test.ts) only.
	test: { include: ["packages/**/*.test.{ts,tsx}", "apps/**/*.test.{ts,tsx}"] },
});
