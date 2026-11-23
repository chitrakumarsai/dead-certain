import { useState } from "react";
import { Moon, Sun } from "../icons";
import {
	applyTheme,
	currentTheme,
	storeTheme,
	type Theme,
} from "../theme/storage";

const WORD: Record<Theme, string> = { dark: "Dark", light: "Light" };
const OTHER: Record<Theme, Theme> = { dark: "light", light: "dark" };

/**
 * Shows the theme on screen with an icon and a word, and switches to the
 * other one. The name starts with the visible word (WCAG 2.5.3) and says
 * the theme it will set.
 */
export function ThemeToggle() {
	// The boot script has set data-theme before React runs, so the first read is right.
	const [theme, setTheme] = useState<Theme>(currentTheme);

	const toggle = (): void => {
		const next = OTHER[theme];
		applyTheme(next);
		storeTheme(next);
		setTheme(next);
	};

	return (
		<button
			type="button"
			onClick={toggle}
			aria-label={`${WORD[theme]} theme. Switch to ${OTHER[theme]} theme`}
			className="inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-control px-3 text-sys-small text-text transition-colors duration-(--dur-hover) ease-kit hover:bg-surface-3 active:bg-surface-2"
		>
			{theme === "dark" ? <Moon /> : <Sun />}
			<span className="max-md:sr-only">{WORD[theme]}</span>
		</button>
	);
}
