import type { FactDef, FactValue } from "@dead-certain/engine/types";
import * as RadioGroup from "@radix-ui/react-radio-group";
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { humanize } from "../format/label";
import {
	currencySymbol,
	defaultLocale,
	formatMoney,
	reformatMoneyInput,
} from "../format/money";
import { CheckCircle } from "../icons";
import type { FormatContext } from "../types";
import { moneyAnswer, numberAnswer } from "./answerMessages";

export type AnswerControlProps = {
	fact: string;
	/** The control follows `def.type`; enum options come from `def.options`. */
	def: FactDef;
	value: FactValue | undefined;
	/**
	 * The parsed answer, or undefined while there is none. Text fields also pass
	 * the reason the text is not accepted, so the owner can show it on Enter.
	 */
	onChange: (next: FactValue | undefined, problem?: string) => void;
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

/** The currency name screen readers hear with the field, such as "Indian rupees". */
function currencyName(currency: string, locale: string): string {
	return (
		new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
			currencyDisplay: "name",
		})
			.formatToParts(1)
			.find((part) => part.type === "currency")?.value ?? currency
	);
}

/** Field text for a stored amount: "1,42,500", with no currency sign. */
function moneyText(
	value: FactValue | undefined,
	currency: string,
	locale: string,
) {
	if (typeof value !== "number") return "";
	const symbol = currencySymbol(currency, locale);
	return formatMoney(value, currency, locale).replace(symbol, "").trim();
}

const TEXT_FIELD =
	"min-h-touch w-full min-w-0 bg-transparent px-3 text-sys-body text-text outline-none placeholder:text-text-soft disabled:cursor-not-allowed disabled:text-text-soft";

const FIELD_FRAME =
	"flex max-w-80 items-center rounded-control border border-control-border bg-surface has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus has-focus-visible:outline-solid has-[:disabled]:border-dashed has-[[aria-invalid=true]]:border-denied";

type MoneyBodyProps = Pick<
	AnswerControlProps,
	| "value"
	| "onChange"
	| "onEnter"
	| "labelledBy"
	| "error"
	| "autoFocus"
	| "disabled"
	| "min"
	| "format"
> & { errorId: string };

/**
 * A money field. Digits regroup as they are typed and the caret stays after
 * the same digit. It emits integer minor units, or undefined with a reason.
 */
function MoneyBody({
	value,
	onChange,
	onEnter,
	labelledBy,
	error,
	errorId,
	autoFocus,
	disabled,
	min,
	format,
}: MoneyBodyProps) {
	const currency = format.currency ?? "INR";
	const locale = format.locale ?? defaultLocale(currency);
	const unitId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const pendingCaret = useRef<number | null>(null);
	const lastEmitted = useRef<FactValue | undefined>(value);
	const [text, setText] = useState(() => moneyText(value, currency, locale));

	// A value set from outside (not typed here) replaces the text.
	if (value !== lastEmitted.current) {
		lastEmitted.current = value;
		const next = moneyText(value, currency, locale);
		if (next !== text) setText(next);
	}

	useLayoutEffect(() => {
		const caret = pendingCaret.current;
		if (caret === null || document.activeElement !== inputRef.current) return;
		inputRef.current?.setSelectionRange(caret, caret);
		pendingCaret.current = null;
	});

	useEffect(() => {
		if (autoFocus) inputRef.current?.focus();
	}, [autoFocus]);

	const edit = (raw: string, caret: number): void => {
		const next = reformatMoneyInput(raw, caret, locale);
		pendingCaret.current = next.caret;
		setText(next.text);
		const answer = moneyAnswer(next.text, format, min);
		lastEmitted.current = answer.value;
		onChange(answer.value, answer.problem);
	};

	return (
		<div className={FIELD_FRAME}>
			<span aria-hidden="true" className="pl-3 text-sys-body text-text-soft">
				{currencySymbol(currency, locale)}
			</span>
			<span id={unitId} className="sr-only">
				{currencyName(currency, locale)}
			</span>
			<input
				ref={inputRef}
				type="text"
				inputMode="decimal"
				autoComplete="off"
				data-focus-ring="frame"
				value={text}
				disabled={disabled}
				aria-labelledby={`${labelledBy} ${unitId}`}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}
				onChange={(event) =>
					edit(
						event.target.value,
						event.target.selectionStart ?? event.target.value.length,
					)
				}
				onKeyDown={(event) => {
					if (event.key === "Enter") onEnter?.();
				}}
				className={`figures ${TEXT_FIELD}`}
			/>
		</div>
	);
}

type NumberBodyProps = Omit<MoneyBodyProps, "min" | "format"> &
	Pick<AnswerControlProps, "unit">;

/** A number field with an optional unit after it. Emits a number, or undefined with a reason. */
function NumberBody({
	value,
	onChange,
	onEnter,
	labelledBy,
	error,
	errorId,
	autoFocus,
	disabled,
	unit,
}: NumberBodyProps) {
	const unitId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const lastEmitted = useRef<FactValue | undefined>(value);
	const toText = (v: FactValue | undefined) =>
		typeof v === "number" ? String(v) : "";
	const [text, setText] = useState(() => toText(value));

	// A value set from outside (not typed here) replaces the text.
	if (value !== lastEmitted.current) {
		lastEmitted.current = value;
		const next = toText(value);
		if (next !== text) setText(next);
	}

	useEffect(() => {
		if (autoFocus) inputRef.current?.focus();
	}, [autoFocus]);

	return (
		<div className={FIELD_FRAME}>
			<input
				ref={inputRef}
				type="text"
				inputMode="decimal"
				autoComplete="off"
				data-focus-ring="frame"
				value={text}
				disabled={disabled}
				aria-labelledby={unit ? `${labelledBy} ${unitId}` : labelledBy}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}
				onChange={(event) => {
					setText(event.target.value);
					const answer = numberAnswer(event.target.value);
					lastEmitted.current = answer.value;
					onChange(answer.value, answer.problem);
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter") onEnter?.();
				}}
				className={`figures ${TEXT_FIELD}`}
			/>
			{unit && (
				<span id={unitId} className="pr-3 text-sys-body text-text-soft">
					{unit}
				</span>
			)}
		</div>
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
 * One answer field whose body follows the fact's type. Boolean, enum, money
 * and number are built; task 6.5 adds date.
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
	} else if (def.type === "money") {
		body = <MoneyBody {...props} errorId={errorId} />;
	} else if (def.type === "number") {
		body = <NumberBody {...props} errorId={errorId} />;
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
