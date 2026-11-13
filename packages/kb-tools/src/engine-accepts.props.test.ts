import { audit, EngineError, next, start } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText } from "./index";
import { answersArb, kbArb, renderYaml } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

/** Codes that would mean the validator let through a knowledge base the engine rejects. */
const FORBIDDEN_AUDIT = ["NON_INTEGER_MONEY", "INVALID_KB", "CYCLE"];
const FORBIDDEN_START = ["INVALID_KB", "CYCLE"];

/** The code of an `EngineError` thrown by `fn`, `undefined` if it returns; other throws are rethrown. */
function thrownCode(fn: () => unknown): string | undefined {
	try {
		fn();
		return undefined;
	} catch (e) {
		if (e instanceof EngineError) return e.code;
		throw e;
	}
}

/** A generated knowledge base that passes validation, with type-valid answers for its askable facts. */
const passingKbAndAnswersArb = kbArb.chain((generated) => {
	const r = compileText(renderYaml(generated), FILE);
	// The premise: zero Error_Diagnostics.
	if (!r.ok) return fc.constant(undefined);
	const kb = r.kb;
	return answersArb(kb).map((answers) => ({ kb, answers }));
});

describe("Property 3: A passing knowledge base is accepted by the engine", () => {
	// Feature: kb-tools, Property 3: A passing knowledge base is accepted by the engine
	// **Validates: Requirements 17.3, 17.4, 17.5**
	it("start, next and audit throw no INVALID_KB, CYCLE or NON_INTEGER_MONEY", () => {
		let checked = 0;
		fc.assert(
			fc.property(passingKbAndAnswersArb, (sample) => {
				fc.pre(sample !== undefined);
				if (sample === undefined) return;
				const { kb, answers } = sample;
				checked++;

				const session = start(kb);
				expect(FORBIDDEN_START).not.toContain(thrownCode(() => next(session)));

				// EVALUATION_ERROR (for example DIVISION_BY_ZERO) is allowed.
				const code = thrownCode(() => audit(kb, answers));
				expect(FORBIDDEN_AUDIT).not.toContain(code);
			}),
			{ numRuns: 200 },
		);
		// The property is not vacuous.
		expect(checked).toBeGreaterThan(100);
	});
});
