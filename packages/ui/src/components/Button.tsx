import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import type { Surface } from "../types";

export interface ButtonProps
	extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
	/** Defaults to "secondary". */
	variant?: "primary" | "secondary" | "quiet";
	/** Defaults to the surface the button sits on. */
	surface?: Surface;
	/** Plain words. No arrows or chevrons. */
	children: ReactNode;
}

const BASE =
	"inline-flex min-h-touch min-w-touch items-center justify-center rounded-control px-4 text-sys-body font-semibold transition-colors duration-(--dur-press) ease-kit";

// Colours come from the surface context, so one class list serves paper and
// film. The transparent border shows in forced-colors mode.
const ENABLED = {
	primary:
		"border-2 border-transparent bg-text text-surface hover:bg-text-soft active:bg-text",
	secondary:
		"border border-control-border bg-transparent text-text hover:bg-text/10 active:bg-text/20",
	quiet:
		"bg-transparent text-text underline underline-offset-4 hover:decoration-2 active:text-text-soft",
};

const DISABLED =
	"cursor-not-allowed border border-dashed border-control-border bg-transparent text-text-soft";

/**
 * The kit's one button. Disabled keeps it in the tab order through
 * `aria-disabled`; give the reason in nearby text and point at it with
 * `aria-describedby`.
 */
export function Button({
	variant = "secondary",
	surface,
	disabled,
	type = "button",
	onClick,
	children,
	...rest
}: ButtonProps) {
	const isDisabled = Boolean(disabled);
	const variantClass = isDisabled
		? `${DISABLED}${variant === "quiet" ? " underline underline-offset-4" : ""}`
		: ENABLED[variant];

	const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
		if (isDisabled) {
			event.preventDefault();
			return;
		}
		onClick?.(event);
	};

	return (
		<button
			{...rest}
			type={type}
			data-surface={surface}
			aria-disabled={isDisabled || undefined}
			onClick={handleClick}
			className={`${BASE} ${variantClass}`}
		>
			{children}
		</button>
	);
}
