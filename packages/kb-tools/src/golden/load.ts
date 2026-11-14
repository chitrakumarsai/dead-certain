import { loadText } from "../load/yaml-load";
import {
	type GoldenDiagnostic,
	type GoldenSet,
	type LoadGoldenResult,
	makeGolden,
	type Scenario,
} from "./model";
import { describeGoldenIssue, goldenSchema } from "./schema";

const FILE_CODES = new Set(["READ_ERROR", "YAML_SYNTAX", "SCHEMA_INVALID"]);

/** The kb-tools loader's diagnostics as golden ones; codes that golden does not have become SCHEMA_INVALID. */
export function fromLoader(
	diagnostics: readonly {
		code: string;
		file: string;
		message: string;
		id?: string;
		field?: string;
	}[],
): GoldenDiagnostic[] {
	return diagnostics.map((d) =>
		makeGolden(
			(FILE_CODES.has(d.code) ? d.code : "SCHEMA_INVALID") as
				| "READ_ERROR"
				| "YAML_SYNTAX"
				| "SCHEMA_INVALID",
			d.file,
			d.message,
			{
				...(d.id === undefined ? {} : { id: d.id }),
				...(d.field === undefined ? {} : { field: d.field }),
			},
		),
	);
}

/** Check a raw value against the grammar and build the GoldenSet. Never throws. */
export function loadGoldenRaw(value: unknown, file: string): LoadGoldenResult {
	const parsed = goldenSchema.safeParse(value);
	if (!parsed.success) {
		const diagnostics = parsed.error.issues.flatMap((issue) =>
			describeGoldenIssue(issue, value, file),
		);
		return { ok: false, diagnostics };
	}
	const scenarios: Scenario[] = parsed.data.scenarios.map((s) => {
		const e = s.expect;
		return {
			id: s.id,
			title: s.title,
			mode: s.mode ?? "consult",
			facts: s.facts,
			expect:
				e.ask !== undefined
					? { ask: e.ask }
					: {
							goals: e.goals ?? {},
							...(e.line_items === undefined
								? {}
								: { lineItems: e.line_items }),
							...(e.needed === undefined ? {} : { needed: e.needed }),
							...(e.fires === undefined ? {} : { fires: e.fires }),
						},
		};
	});
	const set: GoldenSet = { kb: parsed.data.kb, scenarios };
	return { ok: true, set, diagnostics: [] };
}

/** Read golden YAML text. Never throws; returns no partial set on failure. */
export function loadGolden(text: string, file: string): LoadGoldenResult {
	const loaded = loadText(text, file, "A golden file");
	if (!loaded.ok)
		return { ok: false, diagnostics: fromLoader(loaded.diagnostics) };
	return loadGoldenRaw(loaded.raw, file);
}
