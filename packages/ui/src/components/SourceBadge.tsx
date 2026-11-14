import type { FactSource } from "@dead-certain/engine/types";
import type { ReactNode } from "react";
import type { Surface } from "../types";

export interface SourceBadgeProps {
	source: FactSource;
	surface?: Surface;
}

const MARKER_SIZE = 10;

// The word carries the meaning; the shape is a second, non-colour cue.
const SOURCES: Record<
	FactSource,
	{ word: string; shape: string; mark: ReactNode }
> = {
	answered: {
		word: "You answered",
		shape: "square",
		mark: <rect x="1" y="1" width="8" height="8" fill="currentColor" />,
	},
	collected: {
		word: "Collected",
		shape: "ring",
		mark: (
			<circle
				cx="5"
				cy="5"
				r="3.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			/>
		),
	},
	derived: {
		word: "Worked out",
		shape: "diamond",
		mark: <path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill="currentColor" />,
	},
};

/** Where a fact came from, in words, with a small shape beside them. */
export function SourceBadge({ source, surface }: SourceBadgeProps) {
	const { word, shape, mark } = SOURCES[source];
	return (
		<span
			data-source={source}
			data-surface={surface}
			className="inline-flex items-center gap-2 text-sys-small text-text-soft"
		>
			<svg
				data-marker={shape}
				viewBox="0 0 10 10"
				width={MARKER_SIZE}
				height={MARKER_SIZE}
				aria-hidden="true"
				focusable="false"
				className="shrink-0"
			>
				{mark}
			</svg>
			{word}
		</span>
	);
}
