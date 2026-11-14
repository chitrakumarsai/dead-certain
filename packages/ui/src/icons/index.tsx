import type { ReactNode } from "react";

interface IconProps {
	className?: string;
}

/** 24 px grid, 2 px stroke in currentColor, hidden from assistive technology. */
function Icon({ className, children }: IconProps & { children: ReactNode }) {
	return (
		<svg
			viewBox="0 0 24 24"
			width="24"
			height="24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
			className={`shrink-0 ${className ?? ""}`}
		>
			{children}
		</svg>
	);
}

const circle = <circle cx="12" cy="12" r="9" />;

export function CheckCircle(props: IconProps) {
	return (
		<Icon {...props}>
			{circle}
			<path d="M8 12.5l2.5 2.5L16 9.5" />
		</Icon>
	);
}

export function MinusCircle(props: IconProps) {
	return (
		<Icon {...props}>
			{circle}
			<path d="M8 12h8" />
		</Icon>
	);
}

export function CrossCircle(props: IconProps) {
	return (
		<Icon {...props}>
			{circle}
			<path d="M9 9l6 6M15 9l-6 6" />
		</Icon>
	);
}

export function QuestionCircle(props: IconProps) {
	return (
		<Icon {...props}>
			{circle}
			<path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17h.01" />
		</Icon>
	);
}

export function InfoCircle(props: IconProps) {
	return (
		<Icon {...props}>
			{circle}
			<path d="M12 11v5M12 8h.01" />
		</Icon>
	);
}

/** Points down when open and right when closed. The glyph swaps; nothing rotates. */
export function Chevron({
	direction = "down",
	...props
}: IconProps & { direction?: "down" | "right" }) {
	return (
		<Icon {...props}>
			<path d={direction === "down" ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} />
		</Icon>
	);
}

export function Close(props: IconProps) {
	return (
		<Icon {...props}>
			<path d="M6 6l12 12M18 6L6 18" />
		</Icon>
	);
}

export function Menu(props: IconProps) {
	return (
		<Icon {...props}>
			<path d="M4 7h16M4 12h16M4 17h16" />
		</Icon>
	);
}
