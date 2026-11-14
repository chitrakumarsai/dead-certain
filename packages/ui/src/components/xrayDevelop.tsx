import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import { type ReactNode, useState } from "react";

/**
 * The X-ray develop, the kit's only choreographed motion and its only use of
 * Motion. XrayStage loads this module on demand, so Motion stays out of the
 * kit's main bundle (task 9.6).
 */

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

/**
 * A 2 px film-coloured line crosses the sheet once. Left to right beside the
 * sheet, top to bottom below 1280 px.
 */
export function ScanLine({ isWide }: { isWide: boolean }) {
	const [isDone, setDone] = useState(false);
	const [timing] = useState(developTiming);
	return (
		<LazyMotion features={domAnimation} strict>
			{/* The moving layer ends a full sheet past its edge; the clip keeps it
			    from widening the page. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 overflow-hidden"
			>
				<m.div
					data-scan-line
					data-direction={isWide ? "across" : "down"}
					initial={isWide ? { x: "0%" } : { y: "0%" }}
					animate={isWide ? { x: "100%" } : { y: "100%" }}
					transition={timing}
					onAnimationComplete={() => setDone(true)}
					className={`absolute inset-0 ${isDone ? "invisible" : ""}`}
				>
					<div
						className={
							isWide
								? "absolute inset-y-0 left-0 w-0.5 bg-film"
								: "absolute inset-x-0 top-0 h-0.5 bg-film"
						}
					/>
				</m.div>
			</div>
		</LazyMotion>
	);
}

/** Reveals the proof behind the line with clip-path, in the line's direction. */
export function ClipReveal({
	isWide,
	children,
}: {
	isWide: boolean;
	children: ReactNode;
}) {
	const [timing] = useState(developTiming);
	// The direction is fixed when the develop starts; a later resize changes nothing.
	const [from] = useState(() =>
		isWide ? "inset(0 100% 0 0)" : "inset(0 0 100% 0)",
	);
	return (
		<LazyMotion features={domAnimation} strict>
			<m.div
				data-film-reveal
				initial={{ clipPath: from }}
				animate={{ clipPath: "inset(0 0% 0% 0)" }}
				transition={timing}
			>
				{children}
			</m.div>
		</LazyMotion>
	);
}
