import type {
	Clause,
	FactDef,
	FactValue,
	Question,
} from "@dead-certain/engine/types";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useAnnounce } from "../a11y/LiveRegion";
import { useFocusOnMount } from "../a11y/useFocusOnMount";
import type { FormatContext } from "../types";
import { AnswerControl } from "./AnswerControl";
import { emptyAnswerMessage } from "./answerMessages";
import { Button } from "./Button";
import { ClauseQuote } from "./ClauseQuote";
import { Disclosure } from "./Disclosure";

export interface QuestionCardProps {
	question: Question;
	/** The field type and enum options come from here. */
	def: FactDef;
	/** Looked up by the app from `question.clause`. */
	clause?: Clause;
	value: FactValue | undefined;
	onChange: (next: FactValue | undefined) => void;
	/** Fires only when the answer is valid. */
	onSubmit: (fact: string, value: FactValue) => void;
	/** The Back button is left out when this is absent. */
	onBack?: () => void;
	/** "Question 3. Up to 6 more.", or "Last question." when nothing more can follow. */
	progress?: { index: number; moreAtMost: number };
	/** An error from outside the field, such as the engine rejecting the answer. */
	externalError?: string;
	/** Number facts only, supplied by the app: shown after the field. */
	unit?: string;
	/** Money facts only, supplied by the app: the smallest amount, in minor units. */
	min?: number;
	format: FormatContext;
}

function progressLine({
	index,
	moreAtMost,
}: NonNullable<QuestionCardProps["progress"]>): string {
	return moreAtMost === 0
		? "Last question."
		: `Question ${index}. Up to ${moreAtMost} more.`;
}

/** Focuses the answer field: the text input, else the chosen or first radio. */
function focusField(root: HTMLElement | null): void {
	const find = (selector: string) => root?.querySelector<HTMLElement>(selector);
	(
		find("input") ??
		find('[role="radio"][data-state="checked"]') ??
		find('[role="radio"]')
	)?.focus();
}

/**
 * One question at a time, with its reason. Continue is never disabled: it
 * validates, and an invalid answer gets its message and the focus.
 */
export function QuestionCard(props: QuestionCardProps) {
	// A new question starts with a fresh error, problem and closed panel.
	return <Card key={props.question.fact} {...props} />;
}

function Card({
	question,
	def,
	clause,
	value,
	onChange,
	onSubmit,
	onBack,
	progress,
	externalError,
	unit,
	min,
	format,
}: QuestionCardProps) {
	const headingId = useId();
	const progressId = useId();
	const headingRef = useRef<HTMLHeadingElement>(null);
	const fieldRef = useRef<HTMLDivElement>(null);
	const announce = useAnnounce();
	const [problem, setProblem] = useState<string | undefined>();
	const [ownError, setOwnError] = useState<string | undefined>();
	const [isExternalHidden, setExternalHidden] = useState(false);
	const [isWhyOpen, setWhyOpen] = useState(false);
	const [focusRequest, setFocusRequest] = useState(0);
	const line = progress ? progressLine(progress) : undefined;

	useFocusOnMount(headingRef);
	useEffect(() => {
		if (line) announce(line);
	}, [line, announce]);
	// Focus moves after the error renders, so the field is read with it.
	useEffect(() => {
		if (focusRequest > 0) focusField(fieldRef.current);
	}, [focusRequest]);

	const submit = (): void => {
		setExternalHidden(false);
		const message =
			problem ??
			(value === undefined ? emptyAnswerMessage(def.type) : undefined);
		if (message !== undefined || value === undefined) {
			setOwnError(message);
			setFocusRequest((n) => n + 1);
			return;
		}
		setOwnError(undefined);
		onSubmit(question.fact, value);
	};

	const closeWhyOnEscape = (event: KeyboardEvent<HTMLDivElement>): void => {
		if (event.key === "Escape" && isWhyOpen) setWhyOpen(false);
	};

	const error = ownError ?? (isExternalHidden ? undefined : externalError);
	const hasWhy = Boolean(question.why) || clause !== undefined;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Escape anywhere in the card closes its open panel.
		<div onKeyDown={closeWhyOnEscape} className="max-w-column">
			<h2
				ref={headingRef}
				id={headingId}
				tabIndex={-1}
				aria-describedby={line ? progressId : undefined}
				onKeyDown={(event) => {
					if (event.key !== "Enter") return;
					// Focus may move to a radio; Enter must not then pick it.
					event.preventDefault();
					submit();
				}}
				className="text-question font-semibold text-text"
			>
				{question.text}
			</h2>
			{line && (
				<p id={progressId} className="pt-1 text-sys-small text-text-soft">
					{line}
				</p>
			)}
			<div ref={fieldRef} className="pt-6">
				<AnswerControl
					fact={question.fact}
					def={def}
					value={value}
					onChange={(next, why) => {
						setProblem(why);
						setOwnError(undefined);
						setExternalHidden(true);
						onChange(next);
					}}
					onEnter={submit}
					error={error}
					labelledBy={headingId}
					unit={unit}
					min={min}
					format={format}
				/>
			</div>
			{hasWhy && (
				<div className="pt-4">
					<Disclosure
						title="Why this question?"
						open={isWhyOpen}
						onOpenChange={setWhyOpen}
					>
						<div className="space-y-4">
							{question.why && (
								<p data-why className="text-sys-body text-text">
									{question.why}
								</p>
							)}
							{clause && <ClauseQuote clause={clause} />}
						</div>
					</Disclosure>
				</div>
			)}
			<div className="flex flex-wrap items-center gap-3 pt-6">
				{onBack && <Button onClick={onBack}>Back</Button>}
				<div className="ml-auto">
					<Button variant="primary" onClick={submit}>
						Continue
					</Button>
				</div>
			</div>
		</div>
	);
}
