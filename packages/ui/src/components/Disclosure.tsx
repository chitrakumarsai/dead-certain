import * as Collapsible from "@radix-ui/react-collapsible";
import {
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useRef,
	useState,
} from "react";
import { Chevron } from "../icons";

export interface DisclosureProps {
	/** Trigger text, such as "Why this question?". Keep it the same across a flow. */
	title: string;
	defaultOpen?: boolean;
	/** Pass with `onOpenChange` to control it. */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: ReactNode;
}

/**
 * A titled panel that opens in place. The panel's height animates over
 * --dur-panel, which is 0 ms under reduced motion. Escape inside the panel
 * closes it and puts focus back on the trigger.
 */
export function Disclosure({
	title,
	defaultOpen = false,
	open,
	onOpenChange,
	children,
}: DisclosureProps) {
	const [ownOpen, setOwnOpen] = useState(defaultOpen);
	const isOpen = open ?? ownOpen;
	const triggerRef = useRef<HTMLButtonElement>(null);

	const setOpen = useCallback(
		(next: boolean) => {
			if (open === undefined) setOwnOpen(next);
			onOpenChange?.(next);
		},
		[open, onOpenChange],
	);

	const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>): void => {
		if (event.key !== "Escape") return;
		// Only the innermost open panel closes.
		event.stopPropagation();
		setOpen(false);
		triggerRef.current?.focus();
	};

	return (
		<Collapsible.Root open={isOpen} onOpenChange={setOpen}>
			<Collapsible.Trigger
				ref={triggerRef}
				className="flex min-h-touch w-full items-center gap-2 text-left text-sys-body font-semibold text-text hover:underline hover:underline-offset-4"
			>
				<Chevron direction={isOpen ? "down" : "right"} />
				{title}
			</Collapsible.Trigger>
			<Collapsible.Content
				onKeyDown={closeOnEscape}
				className="overflow-hidden data-[state=closed]:animate-[dc-panel-close_var(--dur-panel)_var(--ease)] data-[state=open]:animate-[dc-panel-open_var(--dur-panel)_var(--ease)]"
			>
				<div className="pb-4 pl-8 pt-1">{children}</div>
			</Collapsible.Content>
		</Collapsible.Root>
	);
}
