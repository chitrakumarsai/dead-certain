import type {
	FactDef,
	FactValue,
	LineItem,
	Question,
} from "@dead-certain/engine/types";
import { useId } from "react";
import { CheckCircle, CrossCircle, QuestionCircle } from "../icons";
import type { FormatContext } from "../types";
import { AnswerControl } from "./AnswerControl";

export interface CheckRowProps {
	/** Role "check": true passes, false fails, anything else is unknown. */
	item: LineItem;
	/** Evidence line, such as ".gitignore line 12: .kiro/". */
	detail?: string;
	/** Present while the value is unknown and the engine needs an answer. */
	question?: Question;
	/**
	 * The definition of the fact the question asks for (`question.fact`), not of
	 * the check itself: a check is derived, so the engine asks for its input.
	 * The question is asked inline only when this is boolean.
	 */
	def?: FactDef;
	answerValue?: FactValue;
	/** Called with `question.fact`, the fact that was asked. */
	onAnswer?: (fact: string, value: FactValue) => void;
	/** `opener` is the rule button, so focus can return to it. */
	onOpen: (item: LineItem, opener: HTMLElement) => void;
	format: FormatContext;
}

type CheckState = "pass" | "fail" | "unknown";

const STATES: Readonly<
	Record<CheckState, { word: string; Icon: typeof CheckCircle; tone: string }>
> = {
	pass: { word: "Passed", Icon: CheckCircle, tone: "text-paid" },
	fail: { word: "Failed", Icon: CrossCircle, tone: "text-denied" },
	unknown: {
		word: "Needs your answer",
		Icon: QuestionCircle,
		tone: "text-text-soft",
	},
};

// A value that is not a boolean is shown as unknown, so a malformed check stays visible.
const stateOf = (value: FactValue | undefined): CheckState =>
	value === true ? "pass" : value === false ? "fail" : "unknown";

/**
 * One checklist item: its state in a word and an icon, the rule that decided
 * it, the evidence, and an inline question while the answer is unknown.
 * Render it inside a list.
 */
export function CheckRow({
	item,
	detail,
	question,
	def,
	answerValue,
	onAnswer,
	onOpen,
	format,
}: CheckRowProps) {
	const questionId = useId();
	const state = stateOf(item.value);
	const { word, Icon, tone } = STATES[state];
	// Only a yes/no fact is asked inline. Any other type would get a true/false
	// answer it cannot take, so it stays "Needs your answer" for the QuestionCard.
	const isAsking =
		state === "unknown" && question !== undefined && def?.type === "boolean";

	return (
		<li data-check={state} className="flex items-start gap-3 py-3">
			<span data-check-icon className={`pt-px ${tone}`}>
				<Icon />
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-sys-body text-text">{item.label}</p>
				<p data-check-word className={`text-sys-small font-semibold ${tone}`}>
					{word}
				</p>
				{detail && (
					<p
						data-detail
						className="pt-1 font-mono text-mono text-text-soft wrap-anywhere"
					>
						{detail}
					</p>
				)}
				{isAsking && (
					<div className="pt-3">
						<p id={questionId} className="text-sys-body text-text">
							{question.text}
						</p>
						<div className="pt-2">
							<AnswerControl
								fact={question.fact}
								def={def}
								value={answerValue}
								onChange={(next) => {
									if (next !== undefined) onAnswer?.(question.fact, next);
								}}
								labelledBy={questionId}
								format={format}
							/>
						</div>
					</div>
				)}
			</div>
			<button
				type="button"
				aria-label={`${word}: ${item.label}, rule ${item.rule}. See why`}
				onClick={(event) => onOpen(item, event.currentTarget)}
				// Up 8 px: the 44 px target centres the id, which would sit below the label line.
				className="-mt-2 min-h-touch shrink-0 rounded-control px-2 font-mono text-mono text-text underline underline-offset-4 transition-colors duration-(--dur-press) ease-kit hover:bg-text/10"
			>
				{item.rule}
			</button>
		</li>
	);
}
