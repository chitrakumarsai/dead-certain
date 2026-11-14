import type { KnowledgeBase } from "@dead-certain/engine";
import {
	type GoldenDiagnostic,
	MINIMUM_SCENARIOS,
	makeGolden,
	type ScenarioResult,
} from "./model";

/**
 * The rules that some passing scenario fires, and the diagnostics for the rest.
 * `kbFile` is the knowledge-base file, which owns the rules. `scenarioCount` is
 * every scenario of the knowledge base, passing or not.
 */
export function coverage(
	kb: KnowledgeBase,
	kbFile: string,
	results: readonly ScenarioResult[],
	scenarioCount: number,
): {
	readonly covered: readonly string[];
	readonly diagnostics: readonly GoldenDiagnostic[];
} {
	const fired = new Set<string>();
	for (const result of results) {
		if (result.status !== "passed") continue;
		for (const id of result.fired) fired.add(id);
	}
	const covered = kb.rules.map((rule) => rule.id).filter((id) => fired.has(id));
	const diagnostics: GoldenDiagnostic[] = kb.rules
		.filter((rule) => !fired.has(rule.id))
		.map((rule) =>
			makeGolden(
				"RULE_NOT_COVERED",
				kbFile,
				`No passing scenario fires rule '${rule.id}'.`,
				{ id: rule.id },
			),
		);
	if (scenarioCount < MINIMUM_SCENARIOS) {
		diagnostics.push(
			makeGolden(
				"TOO_FEW_SCENARIOS",
				kbFile,
				`Knowledge base '${kb.id}' has ${scenarioCount} scenarios; the build plan asks for at least ${MINIMUM_SCENARIOS}.`,
			),
		);
	}
	return { covered, diagnostics };
}
