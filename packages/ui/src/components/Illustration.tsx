/** The four steps of the product, drawn in the kit's line style. */
export type IllustrationName = "rulebook" | "rules" | "verdict" | "proof";

export interface IllustrationProps {
	name: IllustrationName;
}

const DRAWINGS: Record<IllustrationName, string> = {
	// An open book with numbered lines.
	rulebook:
		"M8 12h13a3 3 0 0 1 3 3v23a2 2 0 0 0-2-2H8zM40 12H27a3 3 0 0 0-3 3v23a2 2 0 0 1 2-2h14zM12 18h4M12 23h7M12 28h5M29 18h7M29 23h4M29 28h7",
	// Rule cards, one set from another.
	rules:
		"M8 10h18v10H8zM22 28h18v10H22zM17 20v8a2 2 0 0 0 2 2h3M12 15h10M26 33h10",
	// A ledger with a ruled total.
	verdict:
		"M12 8h24v32H12zM16 15h10M30 15h2M16 21h10M30 21h2M16 27h10M30 27h2M16 32h16M16 35h16",
	// A proof tree: one joint, two bone ends.
	proof:
		"M24 8v10M24 18l-10 10M24 18l10 10M14 28v8M34 28v8M24 18a2 2 0 1 0 0 .01M14 38a2 2 0 1 0 0 .01M34 38a2 2 0 1 0 0 .01",
};

/**
 * A 48 px line drawing in currentColor with a 1.5 px stroke, inline, so it
 * follows the surface and needs no image request. It is decorative: the
 * heading beside it says what it shows.
 */
export function Illustration({ name }: IllustrationProps) {
	return (
		<svg
			viewBox="0 0 48 48"
			width="48"
			height="48"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			focusable="false"
			data-illustration={name}
			aria-hidden="true"
			className="shrink-0"
		>
			<path d={DRAWINGS[name]} />
		</svg>
	);
}
