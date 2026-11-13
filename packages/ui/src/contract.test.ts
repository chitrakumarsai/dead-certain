import type { ErrorCode } from "@dead-certain/engine";
import type { Clause, FactSource } from "@dead-certain/engine/types";
import { expectTypeOf, test } from "vitest";
import type { ButtonProps } from "./components/Button";
import type {
	ClauseQuoteProps,
	ClauseRefProps,
} from "./components/ClauseQuote";
import type { DisclosureProps } from "./components/Disclosure";
import type { SourceBadgeProps } from "./components/SourceBadge";
import type { ReplayFailure, Surface } from "./types";

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
