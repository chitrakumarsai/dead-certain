import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages serves the repo at /dead-certain/. The site is the root build.
export default defineConfig({
	base: "/dead-certain/",
	plugins: [react(), tailwindcss()],
	build: {
		rolldownOptions: {
			input: { main: "index.html", kit: "kit/index.html" },
		},
	},
});
