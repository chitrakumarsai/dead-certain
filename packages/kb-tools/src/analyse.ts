import { checkCycles } from "./checks/cycles";
import { checkDeadGuards } from "./checks/dead-guards";
import { checkEnums } from "./checks/enums";
import { checkFallback } from "./checks/fallback";
import { checkGoals } from "./checks/goals";
import { checkMoney } from "./checks/money";
import { checkParseExprs } from "./checks/parse-exprs";
import { checkRefs } from "./checks/refs";
import { checkTypes } from "./checks/types";
import {
	type Diagnostic,
	finalizeDiagnostics,
	type LocatedDiagnostic,
} from "./diagnostics";
import { loadTextLocated } from "./load/yaml-load";
import type { ParsedKb } from "./model";
import { checkSchema } from "./schema";

export type AnalyseInput =
	| { readonly text: string }
	| { readonly value: unknown };

export interface Analysis {
	/** Sorted; see compareDiagnostics. */
	readonly diagnostics: readonly Diagnostic[];
	/** Present exactly when `diagnostics` holds no error. */
	readonly model?: ParsedKb;
}

/**
 * The single analysis behind validateText, validateRaw and compileText.
 * Phase 1 is structure: size, YAML, key checks and the Schema. If phase 1
 * reports an error, phase 2 does not run. Never throws on bad input.
 */
export function analyse(input: AnalyseInput, file: string): Analysis {
	const found: LocatedDiagnostic[] = [];
	let raw: unknown;

	if ("text" in input) {
		const loaded = loadTextLocated(input.text, file);
		found.push(...loaded.diagnostics);
		if (loaded.raw === undefined) {
			return { diagnostics: finalizeDiagnostics(found) };
		}
		raw = loaded.raw;
	} else {
		raw = input.value;
	}

	const schema = checkSchema(raw, file);
	found.push(...schema.diagnostics);

	const hasError = found.some((d) => d.severity === "error");
	if (hasError || schema.model === undefined) {
		return { diagnostics: finalizeDiagnostics(found) };
	}

	// Phase 2 checks are added here, one task at a time.
	found.push(...checkParseExprs(schema.model, file));
	found.push(...checkRefs(schema.model, file));
	found.push(...checkGoals(schema.model, file));
	found.push(...checkCycles(schema.model, file));
	found.push(...checkTypes(schema.model, file));
	found.push(...checkEnums(schema.model, file));
	found.push(...checkMoney(schema.model, file));
	found.push(...checkFallback(schema.model, file));
	found.push(...checkDeadGuards(schema.model, file));
	const diagnostics = finalizeDiagnostics(found);
	if (diagnostics.some((d) => d.severity === "error")) {
		return { diagnostics };
	}
	return { diagnostics, model: schema.model };
}
