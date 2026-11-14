import type { FactDef } from "@dead-certain/engine";
import { z } from "zod";
import {
	clip,
	type DiagnosticAt,
	type LocatedDiagnostic,
	makeError,
	SECTION,
} from "./diagnostics";
import type { ParsedClause, ParsedFact, ParsedKb, ParsedRule } from "./model";

const FACT_TYPES = ["boolean", "number", "money", "date", "enum"] as const;
const ROLES = ["deduction", "check"] as const;

/** The fact type each role requires. */
const ROLE_REQUIRED_TYPE: Readonly<
	Record<(typeof ROLES)[number], (typeof FACT_TYPES)[number]>
> = { check: "boolean", deduction: "money" };

const TOP_FIELDS = [
	"id",
	"currency",
	"goals",
	"facts",
	"rules",
	"clauses",
] as const;
const FACT_FIELDS = [
	"type",
	"ask",
	"why",
	"derived",
	"options",
	"role",
	"label",
] as const;
const RULE_FIELDS = ["id", "cite", "set", "because", "to", "when"] as const;
const CLAUSE_FIELDS = ["title", "text"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function hasOwn(target: object, key: string): boolean {
	return Object.hasOwn(target, key);
}

/** `to` and `when` accept a YAML string, boolean or number. */
const exprText = z.union([z.string(), z.boolean(), z.number()]);

const topSchema = z.strictObject({
	id: z.string(),
	currency: z
		.string()
		.regex(/^[A-Z]{3}$/)
		.optional(),
	goals: z.array(z.string()),
	// Checked as plain objects here and iterated entry by entry afterwards, so
	// Zod never sees a user-chosen key such as `__proto__`.
	facts: z.custom<Record<string, unknown>>(isPlainObject),
	rules: z.array(z.unknown()),
	clauses: z.custom<Record<string, unknown>>(isPlainObject),
});

const factSchema = z.strictObject({
	type: z.enum(FACT_TYPES),
	ask: z.string().optional(),
	why: z.string().optional(),
	label: z.string().optional(),
	derived: z.boolean().optional(),
	options: z.array(z.string()).optional(),
	role: z.enum(ROLES).optional(),
});

const ruleSchema = z.strictObject({
	id: z.string(),
	cite: z.string(),
	set: z.string(),
	because: z.string(),
	to: exprText,
	when: exprText.optional(),
});

const clauseSchema = z.strictObject({
	title: z.string(),
	text: z.string(),
});

type Issue = z.core.$ZodIssue;

interface Owner {
	readonly kind: "top" | "fact" | "rule" | "clause";
	/** For example `fact 'rent'` or `the top level`. */
	readonly label: string;
	readonly allowed: readonly string[];
	readonly entity: unknown;
	readonly id?: string;
}

function capitalise(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

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

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "a list";
	switch (typeof value) {
		case "string":
			return "a string";
		case "number":
			return "a number";
		case "boolean":
			return "a boolean";
		case "object":
			return "a mapping";
		default:
			return typeof value;
	}
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
		case "object":
			return "a mapping";
		default:
			return "a valid value";
	}
}

/**
 * The bad value as a message shows it. Never throws: JSON.stringify throws on
 * a BigInt, a cycle, and anything holding either, and validation is total.
 */
function shown(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "bigint") return `${value}n`;
	try {
		return JSON.stringify(value) ?? "?";
	} catch {
		return "[value that cannot be shown]";
	}
}

function fieldPhrase(path: readonly PropertyKey[], owner: Owner): string {
	const name = `Field '${pathText(path)}'`;
	return owner.kind === "top" ? name : `${name} of ${owner.label}`;
}

/**
 * Turn one Zod issue into Diagnostics with fixed English text. Zod's own
 * message text is never used, so wording does not depend on the Zod release.
 */
