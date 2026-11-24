import type { ReactNode } from "react";

export interface PillProps {
	/** "wax" is the accent: a wax-muted fill, never wax text. Defaults to "neutral". */
	tone?: "neutral" | "wax";
	children: ReactNode;
}

const TONE = {
	neutral: "border border-divider text-text-soft",
	wax: "border border-transparent bg-wax-muted text-text",
};

/** A short label with a 999 px radius. It is not a control. */
export function Pill({ tone = "neutral", children }: PillProps) {
	return (
		<span
			className={`inline-flex items-center rounded-pill px-3 py-1 text-ui-small ${TONE[tone]}`}
		>
			{children}
		</span>
	);
}
