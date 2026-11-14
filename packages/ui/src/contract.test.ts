import type { ErrorCode } from "@dead-certain/engine";
import type {
	Alternative,
	Clause,
	FactDef,
	FactSource,
	FactValue,
	LineItem,
	ProofNode,
	Question,
	Verdict,
} from "@dead-certain/engine/types";
import { expectTypeOf, test } from "vitest";
import type { AnswerControlProps } from "./components/AnswerControl";
import type { AnswersRailProps } from "./components/AnswersRail";
import type { ButtonProps } from "./components/Button";
import type { CheckRowProps } from "./components/CheckRow";
import type {
	ClauseQuoteProps,
	ClauseRefProps,
} from "./components/ClauseQuote";
import type { DisclosureProps } from "./components/Disclosure";
import type { FilmProps } from "./components/Film";
import type { LedgerProps } from "./components/Ledger";
import type { ProofTreeProps } from "./components/ProofTree";
import type {
	ProportionBarProps,
	ProportionPart,
} from "./components/ProportionBar";
import type { TreeState } from "./components/proofTreeState";
import type { QuestionCardProps } from "./components/QuestionCard";
import type { SheetProps } from "./components/Sheet";
import type { SourceBadgeProps } from "./components/SourceBadge";
import type { VerdictHeadlineProps } from "./components/VerdictHeadline";
import type { WhatIfListProps } from "./components/WhatIfList";
import type { XrayStageProps, XrayTarget } from "./components/XrayStage";
import type {
	AnswerEntry,
	FormatContext,
	ReplayFailure,
	SkippedNote,
	Surface,
	VerdictState,
} from "./types";

// Each component task adds one expectTypeOf line here for its props, proving
// they take the engine's contract types without conversion.

test("every replay failure is an engine error code", () => {
	expectTypeOf<ReplayFailure>().toExtend<ErrorCode>();
});

test("Button props: three variants, an optional surface, plain children", () => {
	expectTypeOf<ButtonProps["variant"]>().toEqualTypeOf<
		"primary" | "secondary" | "quiet" | undefined
	>();
	expectTypeOf<ButtonProps["surface"]>().toEqualTypeOf<Surface | undefined>();
	expectTypeOf<"Continue">().toExtend<ButtonProps["children"]>();
});

test("Disclosure props: a title, and controlled or uncontrolled open state", () => {
	expectTypeOf<DisclosureProps["title"]>().toEqualTypeOf<string>();
	expectTypeOf<DisclosureProps["open"]>().toEqualTypeOf<boolean | undefined>();
	expectTypeOf<DisclosureProps["onOpenChange"]>().toEqualTypeOf<
		((open: boolean) => void) | undefined
	>();
});

test("SourceBadge takes the engine's FactSource unchanged", () => {
	expectTypeOf<SourceBadgeProps["source"]>().toEqualTypeOf<FactSource>();
});

test("ClauseQuote takes the engine's Clause unchanged; ClauseRef may lack it", () => {
	expectTypeOf<ClauseQuoteProps["clause"]>().toEqualTypeOf<Clause>();
	expectTypeOf<ClauseRefProps["clause"]>().toEqualTypeOf<Clause | undefined>();
	expectTypeOf<ClauseRefProps["id"]>().toEqualTypeOf<string>();
});

test("Sheet and Film props", () => {
	expectTypeOf<SheetProps["as"]>().toEqualTypeOf<
		"section" | "div" | "article" | undefined
	>();
	expectTypeOf<FilmProps["presentation"]>().toEqualTypeOf<"side" | "sheet">();
	expectTypeOf<FilmProps["onClose"]>().toEqualTypeOf<() => void>();
});

test("AnswerControl takes FactDef and FactValue unchanged, and has no allowZero", () => {
	expectTypeOf<AnswerControlProps["def"]>().toEqualTypeOf<FactDef>();
	expectTypeOf<AnswerControlProps["value"]>().toEqualTypeOf<
		FactValue | undefined
	>();
	expectTypeOf<AnswerControlProps["format"]>().toEqualTypeOf<FormatContext>();
	expectTypeOf<AnswerControlProps>().not.toHaveProperty("allowZero");
});

test("QuestionCard takes Question, FactDef and Clause unchanged", () => {
	expectTypeOf<QuestionCardProps["question"]>().toEqualTypeOf<Question>();
	expectTypeOf<QuestionCardProps["def"]>().toEqualTypeOf<FactDef>();
	expectTypeOf<QuestionCardProps["clause"]>().toEqualTypeOf<
		Clause | undefined
	>();
	expectTypeOf<QuestionCardProps["onSubmit"]>().toEqualTypeOf<
		(fact: string, value: FactValue) => void
	>();
	expectTypeOf<QuestionCardProps["onBack"]>().toEqualTypeOf<
		(() => void) | undefined
	>();
});

