import type { ReactNode } from "react";

/** A film backdrop for specimens of components that sit inside the X-ray. */
export function OnFilm({ children }: { children: ReactNode }) {
	return (
		<div
			data-surface="film"
			className="max-w-column rounded-film bg-surface p-6 text-text"
		>
			{children}
		</div>
	);
}
