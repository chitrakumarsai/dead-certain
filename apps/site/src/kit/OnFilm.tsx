import type { ReactNode } from "react";

/** A film backdrop, with Film's edge and grain, for specimens of components that sit inside the X-ray. */
export function OnFilm({ children }: { children: ReactNode }) {
	return (
		<div
			data-surface="film"
			className="max-w-column rounded-film border border-border-strong bg-surface film-grain p-6 text-text"
		>
			{children}
		</div>
	);
}
