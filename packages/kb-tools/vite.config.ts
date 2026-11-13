import { defineConfig } from "vite";

// Vite SSR build of the dc command: src/cli/main.ts -> dist/dc.mjs.
// The engine's TypeScript source is inlined; zod, yaml and node:* stay external.
export default defineConfig({
	ssr: {
		target: "node",
		noExternal: ["@dead-certain/engine"],
		external: ["zod", "yaml"],
	},
	build: {
		ssr: "src/cli/main.ts",
		outDir: "dist",
		emptyOutDir: true,
		minify: false,
		sourcemap: true,
		target: "node22",
		rolldownOptions: {
			output: { entryFileNames: "dc.mjs", format: "es" },
		},
	},
});
