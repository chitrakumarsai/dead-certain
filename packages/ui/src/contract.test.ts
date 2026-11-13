import type { ErrorCode } from "@dead-certain/engine";
import { expectTypeOf, test } from "vitest";
import type { ButtonProps } from "./components/Button";
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