test("AnswersRail takes answer entries and calls back with the fact", () => {
	expectTypeOf<AnswersRailProps["answers"]>().toEqualTypeOf<
		readonly AnswerEntry[]
	>();
	expectTypeOf<AnswersRailProps["skipped"]>().toEqualTypeOf<
		readonly SkippedNote[] | undefined
	>();
	expectTypeOf<AnswersRailProps["onChange"]>().toEqualTypeOf<
		(fact: string) => void
	>();
	expectTypeOf<AnswerEntry["value"]>().toEqualTypeOf<FactValue>();
});

test("VerdictHeadline takes a VerdictState, a statement and two sizes", () => {
	expectTypeOf<VerdictHeadlineProps["state"]>().toEqualTypeOf<VerdictState>();
	expectTypeOf<"₹1,42,500 of ₹2,10,000 will be paid">().toExtend<
		VerdictHeadlineProps["statement"]
	>();
	expectTypeOf<VerdictHeadlineProps["size"]>().toEqualTypeOf<
		"verdict" | "summary" | undefined
	>();
	expectTypeOf<VerdictHeadlineProps["headingLevel"]>().toEqualTypeOf<
		1 | 2 | undefined
	>();
});

test("ProportionBar takes a total, paid and cut parts, and a format", () => {
	expectTypeOf<ProportionBarProps["total"]>().toEqualTypeOf<number>();
	expectTypeOf<ProportionBarProps["parts"]>().toEqualTypeOf<
		readonly ProportionPart[]
	>();
	expectTypeOf<ProportionPart["kind"]>().toEqualTypeOf<"paid" | "cut">();
	expectTypeOf<ProportionBarProps["format"]>().toEqualTypeOf<FormatContext>();
});

test("Ledger takes LineItem unchanged and hands back the item and its opener", () => {
	expectTypeOf<LedgerProps["items"]>().toEqualTypeOf<readonly LineItem[]>();
	expectTypeOf<LedgerProps["onOpen"]>().toEqualTypeOf<
		(item: LineItem, opener: HTMLElement) => void
	>();
	expectTypeOf<LedgerProps["claimed"]>().toEqualTypeOf<{
		label: string;
		value: number;
	}>();
	expectTypeOf<LedgerProps["selectedFact"]>().toEqualTypeOf<
		string | undefined
	>();
	expectTypeOf<LedgerProps["format"]>().toEqualTypeOf<FormatContext>();
});

test("CheckRow takes LineItem, Question and FactDef unchanged", () => {
	expectTypeOf<CheckRowProps["item"]>().toEqualTypeOf<LineItem>();
	expectTypeOf<CheckRowProps["question"]>().toEqualTypeOf<
		Question | undefined
	>();
	expectTypeOf<CheckRowProps["def"]>().toEqualTypeOf<FactDef | undefined>();
	expectTypeOf<CheckRowProps["detail"]>().toEqualTypeOf<string | undefined>();
	expectTypeOf<CheckRowProps["onAnswer"]>().toEqualTypeOf<
		((fact: string, value: FactValue) => void) | undefined
	>();
	expectTypeOf<CheckRowProps["onOpen"]>().toEqualTypeOf<
		(item: LineItem, opener: HTMLElement) => void
	>();
});

test("WhatIfList takes Verdict and Alternative unchanged", () => {
	expectTypeOf<WhatIfListProps["current"]>().toEqualTypeOf<Verdict>();
	expectTypeOf<WhatIfListProps["alternatives"]>().toEqualTypeOf<
		readonly Alternative[]
	>();
	expectTypeOf<WhatIfListProps["defFor"]>().toEqualTypeOf<
		(fact: string) => FactDef | undefined
	>();
	expectTypeOf<WhatIfListProps["amountGoal"]>().toEqualTypeOf<
		string | undefined
	>();
});

test("ProofTree takes the engine's ProofNode and Clause unchanged", () => {
	expectTypeOf<ProofTreeProps["root"]>().toEqualTypeOf<ProofNode>();
	expectTypeOf<ProofTreeProps["clauseFor"]>().toEqualTypeOf<
		((clauseId: string) => Clause | undefined) | undefined
	>();
	expectTypeOf<ProofTreeProps["formatValue"]>().toEqualTypeOf<
		(fact: string, value: FactValue | undefined) => string
	>();
	expectTypeOf<ProofTreeProps["onEscape"]>().toEqualTypeOf<() => void>();
	expectTypeOf<ProofTreeProps["initialState"]>().toEqualTypeOf<
		TreeState | undefined
	>();
});

test("XrayStage takes a verdict or line target, null when closed", () => {
	expectTypeOf<XrayTarget>().toEqualTypeOf<
		{ kind: "verdict" } | { kind: "line"; fact: string }
	>();
	expectTypeOf<XrayStageProps["target"]>().toEqualTypeOf<XrayTarget | null>();
	expectTypeOf<XrayStageProps["title"]>().toEqualTypeOf<
		(target: XrayTarget) => string
	>();
	expectTypeOf<XrayStageProps["onClose"]>().toEqualTypeOf<() => void>();
});
