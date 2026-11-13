import type { FactDef, FactValue } from "@dead-certain/engine/types";
import type { AnswerEntry, FormatContext } from "../types";
import { humanize } from "./label";
import { formatValue } from "./value";

/**
 * The rail's entries for a session's answers, in answer order. An answer
 * whose fact has no definition is left out rather than printed raw.
 */
export function formatEntries(
	answers: Readonly<Record<string, FactValue>>,
	defs: Readonly<Record<string, FactDef>>,
	format: FormatContext,
): AnswerEntry[] {
	return Object.entries(answers).flatMap(([fact, value]) => {
		const def = defs[fact];
		if (!def) return [];
		return [
			{
				fact,
				label: def.label ?? humanize(fact),
				display: formatValue(def, value, format),
				value,
			},
		];
	});
}
