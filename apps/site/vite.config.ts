import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { themeBoot } from "../../packages/ui/vite.ts";
import { seoHead } from "../../scripts/seo-vite.ts";

// GitHub Pages serves the repo at /dead-certain/. The site is the root build.
export default defineConfig({
	base: "/dead-certain/",
	plugins: [react(), tailwindcss(), themeBoot(), seoHead()],
	build: {
		rolldownOptions: {
			input: {
				main: "index.html",
				// GitHub Pages serves 404.html for any unknown path under the site.
				notfound: "404.html",
				kit: "kit/index.html",
				shell: "kit/shell.html",
				screen: "kit/screen.html",
			},
		},
	},
});
