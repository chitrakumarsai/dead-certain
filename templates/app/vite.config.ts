import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { themeBoot } from "../../packages/ui/vite.ts";

// GitHub Pages serves the repo at /dead-certain/; the site deploys this build under __APP_NAME__/.
export default defineConfig({
	base: "/dead-certain/__APP_NAME__/",
	plugins: [react(), tailwindcss(), themeBoot()],
});
