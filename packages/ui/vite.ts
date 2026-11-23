import type { Plugin } from "vite";
import { THEME_BOOT_SCRIPT } from "./src/theme/storage.ts";

/** Applies the stored theme before first paint on every HTML entry. */
export function themeBoot(): Plugin {
	return {
		name: "dead-certain:theme-boot",
		transformIndexHtml: () => [
			{ tag: "script", children: THEME_BOOT_SCRIPT, injectTo: "head-prepend" },
		],
	};
}
