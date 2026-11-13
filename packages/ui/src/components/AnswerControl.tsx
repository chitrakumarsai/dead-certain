import type { FactDef, FactValue } from "@dead-certain/engine/types";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import { CheckCircle } from "../icons";
import type { FormatContext } from "../types";

export type AnswerControlProps = {
	fact: string;
	/** The control follows `def.type`; enum options come from `def.options`. */
	def: FactDef;
	value: FactValue | undefined;
	onChange: (next: FactValue | undefined) => void;
	/** Called when Enter is pressed inside a text-like field. */
	onEnter?: () => void;
	/** Plain words, shown under the field. */
	error?: string;
	/** Id of the question heading that names this control. */
	labelledBy: string;
	/** Number facts only: shown after the field, such as "days". */
	unit?: string;
	/** Money facts only: the smallest accepted amount, in minor units. */
	min?: number;
	format: FormatContext;
	autoFocus?: boolean;
	disabled?: boolean;
};

const CHOICE =
	"inline-flex min-h-touch min-w-24 items-center justify-center gap-2 rounded-control border border-control-border px-6 text-sys-body font-semibold text-text transition-colors duration-(--dur-press) ease-kit hover:bg-text/10 data-[state=checked]:border-text data-[state=checked]:bg-text data-[state=checked]:text-surface disabled:cursor-not-allowed disabled:border-dashed disabled:text-text-soft disabled:hover:bg-transparent aria-invalid:border-denied";

/** Yes and No as two large radio buttons. Keys 1 and 2 pick them. */
function BooleanBody({
	value,
	onChange,
	labelledBy,
	errorId,
	error,
	autoFocus,
	disabled,
}: Pick<
	AnswerControlProps,
	"value" | "onChange" | "labelledBy" | "error" | "autoFocus" | "disabled"
> & { errorId: string }) {
	const groupRef = useRef<HTMLDivElement>(null);
	const selected = value === true ? "yes" : value === false ? "no" : "";

	useEffect(() => {
		if (!autoFocus) return;
		groupRef.current
			?.querySelector<HTMLButtonElement>(
				'[data-state="checked"], [role="radio"]',
			)
			?.focus();
	}, [autoFocus]);

	const pickByDigit = (event: KeyboardEvent<HTMLDivElement>): void => {
		const choice = { "1": "yes", "2": "no" }[event.key];
		if (!choice || disabled) return;
		event.preventDefault();
		onChange(choice === "yes");
		groupRef.current
			?.querySelector<HTMLButtonElement>(`[value="${choice}"]`)
			?.focus();
	};

	return (
		<RadioGroup.Root
			ref={groupRef}
			value={selected}
			onValueChange={(next) => onChange(next === "yes")}
			onKeyDown={pickByDigit}
			aria-labelledby={labelledBy}
			aria-invalid={error ? true : undefined}
			aria-describedby={error ? errorId : undefined}
			disabled={disabled}
			orientation="horizontal"
			className="flex flex-wrap gap-3"
		>
			{(["yes", "no"] as const).map((choice) => (
				<RadioGroup.Item
					key={choice}
					value={choice}
					aria-invalid={error ? true : undefined}
					className={CHOICE}
				>
					{selected === choice && <CheckCircle />}
					{choice === "yes" ? "Yes" : "No"}
				</RadioGroup.Item>
			))}
		</RadioGroup.Root>
	);
}

/**
 * One answer field whose body follows the fact's type. This task builds the
 * boolean body; tasks 6.2 to 6.5 add enum, money, number and date.
 */
export function AnswerControl(props: AnswerControlProps) {
	const errorId = useId();
	const { def, error } = props;

	let body: React.ReactNode;
	switch (def.type) {
		case "boolean":
			body = <BooleanBody {...props} errorId={errorId} />;
			break;
		default:
			// Never throws: a type without a body yet renders a plain line.
			body = (
				<p className="text-sys-small text-text-soft">
					This answer type is not available yet.
				</p>
			);
	}

	return (
		<div className="space-y-2">
			{body}
			{error && (
				<p
					id={errorId}
					className="text-sys-body font-semibold text-denied in-data-[surface=film]:text-text"
				>
					{error}
				</p>
			)}
		</div>
	);
}
