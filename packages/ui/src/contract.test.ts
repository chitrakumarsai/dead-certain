import type { ErrorCode } from "@dead-certain/engine";
import type {
	Clause,
	FactDef,
	FactSource,
	FactValue,
	Question,
} from "@dead-certain/engine/types";
import { expectTypeOf, test } from "vitest";
import type { AnswerControlProps } from "./components/AnswerControl";
import type { AnswersRailProps } from "./components/AnswersRail";
import type { ButtonProps } from "./components/Button";
import type {
	ClauseQuoteProps,
	ClauseRefProps,
} from "./components/ClauseQuote";
import type { DisclosureProps } from "./components/Disclosure";
import type { FilmProps } from "./components/Film";
import type {
	ProportionBarProps,
	ProportionPart,
} from "./components/ProportionBar";
import type { QuestionCardProps } from "./components/QuestionCard";
import type { SheetProps } from "./components/Sheet";
import type { SourceBadgeProps } from "./components/SourceBadge";
import type { VerdictHeadlineProps } from "./components/VerdictHeadline";
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
