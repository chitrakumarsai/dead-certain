import { describe, expect, it } from "vitest";
import { fixtureKb } from "../testkit/goldenFixture";
import { coverage } from "./coverage";
import type { ScenarioResult } from "./model";

const kb = fixtureKb();
const KB_FILE = "apps/fixture/kb/fixture.yaml";
const ALL = kb.rules.map((rule) => rule.id);

const result = (
	id: string,
	status: ScenarioResult["status"],
	fired: readonly string[],
): ScenarioResult => ({ id, status, fired, differences: [] });

describe("coverage", () => {
	it("reports every rule when nothing ran, with the rules in knowledge-base order", () => {
		const { covered, diagnostics } = coverage(kb, KB_FILE, [], 12);

		expect(covered).toEqual([]);
		expect(diagnostics.map((d) => d.id)).toEqual(ALL);
		expect(diagnostics[0]).toEqual({
			severity: "error",
			code: "RULE_NOT_COVERED",
			file: KB_FILE,
			id: ALL[0],
			message: `No passing scenario fires rule '${ALL[0]}'.`,
		});
	});

	it("reports only the rules that no passing scenario fires", () => {
		const { covered, diagnostics } = coverage(
			kb,
			KB_FILE,
			[
				result("a", "passed", ["PAY-02", "CAP-01"]),
				result("b", "passed", ["VER-03"]),
			],
			12,
		);

		expect(covered).toEqual(["CAP-01", "PAY-02", "VER-03"]);
		expect(diagnostics.map((d) => d.id)).toEqual(
			ALL.filter((id) => !covered.includes(id)),
		);
	});

	it("reports nothing when every rule is covered", () => {
		const { covered, diagnostics } = coverage(
			kb,
			KB_FILE,
			[result("a", "passed", ALL)],
			12,
		);

		expect(covered).toEqual(ALL);
		expect(diagnostics).toEqual([]);
	});

	it("takes nothing from a failed or an erroring scenario, or from one that asked a question", () => {
		const { covered } = coverage(
			kb,
			KB_FILE,
			[
				result("a", "failed", ["PAY-02"]),
				result("b", "error", ["CAP-01"]),
				result("c", "passed", []),
			],
			12,
		);

		expect(covered).toEqual([]);
	});

	it("warns below twelve scenarios and not at twelve", () => {
		const eleven = coverage(kb, KB_FILE, [result("a", "passed", ALL)], 11);
		const twelve = coverage(kb, KB_FILE, [result("a", "passed", ALL)], 12);

		expect(eleven.diagnostics).toEqual([
			{
				severity: "warning",
				code: "TOO_FEW_SCENARIOS",
				file: KB_FILE,
				message:
					"Knowledge base 'fixture' has 11 scenarios; the build plan asks for at least 12.",
			},
		]);
		expect(twelve.diagnostics).toEqual([]);
	});

	it("puts the warning after the uncovered rules, and counts scenarios that did not pass", () => {
		const { diagnostics } = coverage(
			kb,
			KB_FILE,
			[result("a", "failed", [])],
			1,
		);

		expect(diagnostics.at(-1)?.code).toBe("TOO_FEW_SCENARIOS");
		expect(
			diagnostics.slice(0, -1).every((d) => d.code === "RULE_NOT_COVERED"),
		).toBe(true);
	});
});
