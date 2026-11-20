import { defineConfig } from "vite";

// Vite SSR build of the MCP server: src/main.ts -> dist/server.mjs.
// The engine's and kb-tools' TypeScript source is inlined, and so is yaml: it is
// kb-tools' dependency, not this package's, so Node could not resolve it from
// dist/server.mjs (found by the stdio smoke test). The SDK and zod stay
// external and are declared in package.json.
export default defineConfig({
	ssr: {
		target: "node",
		noExternal: ["@dead-certain/engine", "@dead-certain/kb-tools", "yaml"],
		external: ["@modelcontextprotocol/sdk", "zod"],
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