export function describeIssue(
	issue: Issue,
	owner: Owner,
	file: string,
	at: DiagnosticAt,
): LocatedDiagnostic[] {
	const base = {
		...(owner.id === undefined ? {} : { id: owner.id }),
		at,
	};
	const fieldName = issue.path[0];
	const field = fieldName === undefined ? undefined : String(fieldName);
	const parts = { ...base, ...(field === undefined ? {} : { field }) };

	if (issue.code === "unrecognized_keys") {
		const where = owner.kind === "top" ? "the top level" : owner.label;
		return issue.keys.map((key) =>
			makeError(
				"SCHEMA_INVALID",
				file,
				`Unknown field '${key}' in ${where}. Allowed fields: ${owner.allowed.join(", ")}.`,
				{ ...base, field: key },
			),
		);
	}

	const value = getAt(owner.entity, issue.path);

	if (issue.path.length === 0) {
		return [
			makeError(
				"SCHEMA_INVALID",
				file,
				`${capitalise(owner.label)} must be ${
					issue.code === "invalid_type"
						? expectedName(issue.expected)
						: "a mapping"
				}, but is ${typeName(owner.entity)}.`,
				parts,
			),
		];
	}

	if (value === undefined) {
		return [
			makeError(
				"SCHEMA_INVALID",
				file,
				`${capitalise(owner.label)} is missing the required field '${pathText(issue.path)}'.`,
				parts,
			),
		];
	}

	if (issue.code === "invalid_value") {
		return [
			makeError(
				"SCHEMA_INVALID",
				file,
				`${fieldPhrase(issue.path, owner)} must be one of ${issue.values.map(String).join(", ")}. Found '${shown(value)}'.`,
				parts,
			),
		];
	}

	if (issue.code === "invalid_format") {
		return [
			makeError(
				"SCHEMA_INVALID",
				file,
				`${fieldPhrase(issue.path, owner)} must be three upper-case letters, for example INR. Found '${shown(value)}'.`,
				parts,
			),
		];
	}

	if (owner.kind === "rule" && field === "cite" && typeof value === "number") {
		return [
			makeError(
				"SCHEMA_INVALID",
				file,
				`The 'cite' of ${owner.label} is a number. Quote it, for example cite: "${String(value)}".`,
				parts,
			),
		];
	}

	if (
		owner.kind === "rule" &&
		(field === "to" || field === "when") &&
		typeof value === "number" &&
		!Number.isFinite(value)
	) {
		return [
			makeError(
				"SCHEMA_INVALID",
				file,
				`${fieldPhrase(issue.path, owner)} is not a finite number (YAML read it as ${String(value)}). Write the expression as a quoted string.`,
				parts,
			),
		];
	}

	const expected =
		issue.code === "invalid_type"
			? expectedName(issue.expected)
			: issue.code === "invalid_union"
				? "a string, a boolean or a number"
				: "a mapping";
	return [
		makeError(
			"SCHEMA_INVALID",
			file,
			`${fieldPhrase(issue.path, owner)} must be ${expected}, but is ${typeName(value)}.`,
			parts,
		),
	];
}

/** Cross-field rules for one fact. Uses only well-typed values. */
function checkFactFields(
	name: string,
	entity: Record<string, unknown>,
	file: string,
	at: DiagnosticAt,
): LocatedDiagnostic[] {
	const diags: LocatedDiagnostic[] = [];
	const type = entity.type;
	const options = entity.options;
	const optionList =
		Array.isArray(options) && options.every((o) => typeof o === "string")
			? (options as string[])
			: undefined;

	if (type === "enum" && hasOwn(entity, "options") === false) {
		diags.push(
			makeError(
				"SCHEMA_INVALID",
				file,
				`Fact '${name}' has type enum but no 'options'. List the allowed values under options.`,
				{ id: name, field: "options", at },
			),
		);
	} else if (
		type === "enum" &&
		optionList !== undefined &&
		optionList.length === 0
	) {
		diags.push(
			makeError(
				"SCHEMA_INVALID",
				file,
				`Fact '${name}' has type enum but an empty 'options' list. List at least one allowed value.`,
				{ id: name, field: "options", at },
			),
		);
	}

	if (
		typeof type === "string" &&
		type !== "enum" &&
		hasOwn(entity, "options")
	) {
		diags.push(
			makeError(
				"SCHEMA_INVALID",
				file,
				`Fact '${name}' has 'options' but its type is '${type}', not enum. Remove options or change the type.`,
				{ id: name, field: "options", at },
			),
		);
	}

	if (optionList !== undefined) {
		const seen = new Set<string>();
		const reported = new Set<string>();
		for (const option of optionList) {
			if (seen.has(option) && !reported.has(option)) {
				reported.add(option);
				diags.push(
					makeError(
						"SCHEMA_INVALID",
						file,
						`Fact '${name}' lists the option '${option}' more than once.`,
						{ id: name, field: "options", at },
					),
				);
			}
			seen.add(option);
		}
	}

	if (
		hasOwn(entity, "role") &&
		entity.role !== undefined &&
		entity.derived !== true
	) {
		diags.push(
			makeError(
				"SCHEMA_INVALID",
				file,
				`Fact '${name}' has a 'role' but is not derived. Only derived facts are listed as line items; add derived: true or remove role.`,
				{ id: name, field: "role", at },
			),
		);
	}

	const role = entity.role;
	if (
		typeof role === "string" &&
		Object.hasOwn(ROLE_REQUIRED_TYPE, role) &&
		typeof type === "string" &&
		(FACT_TYPES as readonly string[]).includes(type)
	) {
		const required =
			ROLE_REQUIRED_TYPE[role as keyof typeof ROLE_REQUIRED_TYPE];
		if (type !== required) {
			diags.push(
				makeError(
					"ROLE_TYPE_MISMATCH",
					file,
					`Fact '${name}' has role '${role}' but its type is '${type}'. A ${role} fact must have type ${required}. Change the type or remove the role.`,
					{ id: name, field: "type", at },
				),
			);
		}
	}
	return diags;
}

