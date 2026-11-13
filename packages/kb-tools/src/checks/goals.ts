import {
	clip,
	type LocatedDiagnostic,
	makeError,
	SECTION,
} from "../diagnostics";
import type { ParsedKb } from "../model";

/**
 * GOAL_UNSET, MISSING_ASK and SET_NON_DERIVED. A goal that is not a fact is
 * UNKNOWN_GOAL (refs.ts) and is skipped here. A derived fact with `ask` text
 * is accepted silently.
 */
export function checkGoals(kb: ParsedKb, file: string): LocatedDiagnostic[] {
	const out: LocatedDiagnostic[] = [];
	const setByRule = new Set<string>(kb.rules.map((r) => r.set));

	kb.goals.forEach((goal, index) => {
		if (!kb.facts.has(goal) || setByRule.has(goal)) return;
		out.push(
			makeError(
				"GOAL_UNSET",
				file,
				`Goal '${clip(goal)}' is not set by any rule.`,
				{ id: goal, at: { section: SECTION.goals, index } },
			),
		);
	});

	for (const fact of kb.facts.values()) {
		if (fact.def.derived === true || fact.def.ask !== undefined) continue;
		out.push(
			makeError(
				"MISSING_ASK",
				file,
				`Fact '${clip(fact.name)}' is not derived and has no 'ask' text.`,
				{
					id: fact.name,
					field: "ask",
					at: { section: SECTION.facts, index: fact.index },
				},
			),
		);
	}

	for (const rule of kb.rules) {
		const target = kb.facts.get(rule.set);
		if (target === undefined || target.def.derived === true) continue;
		out.push(
			makeError(
				"SET_NON_DERIVED",
				file,
				`Rule '${clip(rule.id)}' sets '${clip(rule.set)}', which is not marked derived: true.`,
				{
					id: rule.id,
					field: "set",
					at: { section: SECTION.rules, index: rule.index },
				},
			),
		);
	}

	return out;
}
