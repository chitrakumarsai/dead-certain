import { describe, expect, it } from "vitest";
import {
	clip,
	compareDiagnostics,
	type DiagnosticCode,
	finalizeDiagnostics,
	type LocatedDiagnostic,
	makeDiagnostic,
	makeError,
	makeWarning,
	severityOf,
} from "./diagnostics";

const ERRORS: readonly DiagnosticCode[] = [
	"READ_ERROR",
	"YAML_SYNTAX",
	"SCHEMA_INVALID",
	"PARSE_ERROR",
	"DUPLICATE_FACT",
	"DUPLICATE_RULE",
	"DUPLICATE_CLAUSE",
	"UNKNOWN_FACT",
	"UNKNOWN_GOAL",
	"UNKNOWN_SET_FACT",
	"UNKNOWN_CLAUSE",
	"UNKNOWN_PLACEHOLDER",
	"CYCLE",
	"GOAL_UNSET",
	"MISSING_ASK",
	"ENUM_VALUE_NOT_IN_OPTIONS",
	"SET_NON_DERIVED",
	"TYPE_MISMATCH",
	"NOT_BOOLEAN",
	"MONEY_NOT_ROUNDED",
	"ROLE_TYPE_MISMATCH",
];

describe("severity of each code", () => {
	it("has 21 error codes", () => {
		expect(ERRORS).toHaveLength(21);
		for (const code of ERRORS) {
			expect(severityOf(code)).toBe("error");
			expect(makeDiagnostic(code, "f.yaml", "m").severity).toBe("error");
		}
	});

	it("marks NO_FALLBACK_RULE and DEAD_GUARD as warnings", () => {
		for (const code of ["NO_FALLBACK_RULE", "DEAD_GUARD"] as const) {
			expect(severityOf(code)).toBe("warning");
			expect(makeWarning(code, "f.yaml", "m").severity).toBe("warning");
		}
		expect(makeError("CYCLE", "f.yaml", "m").severity).toBe("error");
	});
});

describe("clip", () => {
	it("leaves 200 characters alone", () => {
		const s = "a".repeat(200);
		expect(clip(s, 200)).toBe(s);
		expect(clip(s)).toBe(s);
	});

	it("clips 201 characters to 200 plus an ellipsis", () => {
		expect(clip("a".repeat(201), 200)).toBe(`${"a".repeat(200)}…`);
		expect(clip("a".repeat(201))).toBe(`${"a".repeat(200)}…`);
	});
});

describe("compareDiagnostics", () => {
	const d = (
		section: 0 | 1 | 2 | 3 | 4,
		index: number,
		code: DiagnosticCode,
		field: string | undefined,
		message: string,
	): LocatedDiagnostic =>
		makeDiagnostic(code, "f.yaml", message, {
			...(field === undefined ? {} : { field }),
			at: { section, index },
		});

	it("orders by section, index, code, field, then message", () => {
		const ordered = [
			d(0, 5, "YAML_SYNTAX", "z", "z"),
			d(1, 0, "YAML_SYNTAX", "z", "z"),
			d(1, 1, "CYCLE", "a", "a"),
			d(1, 1, "UNKNOWN_FACT", "a", "a"),
			d(1, 1, "UNKNOWN_FACT", "b", "a"),
			d(1, 1, "UNKNOWN_FACT", "b", "b"),
		];
		const shuffled = [
			ordered[3],
			ordered[5],
			ordered[0],
			ordered[2],
			ordered[4],
			ordered[1],
		] as LocatedDiagnostic[];
		expect([...shuffled].sort(compareDiagnostics)).toEqual(ordered);
	});

	it("compares strings by code unit and treats a missing field as empty", () => {
		expect(
			compareDiagnostics(
				d(0, 0, "CYCLE", undefined, "m"),
				d(0, 0, "CYCLE", "a", "m"),
			),
		).toBeLessThan(0);
		expect(
			compareDiagnostics(
				d(0, 0, "CYCLE", "a", "B"),
				d(0, 0, "CYCLE", "a", "a"),
			),
		).toBeLessThan(0);
	});

	it("finalizeDiagnostics sorts and drops the internal position", () => {
		const out = finalizeDiagnostics([
			d(2, 0, "CYCLE", undefined, "second"),
			d(0, 0, "CYCLE", undefined, "first"),
		]);
		expect(out.map((x) => x.message)).toEqual(["first", "second"]);
		for (const x of out) expect("at" in x).toBe(false);
	});
});
