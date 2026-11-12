/**
 * Task 7 — Checkpoint: full pipeline smoke tests.
 * Exercises parse → evaluate end-to-end for two representative expressions.
 */
import { describe, expect, it } from "vitest";
import { UNKNOWN } from "../types";
import type { Env } from "./evaluate";
import { evaluate } from "./evaluate";
import { parse } from "./parse";

function run(src: string, env: Env) {
	const pr = parse(src);
	if (!pr.ok) throw new Error(`parse failed: ${pr.error.message}`);
	return evaluate(pr.expr, env);
}

// ---------------------------------------------------------------------------
// Smoke test 1: sum_insured * 0.01
// ---------------------------------------------------------------------------

describe("pipeline: sum_insured * 0.01", () => {
	it("sum_insured=500000 → 5000", () => {
		const result = run("sum_insured * 0.01", { sum_insured: 500_000 });
		expect(result).toEqual({ ok: true, value: 5000 });
	});
});

// ---------------------------------------------------------------------------
// Smoke test 2: if(age >= 61, claim * 0.05, 0)
// ---------------------------------------------------------------------------

describe("pipeline: if(age >= 61, claim * 0.05, 0)", () => {
	it("age=65, claim=100000 → 5000", () => {
		const result = run("if(age >= 61, claim * 0.05, 0)", {
			age: 65,
			claim: 100_000,
		});
		expect(result).toEqual({ ok: true, value: 5000 });
	});

	it("age absent → UNKNOWN", () => {
		const env: Env = { claim: 100_000 };
		const result = run("if(age >= 61, claim * 0.05, 0)", env);
		expect(result).toEqual({ ok: true, value: UNKNOWN });
	});
});
