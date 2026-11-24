import { Button, Kbd, Pill, Toast } from "@dead-certain/ui";
import { useEffect, useRef, useState } from "react";
import { OnPaper } from "./OnPaper";
import { Specimen } from "./Specimen";

/** A toast that can be dismissed and shown again, so both states are live. */
function ToastDemo({
	message,
	isConfirmed,
	showLabel,
	startsOpen,
}: {
	message: string;
	isConfirmed: boolean;
	showLabel: string;
	startsOpen: boolean;
}) {
	const [shown, setShown] = useState<string | null>(
		startsOpen ? message : null,
	);
	const [wasDismissed, setWasDismissed] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	// The Dismiss button goes with the toast, so focus moves to the button that replaces it.
	useEffect(() => {
		if (wasDismissed && !shown) box.current?.querySelector("button")?.focus();
	}, [wasDismissed, shown]);

	return (
		<div ref={box}>
			{shown ? (
				<Toast
					message={shown}
					isConfirmed={isConfirmed}
					onDismiss={() => {
						setShown(null);
						setWasDismissed(true);
					}}
				/>
			) : (
				<Button onClick={() => setShown(message)}>{showLabel}</Button>
			)}
		</div>
	);
}

const pills = (
	<div className="flex flex-wrap items-center gap-2">
		<Pill>Sample policy</Pill>
		<Pill tone="wax">New</Pill>
	</div>
);

export const NOTICE_SPECIMENS = [
	{ id: "toast-notice", title: "Toast, notice" },
	{ id: "toast-confirmed", title: "Toast, confirmed" },
	{ id: "pill-room", title: "Pill on the room" },
	{ id: "pill-paper", title: "Pill on paper" },
	{ id: "kbd-room", title: "Kbd on the room" },
	{ id: "kbd-paper", title: "Kbd on paper" },
];

export function NoticesSection() {
	return (
		<section aria-labelledby="notices-heading" className="pt-16">
			<h2 id="notices-heading" className="font-doc text-verdict font-semibold">
				Toast, Pill and Kbd
			</h2>

			<Specimen
				id="toast-notice"
				title="Toast, notice"
				note="Read out through the page's one polite live region; it adds none of its own. Dismiss it, then show it again."
			>
				<ToastDemo
					message="Your answers were cleared."
					isConfirmed={false}
					showLabel="Show the notice"
					startsOpen
				/>
			</Specimen>

			<Specimen
				id="toast-confirmed"
				title="Toast, confirmed"
				note="A confirmed action gets the wax pulse once. Under reduced motion it appears in its final state with no pulse."
			>
				<ToastDemo
					message="Link copied."
					isConfirmed
					showLabel="Show the confirmed toast"
					startsOpen={false}
				/>
			</Specimen>

			<Specimen
				id="pill-room"
				title="Pill on the room"
				note="A label, not a control. Neutral has a divider edge; wax is a wax-muted fill with plain text, never wax text."
			>
				{pills}
			</Specimen>

			<Specimen
				id="pill-paper"
				title="Pill on paper"
				note="The same pills on a sheet take paper's ink edges."
			>
				<OnPaper>{pills}</OnPaper>
			</Specimen>

			<Specimen
				id="kbd-room"
				title="Kbd on the room"
				note="A key or a chord in Plex Mono 13/20."
			>
				<p className="flex flex-wrap items-center gap-2">
					Press <Kbd>⌘K</Kbd> or <Kbd>Ctrl K</Kbd> to open the menu.
				</p>
			</Specimen>

			<Specimen
				id="kbd-paper"
				title="Kbd on paper"
				note="On a sheet the key takes paper's ink edge."
			>
				<OnPaper>
					<p className="flex flex-wrap items-center gap-2">
						Press <Kbd>Enter</Kbd> to continue.
					</p>
				</OnPaper>
			</Specimen>
		</section>
	);
}
