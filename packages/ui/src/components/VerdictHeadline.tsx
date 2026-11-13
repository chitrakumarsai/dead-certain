import { type ReactNode, useEffect, useRef } from "react";
import { useAnnounce } from "../a11y/LiveRegion";
import { useFocusOnMount } from "../a11y/useFocusOnMount";
import {
	CheckCircle,
	CrossCircle,
	MinusCircle,
	QuestionCircle,
} from "../icons";
import type { VerdictState } from "../types";
import { VERDICT_WORDS } from "../verdictState";

export interface VerdictHeadlineProps {
	state: VerdictState;
	/** "₹1,42,500 of ₹2,10,000 will be paid". Set in tabular lining figures. */
	statement: ReactNode;
	/** verdict: 48/56, 36/44 on phones. summary: 36/44 at every width. */
	size?: "verdict" | "summary";
	headingLevel?: 1 | 2;
}

/** Word, icon and colour per state. Colour is never the only signal. */
const STATES: Readonly<
	Record<VerdictState, { word: string; Icon: typeof CheckCircle; tone: string }>
> = {
	paid: { word: VERDICT_WORDS.paid, Icon: CheckCircle, tone: "text-paid" },
	reduced: {
		word: VERDICT_WORDS.reduced,
		Icon: MinusCircle,
		tone: "text-reduced",
	},
	denied: {
		word: VERDICT_WORDS.denied,
		Icon: CrossCircle,
		tone: "text-denied",
	},
	ready: { word: VERDICT_WORDS.ready, Icon: CheckCircle, tone: "text-paid" },
	not_ready: {
		word: VERDICT_WORDS.not_ready,
		Icon: CrossCircle,
		tone: "text-denied",
	},
	undecided: {
		word: VERDICT_WORDS.undecided,
		Icon: QuestionCircle,
		tone: "text-text-soft",
	},
};

/**
 * The verdict in one heading: the state line, then the statement in the
 * document voice. It reads "Paid in part. ₹1,42,500 of ₹2,10,000 will be paid",
 * takes focus when it appears, and is announced.
 */
export function VerdictHeadline({
	state,
	statement,
	size = "verdict",
	headingLevel = 1,
}: VerdictHeadlineProps) {
	const ref = useRef<HTMLHeadingElement>(null);
	const announce = useAnnounce();
	const { word, Icon, tone } = STATES[state];
	const Heading = headingLevel === 1 ? "h1" : "h2";

	useFocusOnMount(ref, state);
	useEffect(() => {
		announce(ref.current?.textContent ?? word);
	}, [announce, word]);

	return (
		<Heading
			ref={ref}
			tabIndex={-1}
			data-state={state}
			className="max-w-column text-text"
		>
			<span
				className={`flex items-center gap-2 font-sys text-sys-body font-semibold ${tone}`}
			>
				<Icon />
				{/* Inline and in flow, so no space is read before the full stop: an
				    absolutely positioned sr-only span reads as "Paid in part ." */}
				<span>
					<span data-state-word>{word}</span>
					<span className="opacity-0">. </span>
				</span>
			</span>
			<span
				data-statement
				className={`block pt-2 font-doc font-normal figures ${
					size === "verdict" ? "text-verdict" : "text-summary"
				}`}
			>
				{statement}
			</span>
		</Heading>
	);
}
