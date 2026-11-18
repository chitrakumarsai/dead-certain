import { describe, expect, it } from "vitest";
import { shown } from "../schema";
import {
	GOLDEN_ERROR_CODES,
	GOLDEN_WARNING_CODES,
	goldenSeverity,
	MINIMUM_SCENARIOS,
	makeGolden,
} from "./model";

describe("golden diagnostics", () => {
	it("has 14 error codes and one warning code", () => {
		expect(GOLDEN_ERROR_CODES).toHaveLength(14);
		expect(GOLDEN_WARNING_CODES).toEqual(["TOO_FEW_SCENARIOS"]);
		expect(new Set([...GOLDEN_ERROR_CODES, ...GOLDEN_WARNING_CODES]).size).toBe(
			15,
		);
	});

	it("gives every code the right severity", () => {
		for (const code of GOLDEN_ERROR_CODES) {
			expect(goldenSeverity(code)).toBe("error");
		}
		expect(goldenSeverity("TOO_FEW_SCENARIOS")).toBe("warning");
	});

	it("sets severity from the code and omits id and field when not given", () => {
		expect(makeGolden("SCENARIO_FAILED", "f.yaml", "m")).toEqual({
			severity: "error",
			code: "SCENARIO_FAILED",
			file: "f.yaml",
			message: "m",
		});
		expect(
			makeGolden("TOO_FEW_SCENARIOS", "k.yaml", "m", { id: "G-1", field: "x" }),
		).toEqual({
			severity: "warning",
			code: "TOO_FEW_SCENARIOS",
			file: "k.yaml",
			message: "m",
			id: "G-1",
			field: "x",
		});
	});

	it("asks for twelve scenarios", () => {
		expect(MINIMUM_SCENARIOS).toBe(12);
	});
});

describe("shown, now exported", () => {
	it("keeps its behaviour", () => {
		const cycle: Record<string, unknown> = {};
		cycle.self = cycle;
		expect(shown(0n)).toBe("0n");
		expect(shown(cycle)).toBe("[value that cannot be shown]");
		expect(shown(Symbol("x"))).toBe("?");
		expect(shown("text")).toBe("text");
		expect(shown({ a: 1 })).toBe('{"a":1}');
	});
});
