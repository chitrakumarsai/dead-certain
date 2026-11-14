import type { Expr } from "../types";
import { isValidDate } from "./dates";

// ─── Token types ────────────────────────────────────────────────────────────

type TokenKind =
	| "NUMBER"
	| "DATE_LIT"
	| "ENUM_LIT"
	| "IDENT"
	| "BOOL_LIT"
	| "LPAREN"
	| "RPAREN"
	| "COMMA"
	| "PLUS"
	| "MINUS"
	| "STAR"
	| "SLASH"
	| "EQ"
	| "NEQ"
	| "LT"
	| "LTE"
	| "GT"
	| "GTE"
	| "EOF"
	| "INVALID_DATE_ERR"
	| "UNKNOWN_CHAR"
	| "BAD_QUOTE";

interface Token {
	readonly kind: TokenKind;
	readonly value: string;
	/** UTF-16 code unit offset in the source string. */
	readonly pos: number;
	/** True for keyword identifiers: and, or, not, min, max, round, if, days_between. */
	readonly keyword?: boolean;
	/** For BAD_QUOTE: whether the literal was never closed or was an empty enum. */
	readonly reason?: "unterminated" | "empty";
}

// ─── Keywords ────────────────────────────────────────────────────────────────

const BOOL_KEYWORDS = new Set(["true", "false"]);
const FUNCTION_KEYWORDS = new Set([
	"and",
	"or",
	"not",
	"min",
	"max",
	"round",
	"if",
	"days_between",
]);

// ─── Lexer ────────────────────────────────────────────────────────────────────

/**
 * Tokenizes the source string into a flat token array.
 * The last token is always EOF.
 * Uses a scan-then-parse strategy (the parser receives the full token array).
 *
 * Notes:
 * - Whitespace (U+0009, U+000A, U+000D, U+0020) is consumed and discarded.
 * - Date literals are double-quoted strings "YYYY-MM-DD"; bare hyphenated strings are
 *   NEVER matched as date literals (YAML-safety, Req 1.11).
 * - Enum literals are single-quoted strings 'content'.
 * - Keywords true/false → BOOL_LIT; and/or/not/min/max/round/if/days_between → IDENT with keyword:true.
 * - Two-character operators: ==, !=, <=, >= are matched before single-character ones.
 * - Invalid date content inside a terminated double-quoted string → INVALID_DATE_ERR token.
 * - Unterminated quoted literal or empty '' → BAD_QUOTE token (with reason).
 * - Any other character → UNKNOWN_CHAR token.
 */
