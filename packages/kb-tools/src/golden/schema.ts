import { z } from "zod";
import { shown } from "../schema";
import { type GoldenDiagnostic, makeGolden } from "./model";

type Issue = z.core.$ZodIssue;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const TOP_FIELDS = ["kb", "scenarios"] as const;
const SCENARIO_FIELDS = ["id", "title", "mode", "facts", "expect"] as const;
const EXPECT_FIELDS = [
	"ask",
	"goals",
	"line_items",
	"needed",
	"fires",
] as const;

/** A value a scenario may give for a fact. `null` is let through for the checker to report. */
const factValue = z.custom<boolean | number | string | null>(
	(value) =>
		value === null ||
		typeof value === "boolean" ||
		typeof value === "string" ||
		(typeof value === "number" && Number.isFinite(value)),
	{ message: "FACT_VALUE" },
);

const names = z.array(z.string());

const expectSchema = z.strictObject({
	ask: z.string().optional(),
	goals: z.record(z.string(), factValue).optional(),
	line_items: z.record(z.string(), factValue).optional(),
	needed: names.optional(),
	fires: names.optional(),
});

const scenarioSchema = z
	.strictObject({
		id: z.string().regex(ID_PATTERN),
		title: z.string().min(1),
		mode: z.enum(["consult", "audit"]).optional(),
		facts: z.record(z.string(), factValue),
		expect: expectSchema,
	})
	.superRefine((scenario, ctx) => {
		const mode = scenario.mode ?? "consult";
		const e = scenario.expect;
		const who = `scenario '${scenario.id}'`;
		const bad = (path: string, message: string): void =>
			ctx.addIssue({ code: "custom", message, path: ["expect", path] });
		if (e.ask !== undefined) {
			if (mode === "audit") {
				bad(
					"ask",
					`Field 'expect.ask' of ${who} is for consult scenarios, and this one is audit.`,
				);
			}
			for (const other of ["goals", "line_items", "needed", "fires"] as const) {
				if (e[other] !== undefined) {
					bad(
						other,
						`Field 'expect.${other}' of ${who} cannot be given with 'expect.ask', which must be the only field of expect.`,
					);
				}
			}
			return;
		}
		if (e.goals === undefined) {
			bad(
				"goals",
				`Scenario '${scenario.id}' is missing the required field 'expect.goals'. Give it, or give expect.ask alone.`,
			);
		}
		if (e.needed !== undefined && mode === "consult") {
			bad(
				"needed",
				`Field 'expect.needed' of ${who} is for audit scenarios, and this one is consult.`,
			);
		}
	});

export const goldenSchema = z.strictObject({
	kb: z.string().min(1),
	scenarios: z.array(scenarioSchema).min(1),
});

function getAt(value: unknown, path: readonly PropertyKey[]): unknown {
	let current: unknown = value;
	for (const step of path) {
		if (typeof current !== "object" || current === null) return undefined;
		if (!Object.hasOwn(current, step)) return undefined;
		current = (current as Record<PropertyKey, unknown>)[step];
	}
	return current;
}

function pathText(path: readonly PropertyKey[]): string {
	let text = "";
	for (const step of path) {
		text +=
			typeof step === "number"
				? `[${step}]`
				: `${text === "" ? "" : "."}${String(step)}`;
	}
	return text;
}

function expectedName(expected: unknown): string {
	switch (expected) {
		case "string":
			return "a string";
		case "number":
			return "a number";
		case "boolean":
			return "a boolean";
		case "array":
			return "a list";
		case "record":
		case "object":
			return "a mapping";
		default:
			return "a valid value";
	}
}

/** Where an issue sits: the scenario index and the path inside the scenario. */
function locate(path: readonly PropertyKey[]): {
	index: number | undefined;
	rest: readonly PropertyKey[];
} {
	if (path[0] === "scenarios" && typeof path[1] === "number") {
		return { index: path[1], rest: path.slice(2) };
	}
	return { index: undefined, rest: path };
}

/**
 * Turn one Zod issue into GoldenDiagnostics with fixed English text. Zod's own
 * message text is never used, so wording does not depend on the Zod release.
 */
export function describeGoldenIssue(
	issue: Issue,
	raw: unknown,
	file: string,
): GoldenDiagnostic[] {
	const { index, rest } = locate(issue.path);
	const isTop = index === undefined;
	const rawId = getAt(raw, ["scenarios", index ?? -1, "id"]);
	const id = typeof rawId === "string" ? rawId : undefined;
	const name = id ?? `#${(index ?? 0) + 1}`;
	const field = pathText(isTop ? issue.path : rest);
	const first = isTop ? issue.path[0] : rest[0];
	const parts = {
		...(id === undefined ? {} : { id }),
		...(first === undefined ? {} : { field: String(first) }),
	};
	const fieldPhrase = isTop
		? `Field '${field}'`
		: `Field '${field}' of scenario '${name}'`;
	const make = (message: string) =>
		makeGolden("SCHEMA_INVALID", file, message, parts);

	if (issue.code === "unrecognized_keys") {
		const inExpect = !isTop && rest[0] === "expect";
		const allowed = isTop
			? TOP_FIELDS
			: inExpect
				? EXPECT_FIELDS
				: SCENARIO_FIELDS;
		const where = isTop
			? "the top level"
			: inExpect
				? `expect of scenario '${name}'`
				: `scenario '${name}'`;
		return issue.keys.map((key) =>
			makeGolden(
				"SCHEMA_INVALID",
				file,
				`Unknown field '${key}' in ${where}. Allowed fields: ${allowed.join(", ")}.`,
				{ ...(id === undefined ? {} : { id }), field: key },
			),
		);
	}

	const value = getAt(raw, issue.path);

	if (issue.code === "custom") {
		return [
			make(
				issue.message === "FACT_VALUE"
					? `${fieldPhrase} must be a boolean, a finite number, a string or null. Found '${typeof value === "number" ? String(value) : shown(value)}'.`
					: issue.message,
			),
		];
	}

	if (issue.code === "invalid_type") {
		if (value === undefined) {
			return [
				make(
					isTop
						? `The top level is missing the required field '${field}'.`
						: `Scenario '${name}' is missing the required field '${field}'.`,
				),
			];
		}
		return [
			make(
				isTop && issue.path.length === 0
					? `The top level of '${file}' must be a mapping.`
					: `${fieldPhrase} must be ${expectedName(issue.expected)}.`,
			),
		];
	}

	if (issue.code === "too_small") {
		return [
			make(
				isTop && field === "scenarios"
					? "Field 'scenarios' must list at least one scenario."
					: `${fieldPhrase} must not be empty.`,
			),
		];
	}

	if (issue.code === "invalid_format") {
		return [
			make(
				`Scenario id '${shown(value)}' must start with a letter or a digit and use only letters, digits, '_' and '-'.`,
			),
		];
	}

	if (issue.code === "invalid_value") {
		return [
			make(`${fieldPhrase} must be consult or audit. Found '${shown(value)}'.`),
		];
	}

	return [make(`${fieldPhrase} is not valid.`)];
}
