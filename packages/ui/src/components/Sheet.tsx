import type { ReactNode } from "react";

export interface SheetProps {
	as?: "section" | "div" | "article";
	"aria-labelledby"?: string;
	children: ReactNode;
}

/** The paper the questions and verdicts are typeset on. */
export function Sheet({ as: Tag = "div", children, ...rest }: SheetProps) {
	return (
		<Tag
			{...rest}
			data-surface="paper"
			className="max-w-column rounded-paper border border-divider bg-surface p-4 text-text md:p-6"
		>
			{children}
		</Tag>
	);
}