function lex(source: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	const len = source.length;

	while (i < len) {
		const ch = source[i];

		// Skip whitespace: U+0009 TAB, U+000A LF, U+000D CR, U+0020 SPACE
		if (ch === "\t" || ch === "\n" || ch === "\r" || ch === " ") {
			i++;
			continue;
		}

		const pos = i;

		// Double-quoted date literal: "YYYY-MM-DD"
		if (ch === '"') {
			// Find closing quote
			let j = i + 1;
			while (j < len && source[j] !== '"') {
				j++;
			}
			if (j >= len) {
				tokens.push({
					kind: "BAD_QUOTE",
					value: source.slice(i, i + 50),
					pos,
					reason: "unterminated",
				});
				i = len;
				continue;
			}
			// j is the position of the closing quote
			const content = source.slice(i + 1, j);
			i = j + 1; // advance past closing quote

			if (isValidDate(content)) {
				tokens.push({ kind: "DATE_LIT", value: content, pos });
			} else {
				tokens.push({ kind: "INVALID_DATE_ERR", value: content, pos });
			}
			continue;
		}

		// Single-quoted enum literal: 'content'
		if (ch === "'") {
			let j = i + 1;
			while (j < len && source[j] !== "'") {
				j++;
			}
			if (j >= len) {
				tokens.push({
					kind: "BAD_QUOTE",
					value: source.slice(i, i + 50),
					pos,
					reason: "unterminated",
				});
				i = len;
				continue;
			}
			const content = source.slice(i + 1, j);
			i = j + 1; // advance past closing quote
			if (content.length === 0) {
				tokens.push({ kind: "BAD_QUOTE", value: "''", pos, reason: "empty" });
				continue;
			}
			tokens.push({ kind: "ENUM_LIT", value: content, pos });
			continue;
		}

		// Number literal: [0-9]+(\.[0-9]+)?
		if (ch !== undefined && ch >= "0" && ch <= "9") {
			let j = i + 1;
			while (
				j < len &&
				source[j] !== undefined &&
				(source[j] as string) >= "0" &&
				(source[j] as string) <= "9"
			) {
				j++;
			}
			// Check for decimal part
			if (j < len && source[j] === ".") {
				const afterDot = j + 1;
				if (
					afterDot < len &&
					source[afterDot] !== undefined &&
					(source[afterDot] as string) >= "0" &&
					(source[afterDot] as string) <= "9"
				) {
					j = afterDot + 1;
					while (
						j < len &&
						source[j] !== undefined &&
						(source[j] as string) >= "0" &&
						(source[j] as string) <= "9"
					) {
						j++;
					}
				}
				// If no digit after dot, don't consume the dot — leave it for the next iteration
			}
			tokens.push({ kind: "NUMBER", value: source.slice(i, j), pos });
			i = j;
			continue;
		}

		// Identifier or keyword: [A-Za-z_][A-Za-z0-9_]{0,127}
		if (
			ch !== undefined &&
			((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_")
		) {
			let j = i + 1;
			while (
				j < len &&
				j - i < 128 && // max 128 chars total (1 start + up to 127 body chars)
				source[j] !== undefined &&
				(((source[j] as string) >= "A" && (source[j] as string) <= "Z") ||
					((source[j] as string) >= "a" && (source[j] as string) <= "z") ||
					((source[j] as string) >= "0" && (source[j] as string) <= "9") ||
					source[j] === "_")
			) {
				j++;
			}
			const word = source.slice(i, j);
			i = j;

			if (BOOL_KEYWORDS.has(word)) {
				tokens.push({ kind: "BOOL_LIT", value: word, pos });
			} else if (FUNCTION_KEYWORDS.has(word)) {
				tokens.push({ kind: "IDENT", value: word, pos, keyword: true });
			} else {
				tokens.push({ kind: "IDENT", value: word, pos });
			}
			continue;
		}

		// Two-character operators (must check before single-character)
		if (i + 1 < len) {
			const two = (source[i] as string) + (source[i + 1] as string);
			if (two === "==") {
				tokens.push({ kind: "EQ", value: "==", pos });
				i += 2;
				continue;
			}
			if (two === "!=") {
				tokens.push({ kind: "NEQ", value: "!=", pos });
				i += 2;
				continue;
			}
			if (two === "<=") {
				tokens.push({ kind: "LTE", value: "<=", pos });
				i += 2;
				continue;
			}
			if (two === ">=") {
				tokens.push({ kind: "GTE", value: ">=", pos });
				i += 2;
				continue;
			}
		}

		// Single-character tokens
		if (ch === "<") {
			tokens.push({ kind: "LT", value: "<", pos });
			i++;
			continue;
		}
		if (ch === ">") {
			tokens.push({ kind: "GT", value: ">", pos });
			i++;
			continue;
		}
		if (ch === "+") {
			tokens.push({ kind: "PLUS", value: "+", pos });
			i++;
			continue;
		}
		if (ch === "-") {
			tokens.push({ kind: "MINUS", value: "-", pos });
			i++;
			continue;
		}
		if (ch === "*") {
			tokens.push({ kind: "STAR", value: "*", pos });
			i++;
			continue;
		}
		if (ch === "/") {
			tokens.push({ kind: "SLASH", value: "/", pos });
			i++;
			continue;
		}
		if (ch === "(") {
			tokens.push({ kind: "LPAREN", value: "(", pos });
			i++;
			continue;
		}
		if (ch === ")") {
			tokens.push({ kind: "RPAREN", value: ")", pos });
			i++;
			continue;
		}
		if (ch === ",") {
			tokens.push({ kind: "COMMA", value: ",", pos });
			i++;
			continue;
		}

		// Unknown character
		tokens.push({ kind: "UNKNOWN_CHAR", value: ch as string, pos });
		i++;
	}

	tokens.push({ kind: "EOF", value: "", pos: i });
	return tokens;
}

// ─── Public interface ─────────────────────────────────────────────────────────

export type ParseErrorCode =
	| "UNEXPECTED_TOKEN"
	| "UNEXPECTED_END"
	| "UNKNOWN_FUNCTION"
	| "TRAILING_CONTENT"
	| "INVALID_DATE"
	| "EMPTY_INPUT";

export interface ParseError {
	readonly code: ParseErrorCode;
	readonly message: string;
	readonly position: number;
}

export type ParseResult =
	| { readonly ok: true; readonly expr: Expr }
	| { readonly ok: false; readonly error: ParseError };

// ─── Parser internals ────────────────────────────────────────────────────────

/** Internal sentinel thrown to unwind the call stack on a parse failure. */
interface ParseFailure {
	readonly __parseFailure: true;
	readonly error: ParseError;
}

function makeFailure(
	code: ParseErrorCode,
	message: string,
	position: number,
): ParseFailure {
	return { __parseFailure: true, error: { code, message, position } };
}

function isParseFailure(v: unknown): v is ParseFailure {
	return (
		typeof v === "object" &&
		v !== null &&
		(v as Record<string, unknown>).__parseFailure === true
	);
}

interface ParserState {
	readonly tokens: Token[];
	pos: number;
}

function peek(state: ParserState): Token {
	return state.tokens[state.pos] as Token;
}

function advance(state: ParserState): Token {
	const t = state.tokens[state.pos] as Token;
	state.pos++;
	return t;
}

/** Consume a token of the given kind or throw ParseFailure. */
function expect(state: ParserState, kind: TokenKind): Token {
	const t = peek(state);
	if (t.kind !== kind) {
		if (t.kind === "EOF") {
			throw makeFailure(
				"UNEXPECTED_END",
				`Unexpected end of input, expected ${kind}`,
				t.pos,
			);
		}
		throw makeFailure(
			"UNEXPECTED_TOKEN",
			`Unexpected token '${t.value}' at position ${t.pos}, expected ${kind}`,
			t.pos,
		);
	}
	return advance(state);
}

// Builtin function set for fast lookup
const BUILTIN_FNS = new Set<string>([
	"min",
	"max",
	"round",
	"if",
	"days_between",
]);

function builtinArity(fn: string): number {
	switch (fn) {
		case "min":
		case "max":
		case "days_between":
			return 2;
		case "round":
			return 1;
		case "if":
			return 3;
		default:
			return -1;
	}
}

// ─── Parsing functions ────────────────────────────────────────────────────────

function parseExpr(state: ParserState): Expr {
	return parseOr(state);
}

function parseOr(state: ParserState): Expr {
	let left = parseAnd(state);
	while (true) {
		const t = peek(state);
		if (t.kind === "IDENT" && t.keyword && t.value === "or") {
			advance(state);
			const right = parseAnd(state);
			left = { kind: "binary", op: "or", left, right };
		} else {
			break;
		}
	}
	return left;
}

function parseAnd(state: ParserState): Expr {
	let left = parseCompare(state);
	while (true) {
		const t = peek(state);
		if (t.kind === "IDENT" && t.keyword && t.value === "and") {
			advance(state);
			const right = parseCompare(state);
			left = { kind: "binary", op: "and", left, right };
		} else {
			break;
		}
	}
	return left;
}

function parseCompare(state: ParserState): Expr {
	const left = parseAddSub(state);
	const t = peek(state);
	let op: "==" | "!=" | "<" | "<=" | ">" | ">=" | null = null;

	if (t.kind === "EQ") op = "==";
	else if (t.kind === "NEQ") op = "!=";
	else if (t.kind === "LT") op = "<";
	else if (t.kind === "LTE") op = "<=";
	else if (t.kind === "GT") op = ">";
	else if (t.kind === "GTE") op = ">=";

	if (op !== null) {
		advance(state);
		const right = parseAddSub(state);
		return { kind: "binary", op, left, right };
	}
	return left;
}

function parseAddSub(state: ParserState): Expr {
	let left = parseMulDiv(state);
	while (true) {
		const t = peek(state);
		if (t.kind === "PLUS") {
			advance(state);
			const right = parseMulDiv(state);
			left = { kind: "binary", op: "+", left, right };
		} else if (t.kind === "MINUS") {
			advance(state);
			const right = parseMulDiv(state);
			left = { kind: "binary", op: "-", left, right };
		} else {
			break;
		}
	}
	return left;
}

function parseMulDiv(state: ParserState): Expr {
	let left = parseUnary(state);
	while (true) {
		const t = peek(state);
		if (t.kind === "STAR") {
			advance(state);
			const right = parseUnary(state);
			left = { kind: "binary", op: "*", left, right };
		} else if (t.kind === "SLASH") {
			advance(state);
			const right = parseUnary(state);
			left = { kind: "binary", op: "/", left, right };
		} else {
			break;
		}
	}
	return left;
}

function parseUnary(state: ParserState): Expr {
	const t = peek(state);
	// unary `not` — keyword IDENT
	if (t.kind === "IDENT" && t.keyword && t.value === "not") {
		advance(state);
		const operand = parseUnary(state);
		return { kind: "unary", op: "not", operand };
	}
	// unary `-`
	if (t.kind === "MINUS") {
		advance(state);
		const operand = parseUnary(state);
		return { kind: "unary", op: "-", operand };
	}
	return parsePrimary(state);
}

function parsePrimary(state: ParserState): Expr {
	const t = peek(state);

	// Boolean literals: true / false
	if (t.kind === "BOOL_LIT") {
		advance(state);
		return {
			kind: "literal",
			type: "boolean",
			value: t.value === "true",
		};
	}

	// Number literal
	if (t.kind === "NUMBER") {
		advance(state);
		return {
			kind: "literal",
			type: "number",
			value: parseFloat(t.value),
		};
	}

	// Date literal — value is already the content without quotes
	if (t.kind === "DATE_LIT") {
		advance(state);
		return {
			kind: "literal",
			type: "date",
			value: t.value,
		};
	}

	// Invalid date — the lexer emitted this token for a double-quoted string with bad content
	if (t.kind === "INVALID_DATE_ERR") {
		advance(state);
		throw makeFailure(
			"INVALID_DATE",
			`Invalid date literal '${t.value.slice(0, 50)}' at position ${t.pos}`,
			t.pos,
		);
	}

	// Malformed quoted literal
	if (t.kind === "BAD_QUOTE") {
		advance(state);
		if (t.reason === "unterminated") {
			throw makeFailure(
				"UNEXPECTED_END",
				`Unterminated quoted literal starting at position ${t.pos}`,
				state.tokens[state.tokens.length - 1]?.pos ?? t.pos,
			);
		}
		throw makeFailure(
			"UNEXPECTED_TOKEN",
			`Empty enum literal at position ${t.pos}`,
			t.pos,
		);
	}

	// Enum literal — value is already the content without quotes
	if (t.kind === "ENUM_LIT") {
		advance(state);
		return {
			kind: "literal",
			type: "enum",
			value: t.value,
		};
	}

	// Identifier: keyword or regular
	if (t.kind === "IDENT") {
		// A keyword that is not `not` (already handled in parseUnary) cannot be used as a fact name
		if (t.keyword && t.value !== "not") {
			// If it's a builtin function name followed by `(`, handle as function call below.
			// First peek ahead.
			const next = state.tokens[state.pos + 1] as Token | undefined;
			if (next?.kind === "LPAREN" && BUILTIN_FNS.has(t.value)) {
				// handled by function-call branch below (fall through)
			} else {
				advance(state);
				throw makeFailure(
					"UNEXPECTED_TOKEN",
					`Keyword '${t.value}' cannot be used as a fact name or expression at position ${t.pos}`,
					t.pos,
				);
			}
		}

		advance(state); // consume the identifier

		// Function call: IDENT followed by LPAREN
		const next = peek(state);
		if (next.kind === "LPAREN") {
			// Check it's a known builtin
			if (!BUILTIN_FNS.has(t.value)) {
				throw makeFailure(
					"UNKNOWN_FUNCTION",
					`Unknown function '${t.value}' at position ${t.pos}`,
					t.pos,
				);
			}

			advance(state); // consume LPAREN

			const fn = t.value as "min" | "max" | "round" | "if" | "days_between";
			const expectedArity = builtinArity(fn);

			// Parse argument list
			const args: Expr[] = [];

			// Check for empty arg list first
			if (peek(state).kind === "RPAREN") {
				const rparen = advance(state);
				if (expectedArity !== 0) {
					throw makeFailure(
						"UNEXPECTED_TOKEN",
						`Function '${fn}' expects ${expectedArity} argument(s) but got 0 at position ${rparen.pos}`,
						rparen.pos,
					);
				}
				return { kind: "call", fn, args };
			}

			// Parse first arg
			args.push(parseExpr(state));

			// Parse subsequent args
			while (peek(state).kind === "COMMA") {
				// Check if we already have too many args before consuming the comma
				if (args.length >= expectedArity) {
					const commaPos = peek(state).pos;
					throw makeFailure(
						"UNEXPECTED_TOKEN",
						`Function '${fn}' expects ${expectedArity} argument(s) but got more at position ${commaPos}`,
						commaPos,
					);
				}
				advance(state); // consume COMMA
				args.push(parseExpr(state));
			}

			// Expect closing paren
			const rparen = peek(state);
			if (rparen.kind !== "RPAREN") {
				if (rparen.kind === "EOF") {
					throw makeFailure(
						"UNEXPECTED_END",
						`Unexpected end of input, expected ')' to close function call '${fn}'`,
						rparen.pos,
					);
				}
				throw makeFailure(
					"UNEXPECTED_TOKEN",
					`Expected ')' or ',' in argument list of '${fn}' but got '${rparen.value}' at position ${rparen.pos}`,
					rparen.pos,
				);
			}

			// Arity check: too few args
			if (args.length !== expectedArity) {
				throw makeFailure(
					"UNEXPECTED_TOKEN",
					`Function '${fn}' expects ${expectedArity} argument(s) but got ${args.length} at position ${rparen.pos}`,
					rparen.pos,
				);
			}

			advance(state); // consume RPAREN
			return { kind: "call", fn, args };
		}

		// Plain fact reference
		return { kind: "fact", name: t.value };
	}

	// Grouped expression: ( expr )
	if (t.kind === "LPAREN") {
		advance(state); // consume LPAREN
		const inner = parseExpr(state);
		expect(state, "RPAREN");
		return inner;
	}

	// EOF when expression expected
	if (t.kind === "EOF") {
		throw makeFailure("UNEXPECTED_END", "Unexpected end of input", t.pos);
	}

	// Anything else
	advance(state);
	throw makeFailure(
		"UNEXPECTED_TOKEN",
		`Unexpected token '${t.value}' at position ${t.pos}`,
		t.pos,
	);
}

// ─── Public interface ─────────────────────────────────────────────────────────

export function parse(source: string): ParseResult {
	let tokens: Token[];
	try {
		tokens = lex(source);
	} catch (_err) {
		// lex() should never throw, but guard just in case
		return {
			ok: false,
			error: {
				code: "UNEXPECTED_TOKEN",
				message: "Lexer error",
				position: 0,
			},
		};
	}

	// Empty input check: token stream is only [EOF]
	if (tokens.length === 1 && (tokens[0] as Token).kind === "EOF") {
		return {
			ok: false,
			error: {
				code: "EMPTY_INPUT",
				message: "Input is empty",
				position: 0,
			},
		};
	}

	const state: ParserState = { tokens, pos: 0 };

	try {
		const expr = parseExpr(state);

		// Check all tokens consumed
		const remaining = peek(state);
		if (remaining.kind !== "EOF") {
			return {
				ok: false,
				error: {
					code: "TRAILING_CONTENT",
					message: `Unexpected content '${remaining.value}' after expression at position ${remaining.pos}`,
					position: remaining.pos,
				},
			};
		}

		return { ok: true, expr };
	} catch (err) {
		if (isParseFailure(err)) {
			return { ok: false, error: err.error };
		}
		// Unexpected JS error — wrap it
		return {
			ok: false,
			error: {
				code: "UNEXPECTED_TOKEN",
				message: "An unexpected error occurred during parsing",
				position: 0,
			},
		};
	}
}