export interface SchemaResult {
	readonly diagnostics: readonly LocatedDiagnostic[];
	/** Present exactly when `diagnostics` is empty. */
	readonly model?: ParsedKb;
}

function exprToText(value: string | boolean | number): string {
	return typeof value === "string" ? value : String(value);
}

/**
 * Check the shape of a Raw_KB and build the ParsedKb. Every violation in the
 * file is reported; the check never stops at the first.
 */
export function checkSchema(raw: unknown, file: string): SchemaResult {
	if (!isPlainObject(raw)) {
		return {
			diagnostics: [
				makeError(
					"SCHEMA_INVALID",
					file,
					`The top level of '${file}' must be a mapping, but is ${typeName(raw)}.`,
				),
			],
		};
	}

	const diags: LocatedDiagnostic[] = [];
	const topOwner: Owner = {
		kind: "top",
		label: "the top level",
		allowed: TOP_FIELDS,
		entity: raw,
	};
	const topAt: DiagnosticAt = { section: SECTION.top, index: 0 };
	const top = topSchema.safeParse(raw);
	if (!top.success) {
		for (const issue of top.error.issues) {
			const goalIndex =
				issue.path[0] === "goals" && typeof issue.path[1] === "number"
					? issue.path[1]
					: undefined;
			const at: DiagnosticAt =
				goalIndex === undefined
					? topAt
					: { section: SECTION.goals, index: goalIndex };
			diags.push(...describeIssue(issue, topOwner, file, at));
		}
	}

	const facts = new Map<string, ParsedFact>();
	if (isPlainObject(raw.facts)) {
		let index = 0;
		for (const [name, entity] of Object.entries(raw.facts)) {
			const at: DiagnosticAt = { section: SECTION.facts, index };
			index += 1;
			const owner: Owner = {
				kind: "fact",
				label: `fact '${clip(name)}'`,
				allowed: FACT_FIELDS,
				entity,
				id: name,
			};
			const parsed = factSchema.safeParse(entity);
			if (!parsed.success) {
				for (const issue of parsed.error.issues) {
					diags.push(...describeIssue(issue, owner, file, at));
				}
			}
			if (isPlainObject(entity)) {
				diags.push(...checkFactFields(name, entity, file, at));
			}
			if (parsed.success) {
				const d = parsed.data;
				const def: FactDef = {
					type: d.type,
					...(d.ask === undefined ? {} : { ask: d.ask }),
					...(d.why === undefined ? {} : { why: d.why }),
					...(d.derived === undefined ? {} : { derived: d.derived }),
					...(d.options === undefined ? {} : { options: d.options }),
					...(d.role === undefined ? {} : { role: d.role }),
					...(d.label === undefined ? {} : { label: d.label }),
				};
				facts.set(name, { name, index: at.index, def });
			}
		}
	}

	const rules: ParsedRule[] = [];
	if (Array.isArray(raw.rules)) {
		raw.rules.forEach((entity: unknown, index: number) => {
			const at: DiagnosticAt = { section: SECTION.rules, index };
			const rawId = isPlainObject(entity) ? entity.id : undefined;
			const id = typeof rawId === "string" ? rawId : undefined;
			const owner: Owner = {
				kind: "rule",
				label: id === undefined ? `rule #${index + 1}` : `rule '${clip(id)}'`,
				allowed: RULE_FIELDS,
				entity,
				...(id === undefined ? {} : { id }),
			};
			const parsed = ruleSchema.safeParse(entity);
			if (!parsed.success) {
				for (const issue of parsed.error.issues) {
					diags.push(...describeIssue(issue, owner, file, at));
				}
				return;
			}
			const r = parsed.data;
			rules.push({
				id: r.id,
				index,
				cite: r.cite,
				set: r.set,
				because: r.because,
				toText: exprToText(r.to),
				...(r.when === undefined ? {} : { whenText: exprToText(r.when) }),
			});
		});
	}

	const clauses = new Map<string, ParsedClause>();
	if (isPlainObject(raw.clauses)) {
		let index = 0;
		for (const [id, entity] of Object.entries(raw.clauses)) {
			const at: DiagnosticAt = { section: SECTION.clauses, index };
			index += 1;
			const owner: Owner = {
				kind: "clause",
				label: `clause '${clip(id)}'`,
				allowed: CLAUSE_FIELDS,
				entity,
				id,
			};
			const parsed = clauseSchema.safeParse(entity);
			if (!parsed.success) {
				for (const issue of parsed.error.issues) {
					diags.push(...describeIssue(issue, owner, file, at));
				}
			} else {
				clauses.set(id, {
					id,
					index: at.index,
					title: parsed.data.title,
					text: parsed.data.text,
				});
			}
		}
	}

	if (diags.length > 0 || !top.success) return { diagnostics: diags };

	const t = top.data;
	return {
		diagnostics: [],
		model: {
			id: t.id,
			...(t.currency === undefined ? {} : { currency: t.currency }),
			goals: t.goals,
			facts,
			rules,
			clauses,
		},
	};
}
