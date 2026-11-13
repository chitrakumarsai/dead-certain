import {
	type Document,
	isAlias,
	isMap,
	isScalar,
	isSeq,
	LineCounter,
	parseDocument,
	type YAMLMap,
} from "yaml";
import {
	type Diagnostic,
	finalizeDiagnostics,
	type LocatedDiagnostic,
	makeError,
	SECTION,
} from "../diagnostics";
import { MAX_DEPTH, MAX_FILE_BYTES } from "../limits";

/** The plain value of a YAML mapping at the top of a knowledge-base file. */
export type ParsedRaw = Readonly<Record<string, unknown>>;

export type LoadResult =
	| {
			readonly ok: true;
			readonly raw: ParsedRaw;
			readonly diagnostics: readonly Diagnostic[];
	  }
	| { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/** Same as LoadResult but with located diagnostics, for the analysis pipeline. */
export interface LocatedLoad {
	/** Present whenever the top level was a mapping, even if diagnostics exist. */
	readonly raw?: ParsedRaw;
	readonly diagnostics: readonly LocatedDiagnostic[];
}

const MAX_ALIASES = 100;

type Ctx = "top" | "facts" | "clauses" | "other";

interface State {
	readonly file: string;
	readonly doc: Document;
	readonly lines: LineCounter;
	readonly diags: LocatedDiagnostic[];
	aliases: number;
	tooDeep: boolean;
	tooManyAliases: boolean;
}

function whereIs(st: State, node: unknown): string {
	const range = (node as { range?: readonly number[] | null }).range;
	if (range === undefined || range === null || range[0] === undefined) {
		return "";
	}
	const { line, col } = st.lines.linePos(range[0]);
	return ` (line ${line}, column ${col})`;
}

function exactSizeExceeds(text: string): boolean {
	// A string of more than MAX UTF-16 units has at least that many UTF-8 bytes.
	if (text.length > MAX_FILE_BYTES) return true;
	return new TextEncoder().encode(text).length > MAX_FILE_BYTES;
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	return typeof value;
}

function walkMap(
	node: YAMLMap,
	depth: number,
	ctx: Ctx,
	st: State,
): Record<string, unknown> {
	const seen = new Set<string>();
	const entries: [string, unknown][] = [];
	let index = 0;
	for (const pair of node.items) {
		const at = {
			section:
				ctx === "facts"
					? SECTION.facts
					: ctx === "clauses"
						? SECTION.clauses
						: SECTION.top,
			index: ctx === "facts" || ctx === "clauses" ? index : 0,
		};
		index += 1;
		const keyNode = isAlias(pair.key) ? pair.key.resolve(st.doc) : pair.key;
		if (!isScalar(keyNode) || typeof keyNode.value !== "string") {
			const shown = isScalar(keyNode)
				? String(keyNode.source ?? keyNode.value)
				: "a collection";
			const read = isScalar(keyNode)
				? `read by YAML as ${typeName(keyNode.value)}, not a string`
				: "not a string";
			st.diags.push(
				makeError(
					"SCHEMA_INVALID",
					st.file,
					`Mapping key ${shown}${whereIs(st, keyNode ?? pair.key)} is ${read}. Quote the key, for example "${shown}":`,
					{ at },
				),
			);
			walk(pair.value, depth + 1, "other", st);
			continue;
		}
		const name = keyNode.value;
		if (seen.has(name)) {
			const where = whereIs(st, keyNode);
			if (ctx === "facts") {
				st.diags.push(
					makeError(
						"DUPLICATE_FACT",
						st.file,
						`Fact '${name}'${where} is defined more than once. The first definition is used.`,
						{ id: name, at },
					),
				);
			} else if (ctx === "clauses") {
				st.diags.push(
					makeError(
						"DUPLICATE_CLAUSE",
						st.file,
						`Clause '${name}'${where} is defined more than once. The first definition is used.`,
						{ id: name, at },
					),
				);
			} else {
				st.diags.push(
					makeError(
						"YAML_SYNTAX",
						st.file,
						`Duplicate key '${name}'${where}. The first occurrence is used.`,
						{ field: name, at },
					),
				);
			}
			continue;
		}
		seen.add(name);
		const childCtx: Ctx =
			ctx === "top" && name === "facts"
				? "facts"
				: ctx === "top" && name === "clauses"
					? "clauses"
					: "other";
		entries.push([name, walk(pair.value, depth + 1, childCtx, st)]);
	}
	return Object.fromEntries(entries);
}

function walk(node: unknown, depth: number, ctx: Ctx, st: State): unknown {
	if (depth > MAX_DEPTH) {
		if (!st.tooDeep) {
			st.tooDeep = true;
			st.diags.push(
				makeError(
					"SCHEMA_INVALID",
					st.file,
					`The file nests values deeper than ${MAX_DEPTH} levels${whereIs(st, node)}. Flatten the structure.`,
				),
			);
		}
		return null;
	}
	let target = node;
	if (isAlias(target)) {
		st.aliases += 1;
		if (st.aliases > MAX_ALIASES) {
			if (!st.tooManyAliases) {
				st.tooManyAliases = true;
				st.diags.push(
					makeError(
						"YAML_SYNTAX",
						st.file,
						`The file uses more than ${MAX_ALIASES} YAML aliases${whereIs(st, node)}.`,
					),
				);
			}
			return null;
		}
		target = target.resolve(st.doc);
	}
	if (isScalar(target)) return target.value;
	if (isSeq(target)) {
		return target.items.map((item) => walk(item, depth + 1, "other", st));
	}
	if (isMap(target)) return walkMap(target, depth, ctx, st);
	return null;
}

/** Parse YAML text into a plain value, keeping located diagnostics. Never throws. */
export function loadTextLocated(text: string, file: string): LocatedLoad {
	if (exactSizeExceeds(text)) {
		return {
			diagnostics: [
				makeError(
					"SCHEMA_INVALID",
					file,
					`File '${file}' is larger than the 1 MiB limit (${MAX_FILE_BYTES} bytes).`,
				),
			],
		};
	}

	const lines = new LineCounter();
	let doc: Document;
	try {
		doc = parseDocument(text, {
			uniqueKeys: false,
			prettyErrors: false,
			lineCounter: lines,
		});
	} catch (error) {
		if (error instanceof RangeError) {
			return {
				diagnostics: [
					makeError(
						"YAML_SYNTAX",
						file,
						"The YAML is nested too deeply to read.",
					),
				],
			};
		}
		throw error;
	}

	if (doc.errors.length > 0) {
		return {
			diagnostics: doc.errors.map((error) => {
				const { line, col } = lines.linePos(error.pos[0]);
				return makeError(
					"YAML_SYNTAX",
					file,
					`YAML syntax error at line ${line}, column ${col}: ${error.code}: ${error.message}`,
				);
			}),
		};
	}

	const contents = doc.contents;
	if (contents === null || contents === undefined) {
		return {
			diagnostics: [
				makeError(
					"SCHEMA_INVALID",
					file,
					`File '${file}' is empty. A knowledge base is a YAML mapping.`,
				),
			],
		};
	}
	if (!isMap(contents)) {
		return {
			diagnostics: [
				makeError(
					"SCHEMA_INVALID",
					file,
					`The top level of '${file}' must be a mapping, but is ${isSeq(contents) ? "a list" : "a single value"}.`,
				),
			],
		};
	}

	const st: State = {
		file,
		doc,
		lines,
		diags: [],
		aliases: 0,
		tooDeep: false,
		tooManyAliases: false,
	};
	const raw = walkMap(contents, 0, "top", st);
	return { raw, diagnostics: st.diags };
}

/** Parse YAML and return the plain value, or sorted diagnostics. Never throws. */
export function loadText(text: string, file: string): LoadResult {
	const loaded = loadTextLocated(text, file);
	if (loaded.raw !== undefined && loaded.diagnostics.length === 0) {
		return { ok: true, raw: loaded.raw, diagnostics: [] };
	}
	return { ok: false, diagnostics: finalizeDiagnostics(loaded.diagnostics) };
}
