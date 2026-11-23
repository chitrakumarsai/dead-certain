import type { ReactNode } from "react";

/** A paper sheet for specimens of components that sit on paper. The room under the gallery follows the theme. */
export function OnPaper({ children }: { children: ReactNode }) {
	return (
		<div
			data-surface="paper"
			className="max-w-column rounded-paper border border-divider bg-surface p-6 text-text"
		>
			{children}
		</div>
	);
}
