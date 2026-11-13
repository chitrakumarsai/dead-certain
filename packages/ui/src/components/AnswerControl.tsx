import type { FactDef, FactValue } from "@dead-certain/engine/types";
import * as RadioGroup from "@radix-ui/react-radio-group";
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useRef,
} from "react";
import { humanize } from "../format/label";
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

interface Choice {
	/** The radio value Radix tracks. */
	readonly key: string;
	readonly label: string;
	/** What onChange receives. */
	readonly emit: FactValue;
}

/** Digits pick choices by position; only the first nine have one. */
const MAX_SHORTCUT = 9;

const CHOICE_BASE =
	"min-h-touch items-center gap-2 rounded-control border border-control-border text-sys-body font-semibold text-text transition-colors duration-(--dur-press) ease-kit hover:bg-text/10 data-[state=checked]:border-text data-[state=checked]:bg-text data-[state=checked]:text-surface aria-invalid:border-denied disabled:cursor-not-allowed disabled:border-dashed disabled:text-text-soft disabled:hover:bg-transparent disabled:data-[state=checked]:bg-transparent disabled:data-[state=checked]:text-text-soft";

/** The radio buttons inside a group, in order. */
function radiosIn(group: HTMLElement | null): HTMLButtonElement[] {
	return [
		...(group?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []),
	];
}

const LAYOUT = {
	row: {
		group: "flex flex-wrap gap-3",
		item: `inline-flex min-w-24 justify-center px-6 ${CHOICE_BASE}`,
	},
	cards: {
		group: "grid max-w-column gap-2 md:grid-cols-2",
		item: `flex w-full px-4 py-2 text-left ${CHOICE_BASE}`,
	},
};

type ChoiceBodyProps = Pick<
	AnswerControlProps,
	"onChange" | "labelledBy" | "error" | "autoFocus" | "disabled"
> & {
	choices: readonly Choice[];
	selected: string;
	errorId: string;
	layout: keyof typeof LAYOUT;
	/** Show the shortcut digit on each card. */
	showDigits: boolean;
};

/**
 * A radio group whose choices look like buttons or cards. Arrow keys move,
 * and while focus is in the group, 1 to 9 pick by position.
 */
function ChoiceBody({
	choices,
	selected,
	onChange,
	labelledBy,
	error,
	errorId,
	autoFocus,
	disabled,
	layout,
	showDigits,
}: ChoiceBodyProps) {
	const groupRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!autoFocus) return;
		const all = radiosIn(groupRef.current);
		(all.find((item) => item.dataset.state === "checked") ?? all[0])?.focus();
	}, [autoFocus]);

	const pickByDigit = (event: KeyboardEvent<HTMLDivElement>): void => {
		const position = Number(event.key);
		if (disabled || !Number.isInteger(position)) return;
		if (position < 1 || position > MAX_SHORTCUT) return;
		const choice = choices[position - 1];
		if (!choice) return;
		event.preventDefault();
		onChange(choice.emit);
		radiosIn(groupRef.current)[position - 1]?.focus();
	};

	return (
		<RadioGroup.Root
			ref={groupRef}
			value={selected}
			onValueChange={(key) => {
				const choice = choices.find((c) => c.key === key);
				if (choice) onChange(choice.emit);
			}}
			onKeyDown={pickByDigit}
			aria-labelledby={labelledBy}
			aria-invalid={error ? true : undefined}
			aria-describedby={error ? errorId : undefined}
			disabled={disabled}
			orientation={layout === "row" ? "horizontal" : undefined}
			className={LAYOUT[layout].group}
		>
			{choices.map((choice, i) => (
				<RadioGroup.Item
					key={choice.key}
					value={choice.key}
					aria-invalid={error ? true : undefined}
					className={LAYOUT[layout].item}
				>
					{selected === choice.key && <CheckCircle />}
					<span className="grow">{choice.label}</span>
					{showDigits && i < MAX_SHORTCUT && (
						<span
							data-shortcut
							aria-hidden="true"
							className="font-mono text-mono opacity-70"
						>
							{i + 1}
						</span>
					)}
				</RadioGroup.Item>
			))}
		</RadioGroup.Root>
	);
}

const YES_NO: readonly Choice[] = [
	{ key: "yes", label: "Yes", emit: true },
	{ key: "no", label: "No", emit: false },
];

/** The choices and the selected key for a boolean or enum fact. */
function choicesFor(
	def: FactDef,
	value: FactValue | undefined,
): { choices: readonly Choice[]; selected: string } | undefined {
	if (def.type === "boolean") {
		const selected = value === true ? "yes" : value === false ? "no" : "";
		return { choices: YES_NO, selected };
	}
	if (def.type === "enum") {
		const choices = (def.options ?? []).map((option) => ({
			key: option,
			label: humanize(option),
			emit: option,
		}));
		const selected =
			typeof value === "string" && def.options?.includes(value) ? value : "";
		return { choices, selected };
	}
	return undefined;
}

/**
 * One answer field whose body follows the fact's type. Boolean and enum are
 * built; tasks 6.3 to 6.5 add money, number and date.
 */
export function AnswerControl(props: AnswerControlProps) {
	const errorId = useId();
	const { def, value, error } = props;
	const choice = choicesFor(def, value);

	let body: ReactNode;
	if (choice) {
		body = (
			<ChoiceBody
				{...props}
				{...choice}
				errorId={errorId}
				layout={def.type === "boolean" ? "row" : "cards"}
				showDigits={def.type === "enum"}
			/>
		);
	} else {
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
