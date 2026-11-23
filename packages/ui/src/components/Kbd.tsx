import type { ReactNode } from "react";

export interface KbdProps {
	/** The key or chord as printed, "⌘K" or "Ctrl K". */
	children: ReactNode;
}

/** A keyboard key, in Plex Mono 13/20. */
export function Kbd({ children }: KbdProps) {
	return (
		<kbd className="inline-flex items-center rounded-control border border-border-strong px-2 font-mono text-kbd text-text-soft">
			{children}
		</kbd>
	);
}
