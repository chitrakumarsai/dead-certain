import { useSyncExternalStore } from "react";
import { Moon, Sun } from "../icons";
import {
	applyTheme,
	currentTheme,
	storeTheme,
	type Theme,
} from "../theme/storage";

const WORD: Record<Theme, string> = { dark: "Dark", light: "Light" };
const OTHER: Record<Theme, Theme> = { dark: "light", light: "dark" };

/** Every toggle on the page follows data-theme on <html>, so two never disagree. */
function subscribe(onChange: () => void): () => void {
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});
	return () => observer.disconnect();
}

/**
 * Shows the theme on screen with an icon and a word, and switches to the
 * other one. The name starts with the visible word (WCAG 2.5.3) and says
 * the theme it will set.
 */
export function ThemeToggle() {
	// The boot script has set data-theme before React runs, so the first read is right.
	const theme = useSyncExternalStore(subscribe, currentTheme);

	const toggle = (): void => {
		const next = OTHER[theme];
		applyTheme(next);
		storeTheme(next);
	};

	return (
		<button
			type="button"
			onClick={toggle}
			aria-label={`${WORD[theme]} theme. Switch to ${OTHER[theme]} theme`}
			className="inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-control px-3 text-sys-small text-text transition-colors duration-(--dur-hover) ease-kit hover:bg-surface-3 active:bg-surface-2"
		>
			{theme === "dark" ? <Moon /> : <Sun />}
			{/* Both words share one cell, so the button keeps the wider word's width and switching moves nothing. */}
			<span className="grid max-md:sr-only">
				<span className="col-start-1 row-start-1">{WORD[theme]}</span>
				<span aria-hidden="true" className="invisible col-start-1 row-start-1">
					{WORD[OTHER[theme]]}
				</span>
			</span>
		</button>
	);
}
