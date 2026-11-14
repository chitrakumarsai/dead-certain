import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { useAnnounce } from "../a11y/LiveRegion";
import { useReducedMotion } from "../a11y/useReducedMotion";
import { Film } from "./Film";

export type XrayTarget = { kind: "verdict" } | { kind: "line"; fact: string };

export interface XrayStageProps {
	/** The paper side. Its first heading takes focus if the opener is gone. */
	sheet: ReactNode;
	/** The proof for a target. Key the tree by target so a new one starts fresh. */
	film: (target: XrayTarget) => ReactNode;
	/** null while closed. */
	target: XrayTarget | null;
	/** "Why" or "Why: Room rent above the limit". */
	title: (target: XrayTarget) => string;
	onClose: () => void;
	rail?: ReactNode;
}

const WIDE = "(min-width: 1280px)";

function useIsWide(): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const media = matchMedia(WIDE);
			media.addEventListener("change", onChange);
			return () => media.removeEventListener("change", onChange);
		},
		() => matchMedia(WIDE).matches,
		() => false,
	);
}

type Timing = { duration: number; ease: [number, number, number, number] };

/** The develop's timing, read from the motion tokens so CSS stays the source. */
function developTiming(): Timing {
	const style = getComputedStyle(document.documentElement);
	// The built CSS minifies "500ms" to ".5s", so the unit must be read.
	const raw = style.getPropertyValue("--dur-xray").trim();
	const value = Number.parseFloat(raw);
	const ms = Number.isFinite(value)
		? raw.endsWith("ms")
			? value
			: value * 1000
		: 500;
	const curve = style
		.getPropertyValue("--ease")
		.match(/cubic-bezier\(([^)]+)\)/)?.[1]
		?.split(",")
		.map(Number);
	const isCurve = curve?.length === 4 && curve.every(Number.isFinite);
	return {
		duration: ms / 1000,
		ease: isCurve ? (curve as Timing["ease"]) : [0.2, 0, 0, 1],
	};
}

/** Where focus goes on close: the opener, else the sheet's first heading. */
function returnFocus(opener: HTMLElement | null, sheet: HTMLElement | null) {
	if (opener?.isConnected) {
		opener.focus();
		return;
	}
	const heading = sheet?.querySelector<HTMLElement>("h1, h2, h3, h4, h5, h6");
	if (!heading) return;
	if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
	heading.focus();
}

/**
 * The develop: a 2 px film-coloured line crosses the sheet once. Left to
 * right beside the sheet, top to bottom below 1280 px.
 */
function ScanLine({ isWide }: { isWide: boolean }) {
	const [isDone, setDone] = useState(false);
	const [timing] = useState(developTiming);
	return (
		<m.div
			aria-hidden="true"
			data-scan-line
			data-direction={isWide ? "across" : "down"}
			initial={isWide ? { x: "0%" } : { y: "0%" }}
			animate={isWide ? { x: "100%" } : { y: "100%" }}
			transition={timing}
			onAnimationComplete={() => setDone(true)}
			className={`pointer-events-none absolute inset-0 ${isDone ? "invisible" : ""}`}
		>
			<div
				className={
					isWide
						? "absolute inset-y-0 left-0 w-0.5 bg-film"
						: "absolute inset-x-0 top-0 h-0.5 bg-film"
				}
			/>
		</m.div>
	);
}

/**
 * Reveals the proof behind the line with clip-path, or fades it in over
 * 120 ms under reduced motion. Mounted once per open, so a new target swaps in
 * with no animation.
 */
function Reveal({
	isWide,
	isReduced,
	children,
}: {
	isWide: boolean;
	isReduced: boolean;
	children: ReactNode;
}) {
	const [timing] = useState(developTiming);
	// The direction is fixed when the develop starts; a later resize changes nothing.
	const [from] = useState(() =>
		isWide ? "inset(0 100% 0 0)" : "inset(0 0 100% 0)",
	);
	if (isReduced) {
		return (
			<div
				data-film-reveal
				className="transition-opacity duration-(--dur-reduced) ease-kit starting:opacity-0"
			>
				{children}
			</div>
		);
	}
	return (
		<m.div
			data-film-reveal
			initial={{ clipPath: from }}
			animate={{ clipPath: "inset(0 0% 0% 0)" }}
			transition={timing}
		>
			{children}
		</m.div>
	);
}

/**
 * The verdict on paper and its proof on film. Opening develops the film once;
 * switching target swaps the proof at once. Focus goes to the film's title on
 * open and back to the opener on close. One Film follows the viewport, so a
 * resize across 1280 px moves the proof without remounting it.
 */
export function XrayStage({
	sheet,
	film,
	target,
	title,
	onClose,
	rail,
}: XrayStageProps) {
	const isWide = useIsWide();
	const isReduced = useReducedMotion();
	const announce = useAnnounce();
	const sheetRef = useRef<HTMLDivElement>(null);
	const headingRef = useRef<HTMLHeadingElement>(null);
	const openerRef = useRef<HTMLElement | null>(null);
	const wasOpen = useRef(false);
	const isOpen = target !== null;
	const heading = target ? title(target) : "";

	// Layout effects run before Radix moves focus into the bottom sheet, so the
	// element that opened the stage is still the active one here.
	useLayoutEffect(() => {
		if (isOpen && !wasOpen.current) {
			const active = document.activeElement;
			// An opener that unmounted with the open leaves focus on <body>: no opener.
			openerRef.current =
				active instanceof HTMLElement && active !== document.body
					? active
					: null;
		}
		if (!isOpen && wasOpen.current) {
			const opener = openerRef.current;
			// After the bottom sheet's focus trap has let go, or it pulls focus back.
			setTimeout(() => returnFocus(opener, sheetRef.current), 0);
		}
		wasOpen.current = isOpen;
	}, [isOpen]);

	useEffect(() => {
		if (!heading) return;
		headingRef.current?.focus();
		announce(heading);
	}, [heading, announce]);

	return (
		<LazyMotion features={domAnimation} strict>
			<div
				data-xray-stage
				data-film={isOpen && isWide ? "side" : undefined}
				className="flex flex-col gap-6 lg:flex-row lg:items-start lg:data-[film=side]:flex-col"
			>
				{rail && <div className="shrink-0">{rail}</div>}
				<div className="flex min-w-0 flex-1 items-start gap-6">
					<div ref={sheetRef} className="relative w-full max-w-column min-w-0">
						{sheet}
						{isOpen && !isReduced && <ScanLine isWide={isWide} />}
					</div>
					{/* Empty below 1280 px: the bottom sheet renders in a portal. */}
					<div className="min-w-0 flex-1 empty:hidden">
						<Film
							title={heading}
							presentation={isWide ? "side" : "sheet"}
							open={isOpen}
							onClose={onClose}
							headingRef={headingRef}
						>
							{target && (
								<Reveal isWide={isWide} isReduced={isReduced}>
									{film(target)}
								</Reveal>
							)}
						</Film>
					</div>
				</div>
			</div>
		</LazyMotion>
	);
}
