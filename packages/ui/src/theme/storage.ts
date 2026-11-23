/**
 * The theme choice. This is the only file in the kit that touches localStorage
 * (steering: Theme). Storage can throw in private windows or with site data
 * blocked; the theme then follows prefers-color-scheme through tokens.css.
 */
export type Theme = "light" | "dark";

export const THEME_KEY = "dc-theme";

const isTheme = (value: unknown): value is Theme =>
	value === "light" || value === "dark";

export function readStoredTheme(): Theme | null {
	try {
		const value = localStorage.getItem(THEME_KEY);
		return isTheme(value) ? value : null;
	} catch {
		return null;
	}
}

/** False when storage refused the write. The choice still holds for this page. */
export function storeTheme(theme: Theme): boolean {
	try {
		localStorage.setItem(THEME_KEY, theme);
		return true;
	} catch {
		return false;
	}
}

/** The theme on screen: the stored or chosen one, else the system's. */
export function currentTheme(): Theme {
	const set = document.documentElement.dataset.theme;
	if (isTheme(set)) return set;
	return window.matchMedia("(prefers-color-scheme: light)").matches
		? "light"
		: "dark";
}

export function applyTheme(theme: Theme): void {
	document.documentElement.dataset.theme = theme;
}

/**
 * Inlined at the top of every page's <head> by themeBoot() in vite.ts, so a
 * stored choice applies before first paint. Same key and guard as above.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
