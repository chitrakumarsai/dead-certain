import type { PointerEvent, ReactNode } from "react";

export interface FeatureCardProps {
	title: string;
	/** The card's heading level in the page outline. Defaults to 3. */
	headingLevel?: 2 | 3;
	/** An `Illustration`, drawn above the title. */
	illustration?: ReactNode;
	/**
	 * Spotlight and shine. For the landing page and /kit only, never inside the
	 * question and verdict flows (requirement 35.2).
	 */
	hasEffects?: boolean;
	children: ReactNode;
}

/** Moves the spotlight with the pointer through two custom properties, without a render. */
function followPointer(event: PointerEvent<HTMLDivElement>): void {
	const card = event.currentTarget;
	const box = card.getBoundingClientRect();
	card.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
	card.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
}

/**
 * A card on the room: 12 px radius, a decorative edge and the inset highlight.
 * No grain, which belongs to film alone.
 */
export function FeatureCard({
	title,
	headingLevel = 3,
	illustration,
	hasEffects = false,
	children,
}: FeatureCardProps) {
	const Heading = `h${headingLevel}` as const;
	return (
		<div
			data-feature-card
			onPointerMove={hasEffects ? followPointer : undefined}
			className="group relative overflow-hidden rounded-card border border-border-subtle bg-surface-2 p-6 text-text-primary highlight-inset transition-colors duration-(--dur-hover) ease-kit hover:border-border-strong"
		>
			{hasEffects && (
				<>
					<span
						aria-hidden="true"
						data-spotlight
						className="card-spotlight group-hover:opacity-100"
					/>
					<span
						aria-hidden="true"
						data-shine
						className="card-shine group-hover:[translate:110%_0]"
					/>
				</>
			)}
			<div className="relative flex flex-col gap-2">
				{illustration && (
					<div className="pb-2 text-text-secondary">{illustration}</div>
				)}
				<Heading className="text-sys-body font-semibold">{title}</Heading>
				<div className="text-sys-small text-text-secondary">{children}</div>
			</div>
		</div>
	);
}
