import { defineConfig } from "vite";

// Vite SSR build of the MCP server: src/main.ts -> dist/server.mjs.
// The engine's and kb-tools' TypeScript source is inlined; the SDK, zod and
// yaml stay external.
export default defineConfig({
	ssr: {
		target: "node",
		noExternal: ["@dead-certain/engine", "@dead-certain/kb-tools"],
		external: ["@modelcontextprotocol/sdk", "zod", "yaml"],
	},
	build: {
		ssr: "src/main.ts",
		outDir: "dist",
		emptyOutDir: true,
		minify: false,
		sourcemap: true,
		target: "node22",
		rolldownOptions: {
			output: { entryFileNames: "server.mjs", format: "es" },
		},
	},
});
