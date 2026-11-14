import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useAnnounce } from "../a11y/LiveRegion";
import { useReducedMotion } from "../a11y/useReducedMotion";
import { useMediaQuery } from "../useMediaQuery";
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

// The develop is the kit's only use of Motion, so it loads on demand and Motion
// stays out of the main bundle. The stage starts the load when it mounts.
type Develop = typeof import("./xrayDevelop");
const loadDevelop = (): Promise<Develop> => import("./xrayDevelop");

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
 * Reveals the proof: behind the scan line with clip-path, or a 120 ms CSS fade
 * under reduced motion. Mounted once per open, so a new target swaps in with
 * no animation. Whether to animate is fixed at mount: a wrapper that changed
 * later would remount the proof and lose its state. Opened before the develop
 * has loaded, the proof simply shows.
 */
function Reveal({
	develop,
	isWide,
	isReduced,
	children,
}: {
	develop: Develop | null;
	isWide: boolean;
	isReduced: boolean;
	children: ReactNode;
}) {
	const [Clip] = useState(() => (isReduced ? null : develop?.ClipReveal));
	if (Clip) return <Clip isWide={isWide}>{children}</Clip>;
	return (
		<div
			data-film-reveal
			className="transition-opacity duration-(--dur-reduced) ease-kit starting:opacity-0"
		>
			{children}
		</div>
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
	const isWide = useMediaQuery(WIDE);
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

	const [develop, setDevelop] = useState<Develop | null>(null);
	useEffect(() => {
		// Load the develop now, so it is ready before the first open.
		let isCurrent = true;
		loadDevelop().then(
			(module) => isCurrent && setDevelop(module),
			// Without it the proof still opens, only without the sweep.
			() => undefined,
		);
		return () => {
			isCurrent = false;
		};
	}, []);

	useEffect(() => {
		if (!heading) return;
		headingRef.current?.focus();
		announce(heading);
	}, [heading, announce]);

	return (
		<div
			data-xray-stage
			data-film={isOpen && isWide ? "side" : undefined}
			className="flex flex-col gap-6 lg:flex-row lg:items-start lg:data-[film=side]:flex-col"
		>
			{rail && <div className="shrink-0">{rail}</div>}
			<div className="flex min-w-0 flex-1 items-start gap-6">
				<div ref={sheetRef} className="relative w-full max-w-column min-w-0">
					{sheet}
					{isOpen && !isReduced && develop && (
						<develop.ScanLine isWide={isWide} />
					)}
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
							<Reveal develop={develop} isWide={isWide} isReduced={isReduced}>
								{film(target)}
							</Reveal>
						)}
					</Film>
				</div>
			</div>
		</div>
	);
}
