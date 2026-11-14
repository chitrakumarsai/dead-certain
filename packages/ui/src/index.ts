export { LiveRegion, useAnnounce } from "./a11y/LiveRegion";
export { useFocusOnMount } from "./a11y/useFocusOnMount";
export { useReducedMotion } from "./a11y/useReducedMotion";
export {
	AnswerControl,
	type AnswerControlProps,
} from "./components/AnswerControl";
export {
	AnswersRail,
	type AnswersRailProps,
} from "./components/AnswersRail";
export { AppShell, type AppShellProps } from "./components/AppShell";
export {
	ANSWER_MESSAGES,
	atLeastMessage,
	dateAnswer,
	decimalsMessage,
	emptyAnswerMessage,
	type MoneyAnswer,
	moneyAnswer,
	numberAnswer,
} from "./components/answerMessages";
export { Button, type ButtonProps } from "./components/Button";
export { CheckRow, type CheckRowProps } from "./components/CheckRow";
export {
	ClauseQuote,
	type ClauseQuoteProps,
	ClauseRef,
	type ClauseRefProps,
} from "./components/ClauseQuote";
export { Disclosure, type DisclosureProps } from "./components/Disclosure";
export { Film, type FilmProps } from "./components/Film";
export { Ledger, type LedgerProps } from "./components/Ledger";
export { ProofTree, type ProofTreeProps } from "./components/ProofTree";
export {
	ProportionBar,
	type ProportionBarProps,
	type ProportionPart,
} from "./components/ProportionBar";
export {
	initialTreeState,
	type TreeState,
} from "./components/proofTreeState";
export {
	QuestionCard,
	type QuestionCardProps,
} from "./components/QuestionCard";
export { Sheet, type SheetProps } from "./components/Sheet";
export { SourceBadge, type SourceBadgeProps } from "./components/SourceBadge";
export {
	VerdictHeadline,
	type VerdictHeadlineProps,
} from "./components/VerdictHeadline";
export { WhatIfList, type WhatIfListProps } from "./components/WhatIfList";
export {
	XrayStage,
	type XrayStageProps,
	type XrayTarget,
} from "./components/XrayStage";
export { formatEntries } from "./format/entries";
export { humanize, lowerFirst } from "./format/label";
export { formatMoney, parseMoney } from "./format/money";
export { formatDate, formatValue } from "./format/value";
export {
	CheckCircle,
	Chevron,
	Close,
	CrossCircle,
	InfoCircle,
	Menu,
	MinusCircle,
	QuestionCircle,
} from "./icons";
export { contrast } from "./tokens/contrast";
export type {
	AnswerEntry,
	FormatContext,
	ReplayFailure,
	SkippedNote,
	Surface,
	VerdictState,
} from "./types";
export { useMediaQuery } from "./useMediaQuery";
export { VERDICT_WORDS, verdictStateFrom } from "./verdictState";
