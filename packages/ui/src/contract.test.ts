import type { ErrorCode } from "@dead-certain/engine";
import { expectTypeOf, test } from "vitest";
import type { ReplayFailure } from "./types";

// Each component task adds one expectTypeOf line here for its props, proving
// they take the engine's contract types without conversion.

test("every replay failure is an engine error code", () => {
	expectTypeOf<ReplayFailure>().toExtend<ErrorCode>();
});
