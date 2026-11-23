import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { themeBoot } from "../../packages/ui/vite.ts";

// GitHub Pages serves the repo at /dead-certain/; the site deploys this build under pre-flight/.
export default defineConfig({
	base: "/dead-certain/pre-flight/",
	plugins: [react(), tailwindcss(), themeBoot()],
});
