import type { Clause } from "@dead-certain/engine/types";
import type { Surface } from "../types";

export interface ClauseQuoteProps {
	clause: Clause;
	/** "deciding" draws the wax rule beside the clause that decided the outcome. */
	variant?: "plain" | "deciding";
	/** A substring of `clause.text` to highlight. Nothing is guessed if it is absent. */
	mark?: string;
	surface?: Surface;
}

/** Clause text with `mark` wrapped in <mark>, or untouched when `mark` is not in it. */
function ClauseText({ text, mark }: { text: string; mark?: string }) {
	const at = mark ? text.indexOf(mark) : -1;
	if (!mark || at < 0) return <>{text}</>;
	return (
		<>
			{text.slice(0, at)}
			<mark className="bg-wax text-ink in-data-[surface=film]:text-film">
				{mark}
			</mark>
			{text.slice(at + mark.length)}
		</>
	);
}

/** A rulebook clause, quoted in the Document voice under its id and title. */
export function ClauseQuote({
	clause,
	variant = "plain",
	mark,
	surface,
}: ClauseQuoteProps) {
	const rule = variant === "deciding" ? "border-wax" : "border-divider";
	return (
		<blockquote
			data-surface={surface}
			className={`max-w-column border-l-2 pl-4 ${rule}`}
		>
			<p
				data-clause-heading
				className="font-sys text-sys-body font-semibold text-text"
			>
				<cite className="not-italic">Clause {clause.id}</cite>{" "}
				<span className="pl-1">{clause.title}</span>
			</p>
			<p data-clause-text className="pt-1 font-doc text-doc-body text-text">
				<ClauseText text={clause.text} mark={mark} />
			</p>
		</blockquote>
	);
}

export interface ClauseRefProps extends Omit<ClauseQuoteProps, "clause"> {
	/** The clause id a rule or line item cites. */
	id: string;
	/** The clause, when the app has it. Without it only the id is shown. */
	clause?: Clause;
}

/** Quotes the clause when the app supplies it, and prints only the id otherwise. */
export function ClauseRef({ id, clause, ...quote }: ClauseRefProps) {
	if (clause) return <ClauseQuote clause={clause} {...quote} />;
	return (
		<p data-surface={quote.surface} className="text-sys-small text-text-soft">
			Clause {id}
		</p>
	);
}
