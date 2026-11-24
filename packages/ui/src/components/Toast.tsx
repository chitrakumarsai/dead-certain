import { useEffect } from "react";
import { useAnnounce } from "../a11y/LiveRegion";
import { CheckCircle, Close } from "../icons";

export interface ToastProps {
	/** What happened, in plain words. `null` shows nothing. */
	message: string | null;
	/** A confirmed action, such as a copied link, gets the success pulse once. */
	isConfirmed?: boolean;
	onDismiss: () => void;
}

/**
 * A short notice of what just happened. It is read out through the page's
 * single polite live region (requirement 37.2), so it adds no live region of
 * its own. The caller places it, decides when it goes, and moves focus on
 * when Dismiss takes the focused button away.
 */
export function Toast({ message, isConfirmed = false, onDismiss }: ToastProps) {
	const announce = useAnnounce();
	useEffect(() => {
		if (message) announce(message);
	}, [message, announce]);

	if (!message) return null;
	return (
		<div
			data-toast
			className={`inline-flex max-w-column items-center gap-3 rounded-pill border border-border-strong bg-surface-3 py-1 pr-1 pl-4 text-sys-small text-text-primary highlight-inset transition-opacity duration-(--dur-enter) ease-kit starting:opacity-0 ${isConfirmed ? "pulse-confirm" : ""}`}
		>
			{isConfirmed && <CheckCircle />}
			<p>{message}</p>
			<button
				type="button"
				aria-label="Dismiss"
				onClick={onDismiss}
				className="inline-flex size-touch shrink-0 items-center justify-center rounded-pill text-text-secondary transition-colors duration-(--dur-hover) ease-kit hover:bg-text-primary/10 hover:text-text-primary"
			>
				<Close />
			</button>
		</div>
	);
}
