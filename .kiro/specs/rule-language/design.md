# Design Document: rule-language

## Overview

The rule-language component is the expression sub-system of Dead Certain. It owns three concerns:

1. **Grammar and AST** — a concrete TypeScript tagged-union (`Expr`) that represents every expression node and is JSON-serialisable so that compiled knowledge bases can be stored and loaded without re-parsing.
2. **Three operations** — `parse`, `print`, and `evaluate`, each with a total, typed return type (no throwing on bad input, no `any`).
3. **Three property-test files** — fast-check suites that prove the round-trip, total-parser, and three-valued-logic invariants.

All code lives in `packages/engine/src/`. The package has zero runtime dependencies; Vitest and fast-check are devDependencies only.

The component also drives the authoring of `docs/kb-format.md`, a human-facing reference document for knowledge-base authors. That document is a build artifact produced by this spec's tasks; this design describes what it must contain rather than its internal prose.

### Relationship to existing types

`packages/engine/src/types.ts` currently declares `export type Expr = unknown`. Requirement 6 defines the concrete `Expr` union that replaces it, with Claude Code's consent recorded in [PR #4, comment 6865345893](https://github.com/chitrakumarsai/dead-certain/pull/4#issuecomment-6865345893). The replacement is the first task of this spec; every downstream file (the parser, printer, evaluator, and kb-tools) depends on the concrete type being in place.

---

## Architecture

### Module layout

All source files live under `packages/engine/src/`. The package's public surface is `src/index.ts`; internal helpers are co-located and not re-exported unless consumed by another package.

```
packages/engine/src/
├── types.ts                   ← contract (modified: Expr, BinaryOp, BuiltinFn, UNKNOWN added here)
├── index.ts                   ← public re-exports (new: lang/* exports added)
└── lang/
    ├── expr.ts                ← re-exports UNKNOWN from types; no definitions of its own
    ├── dates.ts               ← shared date helpers: isValidDate, compareDates (used by lexer and evaluator)
    ├── parse.ts               ← parse() function and ParseResult / ParseError types
    ├── print.ts               ← print() function
    ├── evaluate.ts            ← evaluate() function and EvalResult / EvalError types
    ├── round-trip.props.test.ts    ← Req 7 property test
    ├── total-parser.props.test.ts  ← Req 8 property test
    ├── three-valued.props.test.ts  ← Req 9 property test
    └── finite-results.props.test.ts ← Req 11 property test
```

**Why a `lang/` subdirectory?** The engine directory will grow to include the inference engine, the proof-tree builder, and the session codec. Grouping all expression-language files under `lang/` avoids a flat `src/` directory and signals their shared concern.

### Data flow

```
Source string
    │
    ▼
┌─────────┐   ParseResult
│  parse  │──────────────▶ Expr (AST)
└─────────┘                   │
                              │
              ┌───────────────┼──────────────┐
              ▼               ▼              ▼
         ┌─────────┐    ┌──────────┐   ┌──────────────┐
         │  print  │    │ evaluate │   │ JSON.stringify│
         └─────────┘    └──────────┘   └──────────────┘
              │               │              │
              ▼               ▼              ▼
        Source string    EvalResult     JSON blob
        (canonical)                    (compiled KB)
```

The `parse → print` path is the round-trip; the printed string must parse back to the structurally equal AST. The `JSON.stringify → JSON.parse` path is the serialisation round-trip; the deserialised value must be structurally equal to the original because every `Expr` field is a JSON primitive, a `readonly Expr[]`, or a nested `Expr`.

---

## Components and Interfaces

### 1. `src/types.ts` — AST types and UNKNOWN sentinel (additions)

`types.ts` is the contract file shared across all lanes. The `Expr` union, its supporting types, and the `UNKNOWN` sentinel are defined here so that the `Rule` interface (which has fields `to: Expr` and `when?: Expr`) can reference a fully concrete `Expr` type without importing from an implementation file. `lang/expr.ts` imports these definitions from `../types` and may re-export them for convenience; it does not define them.

#### UNKNOWN sentinel

Three-valued logic requires a first-class `unknown` value that is distinct from JavaScript's `null`, `undefined`, and the boolean `false`. The sentinel is a unique symbol defined in `types.ts`:

```typescript
/** The unique sentinel for an indeterminate fact value. */
export const UNKNOWN: unique symbol = Symbol.for("dead-certain.unknown");
export type Unknown = typeof UNKNOWN;
```

Using `Symbol.for` makes the sentinel stable across module re-evaluations and across worker threads, while the `unique symbol` type keeps it distinct in TypeScript's type system. `EvalResult` and `Env` refer to this type rather than to `unknown` (the TypeScript keyword) to avoid confusion.

#### BinaryOp and BuiltinFn

Also defined in `types.ts`:

```typescript
export type BinaryOp =
  | "+" | "-" | "*" | "/"
  | "==" | "!=" | "<" | "<=" | ">" | ">="
  | "and" | "or";

export type BuiltinFn = "min" | "max" | "round" | "if" | "days_between";
```

#### Concrete Expr union

Also defined in `types.ts`, replacing the previous `export type Expr = unknown` placeholder:

```typescript
export type Expr =
  | { readonly kind: "literal"; readonly type: FactType; readonly value: FactValue }
  | { readonly kind: "fact";    readonly name: string }
  | { readonly kind: "unary";   readonly op: "not" | "-"; readonly operand: Expr }
  | { readonly kind: "binary";  readonly op: BinaryOp; readonly left: Expr; readonly right: Expr }
  | { readonly kind: "call";    readonly fn: BuiltinFn; readonly args: readonly Expr[] };
```

**Design decisions:**

- Every variant has a string `kind` discriminant. A `switch (node.kind)` with an exhaustive `default: satisfies never` branch catches missing cases at compile time.
- All fields are `readonly` to make AST nodes effectively immutable after construction. This eliminates a class of bugs in the evaluator where a node could be mutated during traversal.
- The `args` field on `"call"` is `readonly Expr[]` (not a tuple) because the arity of each built-in is validated by the parser and enforced by the evaluator, not by the type. A tuple would require five separate variant shapes or overloads and would complicate the generator in the round-trip test.
- `FactValue` (`boolean | number | string`) covers all five literal kinds: `boolean` → JS boolean, `number`/`money` → JS number (integer minor units for money), `date` → ISO string, `enum` → string. The `type` field on the literal node distinguishes `number` from `money` and `date` from `enum` at the type level.
- No `Function`, `symbol`, `bigint`, `undefined`, or class-instance types appear in any field, satisfying Req 6.3.

#### JSON shape examples

The JSON shape is the same as the TypeScript object — no transformation is needed because all fields are JSON primitives or nested `Expr` objects.

Expression: `sum_insured * 0.01`
```json
{
  "kind": "binary",
  "op": "*",
  "left":  { "kind": "fact", "name": "sum_insured" },
  "right": { "kind": "literal", "type": "number", "value": 0.01 }
}
```

Expression: `if(age >= 61, claim * 0.05, 0)`
```json
{
  "kind": "call",
  "fn": "if",
  "args": [
    {
      "kind": "binary",
      "op": ">=",
      "left":  { "kind": "fact", "name": "age" },
      "right": { "kind": "literal", "type": "number", "value": 61 }
    },
    {
      "kind": "binary",
      "op": "*",
      "left":  { "kind": "fact", "name": "claim" },
      "right": { "kind": "literal", "type": "number", "value": 0.05 }
    },
    { "kind": "literal", "type": "number", "value": 0 }
  ]
}
```

Expression: `not approved` (where `approved` is a fact name)
```json
{
  "kind": "unary",
  "op": "not",
  "operand": { "kind": "fact", "name": "approved" }
}
```

Expression: `'gold'` (enum literal)
```json
{ "kind": "literal", "type": "enum", "value": "gold" }
```

Expression: `"2026-11-10"` (date literal)
```json
{ "kind": "literal", "type": "date", "value": "2026-11-10" }
```

---

### 2. `src/lang/dates.ts` — Shared date helpers

One module owns calendar-date validity so the lexer and the evaluator can never disagree.

```typescript
/** True iff s is exactly YYYY-MM-DD with year 1–9999, month 01–12, and a real day (leap years observed). */
export function isValidDate(s: string): boolean;

/** Chronological comparison of two valid date strings: negative, zero, or positive.
 *  Precondition: both arguments satisfy isValidDate. Because the format is fixed-width,
 *  this is plain string comparison; days_between uses the same helper for validation. */
export function compareDates(a: string, b: string): number;
```

`parse.ts` imports `isValidDate` from `./dates` to validate `DATE_LIT` tokens; `evaluate.ts` imports `isValidDate` and `compareDates` from `./dates` for date ordering and `days_between` argument validation. Imports are extensionless.

---

### 3. `src/lang/parse.ts` — Parser

#### Public interface

```typescript
import type { Expr } from "../types";

export interface ParseError {
  readonly message: string;   // human-readable, ≤ 200 chars
  readonly position: number;  // UTF-16 code unit offset, 0-based
  readonly code: ParseErrorCode;
}

export type ParseErrorCode =
  | "UNEXPECTED_TOKEN"
  | "UNEXPECTED_END"
  | "UNKNOWN_FUNCTION"
  | "TRAILING_CONTENT"
  | "INVALID_DATE"
  | "EMPTY_INPUT";

export type ParseResult =
  | { readonly ok: true;  readonly expr: Expr }
  | { readonly ok: false; readonly error: ParseError };

/** Total parser: never throws, always returns ParseResult. */
export function parse(source: string): ParseResult;
```

#### Literal node type assignment

The parser is responsible for recording the `type` field on every `"literal"` node it creates. The assignment rules are:

| Syntactic form | Example | Parser assigns `type` |
|---|---|---|
| `true` / `false` | `true` | `"boolean"` |
| Integer or decimal number token | `42`, `3.14`, `100000` | `"number"` — the distinction between `"number"` and `"money"` cannot be made from syntax alone; type-checking money operands in context is the responsibility of the evaluator or the knowledge-base validator |
| Single-quoted string | `'approved'` | `"enum"` — whether the value matches a valid option in the enclosing knowledge base is checked at evaluation time, not parse time |
| Double-quoted string of the form `"YYYY-MM-DD"` | `"2026-11-10"` | `"date"` — an invalid date string (one that does not conform to ISO 8601 calendar format) causes the parser to return a `ParseError` with code `"INVALID_DATE"` |

#### Lexer

The parser uses a hand-written recursive-descent approach rather than a parser combinator library. This keeps the dependency count at zero and gives precise error positions. The lexer is an internal implementation detail not exported from `parse.ts`.

The lexer produces a flat token array before parsing begins (scan-then-parse rather than on-demand). This simplifies error recovery and makes position tracking straightforward.

Token kinds:

| Token | Pattern |
|-------|---------|
| `NUMBER` | `/[0-9]+(\.[0-9]+)?/` — integers and decimals |
| `DATE_LIT` | `/"[0-9]{4}-[0-9]{2}-[0-9]{2}"/` — double-quoted date |
| `ENUM_LIT` | `/'[^']+'/` — single-quoted enum |
| `IDENT` | `/[A-Za-z_][A-Za-z0-9_]{0,127}/` — identifiers and keywords |
| `LPAREN` / `RPAREN` | `(` / `)` |
| `COMMA` | `,` |
| `PLUS` / `MINUS` | `+` / `-` |
| `STAR` / `SLASH` | `*` / `/` |
| `EQ` / `NEQ` | `==` / `!=` |
| `LT` / `LTE` | `<` / `<=` |
| `GT` / `GTE` | `>` / `>=` |
| `EOF` | end of token stream |
| `UNKNOWN_CHAR` | any single character that starts no valid token (e.g. `$`, a leading `.`); carries its offset |
| `BAD_QUOTE` | an unterminated `'…` or `"…` literal (no closing quote before end of input), or an empty `''` literal; carries the opening-quote offset and a reason (`unterminated` or `empty`) |

Quoted-literal lexing order: on `'`, scan to the closing `'`; if none exists emit `BAD_QUOTE(unterminated)`; if the content is empty emit `BAD_QUOTE(empty)`. On `"`, scan to the closing `"`; if none exists emit `BAD_QUOTE(unterminated)`; otherwise the content is tested against `/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/` and `isValidDate`, and a terminated string that fails either test is reported as `INVALID_DATE`. `INVALID_DATE` is therefore produced only for terminated double-quoted strings. The parser maps tokens to errors as: `UNKNOWN_CHAR` → `UNEXPECTED_TOKEN` at the character; `BAD_QUOTE(unterminated)` → `UNEXPECTED_END` at `source.length`; `BAD_QUOTE(empty)` → `UNEXPECTED_TOKEN` at the opening quote. Because the lexer is scan-then-parse, these tokens are reported when the parser reaches them, so earlier syntax errors and `TRAILING_CONTENT` (e.g. `a $ b`) keep their existing precedence.

Whitespace (U+0009, U+000A, U+000D, U+0020) is consumed and discarded by the lexer; it never produces a token. Keyword detection happens in the lexer: when an `IDENT` matches `true`, `false`, `and`, `or`, `not`, `min`, `max`, `round`, `if`, or `days_between`, it is tagged as a keyword token. `true` and `false` produce `BOOL_LIT` tokens. The remaining keywords retain their `IDENT` kind but with a `keyword` flag; the parser uses context to distinguish `not` as an operator from an identifier starting with the same letters.

**Date validation:** After matching a terminated `DATE_LIT` token, the lexer strips the surrounding double quotes and validates the string with `isValidDate` from `./dates` (year 1–9999, month 01–12, real day accounting for month length and leap years). An invalid value produces an `INVALID_DATE` error at the opening quote's position. Unterminated strings and stray characters never produce `INVALID_DATE` (see token table above).

**YAML-safety rule (Req 1.11):** The lexer NEVER matches a bare hyphenated date string such as `2026-11-10` as a date literal. Such a string is parsed as a subtraction chain of number literals and identifiers or as an `UNEXPECTED_TOKEN` error; it is never silently promoted to a date.

#### Parser grammar (recursive descent)

The grammar encodes the precedence table from Req 1.7. Each level maps to one parsing function:

```
expr         → or_expr
or_expr      → and_expr  ( "or"  and_expr )*
and_expr     → compare   ( "and" compare  )*
compare      → add_sub   ( ( "==" | "!=" | "<" | "<=" | ">" | ">=" ) add_sub )?
add_sub      → mul_div   ( ( "+" | "-" ) mul_div )*
mul_div      → unary     ( ( "*" | "/" ) unary   )*
unary        → "not" unary | "-" unary | primary
primary      → BOOL_LIT | NUMBER | DATE_LIT | ENUM_LIT
             | IDENT "(" arglist ")"   -- function call
             | IDENT                   -- fact name
             | "(" expr ")"            -- grouped
arglist      → expr ( "," expr )*
```

Compare is non-associative at its level (a single optional right-hand side) which prevents `a < b < c` from parsing as `(a < b) < c`. The grammar models this by consuming at most one comparison operator per level.

After a successful parse, the parser checks that all tokens have been consumed. If the remaining token is not `EOF`, it emits `TRAILING_CONTENT` with the position of the first remaining non-whitespace character.

The empty-input check is the first thing the parse function does: if the token stream contains only `EOF`, it returns `EMPTY_INPUT` at position 0.

#### Function call validation

When the parser sees `IDENT "("`, it checks the identifier against the `BuiltinFn` union. An unknown identifier followed by `(` produces `UNKNOWN_FUNCTION`. Arity is validated against the expected argument count for each built-in:

| Function | Arity |
|----------|-------|
| `min` | 2 |
| `max` | 2 |
| `round` | 1 |
| `if` | 3 |
| `days_between` | 2 |

An arity mismatch (too few or too many arguments) produces `UNEXPECTED_TOKEN` at the position of the unexpected comma or closing parenthesis.

#### Error recovery strategy

The parser does not attempt to recover from errors and produce a partial AST. When any parse function encounters an unexpected token, it immediately returns a `ParseError` and unwinds the call stack. This is the simplest strategy that keeps the parser total (never throws) and keeps error messages precise.

---

### 4. `src/lang/print.ts` — Printer

#### Public interface

```typescript
import type { Expr } from "../types";

/** Converts any Expr to its canonical string form.
 *  Throws if expr contains an unrecognised node kind. */
export function print(expr: Expr): string;
```

#### Canonical form rules

The printer produces a deterministic, normalised string. Two structurally equal `Expr` values must produce identical strings.

**Parenthesisation algorithm.** The printer is given the *parent precedence level* as an internal parameter (initially 0, the lowest). When printing a binary node, the printer compares the node's own precedence level against the parent's. If the node's level is lower (looser binding) than the parent's, the node's string is wrapped in parentheses.

Precedence levels (higher number = tighter binding):

| Level | Operators |
|-------|-----------|
| 1 | `or` |
| 2 | `and` |
| 3 | `==`, `!=`, `<`, `<=`, `>`, `>=` |
| 4 | `+`, `-` (binary) |
| 5 | `*`, `/` |
| 6 | unary `not`, unary `-` |
| 7 | function calls, literals, fact names, grouped |

Left-associativity is handled by passing `level` (not `level - 1`) for the right-hand child of a left-associative binary operator. This ensures `a - (b - c)` prints as `a - (b - c)` and not `a - b - c`.

**Numeric formatting.** The printer formats number values with JavaScript's default `toString()` behaviour, which already omits trailing zeros. For money values (which are always integers), no decimal point is emitted. The printer inspects the `type` field on a `"literal"` node to choose the format.

**Date formatting.** A date literal's value is already an ISO 8601 string without quotes. The printer wraps it in double quotes: `"2024-03-15"`.

**Enum formatting.** An enum literal's value is already the content string. The printer wraps it in single quotes: `'approved'`.

**Function call formatting.** Arguments are separated by `, ` (comma-space). No space before `(` or after `)`.

**Unrecognised node.** If the `kind` field does not match any variant, the printer throws `new Error("print: unrecognised Expr kind: " + (expr as any).kind)`. This satisfies Req 3.7 and ensures the caller is not silently given a partial string.

---

### 5. `src/lang/evaluate.ts` — Evaluator

#### Public interface

```typescript
import type { Expr, Unknown } from "../types";
import type { FactValue } from "../types";

export interface EvalError {
  readonly message: string;      // human-readable, ≤ 500 chars
  readonly code: EvalErrorCode;
  readonly expr?: string;        // sub-expression that caused the error, ≤ 1000 chars
}

export type EvalErrorCode =
  | "DIVISION_BY_ZERO"
  | "TYPE_MISMATCH"
  | "NUMERIC_OVERFLOW"
  | "UNKNOWN_ERROR";

export type EvalResult =
  | { readonly ok: true;  readonly value: FactValue | Unknown }
  | { readonly ok: false; readonly error: EvalError };

export type Env = Readonly<Record<string, FactValue | Unknown>>;

/** Evaluates expr in the given environment.
 *  Never throws; propagates Unknown and EvalError per Kleene logic. */
export function evaluate(expr: Expr, env: Env): EvalResult;
```

#### Evaluation strategy

The evaluator is a simple recursive tree-walker. Because expressions are acyclic and have bounded depth (the `Expr` type is a finite tree), termination is guaranteed.

**Unknown propagation.** The evaluator checks for `UNKNOWN` operands before applying any operator. The rule is:

- Arithmetic (`+`, `-`, `*`, `/`): if either operand is `UNKNOWN`, return `{ ok: true, value: UNKNOWN }`.
- Comparison (`==`, `!=`, `<`, `<=`, `>`, `>=`): same as arithmetic.
- `not`: `not UNKNOWN` → `UNKNOWN`.
- `and`: short-circuit on `false` — if either operand is `false`, return `false` immediately (without evaluating the other); otherwise propagate `UNKNOWN` if either side is `UNKNOWN`.
- `or`: short-circuit on `true` — if either operand is `true`, return `true` immediately; otherwise propagate `UNKNOWN`.
- `if(cond, then, else)`: evaluate `cond` only; if `UNKNOWN` return `UNKNOWN`; if `true` return `then`; if `false` return `else`. The non-selected branch is not evaluated (lazy semantics).
- `min`, `max`, `round`, `days_between`: if any argument is `UNKNOWN`, return `UNKNOWN`.

**Short-circuit rationale.** `and` and `or` must short-circuit to satisfy the Kleene tables in Req 4.9 and 4.10 (e.g. `false and <anything>` = `false`). This also means the evaluator never evaluates the right-hand side of `false and expr`, which is correct for performance and for avoiding spurious `EvalError`s from the unneeded branch.

**Error propagation (Req 4.18).** If evaluating any sub-expression returns `{ ok: false }`, the evaluator returns that error immediately without evaluating siblings. This is a strict left-to-right depth-first propagation.

**Type checking.** Type checking is dynamic. The evaluator inspects the runtime types of fully-resolved (non-UNKNOWN) operands:

- Arithmetic operators require both operands to be `number` (JS primitive). Money values are `number` at runtime; the distinction between `number` and `money` is in the `Expr` literal's `type` field, not in the JS value type.
- Comparison operators: `==`/`!=` require both known operands to be the same JS type; if both are strings and both satisfy `isValidDate`, they are compared with `compareDates`, otherwise as plain strings. `<`, `<=`, `>`, `>=` accept (a) two finite numbers, or (b) two strings that both satisfy `isValidDate` (compared with `compareDates`). Any other known combination — date vs number, boolean operands, a non-date string, two enum strings — returns `TYPE_MISMATCH`. `UNKNOWN` operands are checked first and still yield `UNKNOWN`. The evaluator decides "date" purely by `isValidDate`, because run-time values are plain strings.
- `and`, `or`, `not` require `boolean` or `UNKNOWN` operands. A non-boolean known value produces `TYPE_MISMATCH`.
- `round` requires a `number`. `days_between` requires both known operands to be strings satisfying `isValidDate`; any other known value (including `'x'`, an invalid calendar date, or a number) returns `TYPE_MISMATCH`, so the result can never be `NaN`. `min`/`max` require both operands to be `number`.

**Non-finite environment values.** Whenever the evaluator reads a known value that is a `number`, it checks `Number.isFinite`. A `NaN`, `Infinity`, or `-Infinity` value (from a fact lookup or a literal) is treated as a type error: `TYPE_MISMATCH`.

**Finite-result guard.** After computing any numeric result (`+`, `-`, `*`, `/`, `round`, `min`, `max`), the evaluator applies `Number.isFinite`; a non-finite result returns `{ ok: false, error: { code: "NUMERIC_OVERFLOW", ... } }`. Together with the input check this guarantees that `evaluate` never returns `ok: true` with `NaN` or `±Infinity`. The `/` zero-divisor check still takes precedence and yields `DIVISION_BY_ZERO`.

**Division by zero.** After confirming both operands are numbers, the evaluator checks whether the right operand is exactly `0`. If so it returns `{ ok: false, error: { code: "DIVISION_BY_ZERO", ... } }`.

**`days_between` implementation.** After both arguments pass `isValidDate`, the evaluator parses them into `Date` objects using `new Date(dateString + "T00:00:00Z")` to avoid timezone shifts. The result is `Math.trunc((d2.getTime() - d1.getTime()) / 86_400_000)`, which gives signed whole days.

**`round` implementation.** Half-up rounding: `Math.floor(x + 0.5)`. This is equivalent to rounding 0.5 to 1 and −0.5 to 0, as specified in Req 1.6.

---

### 6. `src/index.ts` — Public re-exports

The public index re-exports everything that downstream packages (`kb-tools`, `mcp`, app code) need from the rule language:

```typescript
// existing engine API exports (start, next, answer, audit, explain, whatIf, encode, decode)
// ... (not modified by this spec)

// rule-language exports (added by this spec)
export type { Expr, BinaryOp, BuiltinFn, Unknown } from "./types";
export { UNKNOWN } from "./types";
export type { ParseResult, ParseError, ParseErrorCode } from "./lang/parse";
export { parse } from "./lang/parse";
export type { EvalResult, EvalError, EvalErrorCode, Env } from "./lang/evaluate";
export { evaluate } from "./lang/evaluate";
export { print } from "./lang/print";
```

**`types.ts` modification.** The `Expr = unknown` placeholder is replaced with the concrete `Expr` union, `BinaryOp`, `BuiltinFn`, and the `UNKNOWN` sentinel defined directly in `types.ts` (see Component 1 above). `types.ts` does **not** re-export from `lang/expr` — the definitions live in `types.ts` itself so that the `Rule` interface can reference `Expr` without a circular dependency on an implementation file.

---

### 7. `docs/kb-format.md` — Format reference (output artifact)

This file is authored as a task in this spec, not generated by code. The design specifies what it must contain:

1. **Top-level YAML fields**: `id`, `currency`, `goals`, `facts`, `rules`, `clauses` — with field types, required/optional status, and constraints.
2. **Facts map**: all five fact types (`boolean`, `number`, `money`, `date`, `enum`) with their properties (`ask`, `why`, `derived`, `options`, `role`).
3. **Rules array**: all rule fields (`id`, `cite`, `set`, `to`, `when`, `because`) with types and constraints.
4. **Clauses map**: `id`, `title`, `text` fields.
5. **Expression Language section**: all literal forms, fact names, arithmetic, comparison, logical operators, and all five built-in functions with signatures and behaviour on `UNKNOWN`.
6. **Three-valued logic section**: truth tables for `and`, `or`, and `not` using `T`/`F`/`?` notation.
7. **Two complete worked examples**: at least one using arithmetic and comparison, one using `if` and `days_between`. Each example includes the YAML snippet, expression annotation, and expected evaluation result for stated input facts.
8. **Parse error codes**: all six codes from Req 5.3 with an explanation and example source for each (stray characters → `UNEXPECTED_TOKEN`, unterminated quotes → `UNEXPECTED_END`, `INVALID_DATE` only for terminated invalid dates), plus the evaluation error codes including `NUMERIC_OVERFLOW`.
9. **Compiled form section**: the JSON shape of the `Expr` type with one expression and its corresponding JSON (can reuse the examples in this design document).
10. **YAML-safety note**: the rule that expressions beginning with a single-quoted enum literal or double-quoted date literal must be wrapped in the other YAML quote style (or use a block scalar) to prevent YAML from stripping the quotes. The validator note: a bare identifier naming no defined fact triggers the diagnostic "Fact 'X' is not defined — did you mean the enum literal 'X'?".

11. **Accepted limitations**: a note recording that `UNKNOWN_ERROR` is unreachable from parsed source and that there is no money literal syntax (see Accepted decisions below).

---

## Data Models

### Complete type inventory

```typescript
// src/types.ts (additions — Expr, BinaryOp, BuiltinFn, UNKNOWN defined here)
export const UNKNOWN: unique symbol;
export type Unknown = typeof UNKNOWN;

export type BinaryOp = "+" | "-" | "*" | "/" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "and" | "or";
export type BuiltinFn = "min" | "max" | "round" | "if" | "days_between";

export type Expr =
  | { readonly kind: "literal"; readonly type: FactType;  readonly value: FactValue }
  | { readonly kind: "fact";    readonly name: string }
  | { readonly kind: "unary";   readonly op: "not" | "-"; readonly operand: Expr }
  | { readonly kind: "binary";  readonly op: BinaryOp;    readonly left: Expr; readonly right: Expr }
  | { readonly kind: "call";    readonly fn: BuiltinFn;   readonly args: readonly Expr[] };

// src/lang/parse.ts
export type ParseErrorCode = "UNEXPECTED_TOKEN" | "UNEXPECTED_END" | "UNKNOWN_FUNCTION" | "TRAILING_CONTENT" | "INVALID_DATE" | "EMPTY_INPUT";
export interface ParseError { readonly message: string; readonly position: number; readonly code: ParseErrorCode; }
export type ParseResult = { ok: true; expr: Expr } | { ok: false; error: ParseError };

// src/lang/evaluate.ts
export type EvalErrorCode = "DIVISION_BY_ZERO" | "TYPE_MISMATCH" | "NUMERIC_OVERFLOW" | "UNKNOWN_ERROR";
export interface EvalError { readonly message: string; readonly code: EvalErrorCode; readonly expr?: string; }
export type EvalResult = { ok: true; value: FactValue | Unknown } | { ok: false; error: EvalError };
export type Env = Readonly<Record<string, FactValue | Unknown>>;
```

### Invariants

- A `"literal"` node where `type` is `"boolean"` has a JS `boolean` value; `"number"` and `"money"` have a JS `number`; `"date"` and `"enum"` have a JS `string`.
- A `"call"` node with `fn: "round"` has exactly one element in `args`; `fn: "if"` has exactly three; `fn: "min"`, `"max"`, `"days_between"` have exactly two.
- A `"fact"` node's `name` satisfies the identifier grammar: matches `/^[A-Za-z_][A-Za-z0-9_]{0,127}$/` and is not a reserved keyword.
- `UNKNOWN` is never stored in an `Expr` node. It is only a possible runtime result from `evaluate`.
- `Expr` values are acyclic (the type is an inductive tree; no reference cycles are possible in TypeScript tagged-union recursion).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Parser–Printer round-trip

*For any* `Expr` value produced by a well-typed generator, `parse(print(expr))` returns `{ ok: true }` and the resulting expression is structurally equal to the input — meaning every `kind`, every operator, every primitive value, and every child node matches recursively.

**Validates: Requirements 3.2, 7.3**

---

### Property 2: Total parser

*For any* string (including empty strings, whitespace-only strings, and arbitrary Unicode), calling `parse(input)` does not throw and returns either `{ ok: true, expr: Expr }` or `{ ok: false, error: ParseError }`.

**Validates: Requirements 2.4, 8.3**

---

### Property 3: Kleene `and` laws

*For any* triple `(a, b, x)` drawn from `{ true, false, UNKNOWN }`:
- `false and x` = `false` for all `x`
- `x and false` = `false` for all `x`
- `true and true` = `true`
- `true and unknown` = `unknown`
- `unknown and true` = `unknown`

**Validates: Requirements 4.9, 9.3**

---

### Property 4: Kleene `or` laws

*For any* triple `(a, b, x)` drawn from `{ true, false, UNKNOWN }`:
- `true or x` = `true` for all `x`
- `x or true` = `true` for all `x`
- `false or false` = `false`
- `false or unknown` = `unknown`
- `unknown or false` = `unknown`

**Validates: Requirements 4.10, 9.4**

---

### Property 5: Double negation and De Morgan laws

*For any* `a` from `{ true, false, UNKNOWN }`: `not (not a)` = `a`.

*For any* `(a, b)` from `{ true, false, UNKNOWN }²`:
- `not (a and b)` = `(not a) or (not b)`
- `not (a or b)` = `(not a) and (not b)`

**Validates: Requirements 4.8, 9.5, 9.6**

---

### Property 6: Finite results

*For any* well-typed generated expression and environment (arithmetic and ordering operands numeric or both valid dates, `and`/`or`/`not` operands boolean, `if` condition boolean, `days_between` operands valid date strings, with extreme-magnitude numbers and zero divisors included), `evaluate` does not throw, and any `ok: true` result has a value that is not `NaN`, `Infinity`, or `-Infinity`.

**Validates: Requirements 4.19, 4.20, 4.21, 4.22, 11.4**

---

## Error Handling

### Parser error handling

The parser is total: it never throws. All error paths return `{ ok: false, error: ParseError }`.

Error construction rules:
- `EMPTY_INPUT` is returned immediately when the input (after stripping leading/trailing whitespace) is empty. Position is always 0.
- `UNEXPECTED_END` is returned when a parsing function expects a token but finds `EOF`, and for an unterminated quoted literal. Position is `source.length`.
- `UNEXPECTED_TOKEN` is returned when a token appears that the grammar does not expect at that position, for an unknown character (`UNKNOWN_CHAR`), and for an empty enum literal `''`. Position is the UTF-16 start offset of the offending token (for `''`, the opening quote).
- `UNKNOWN_FUNCTION` is returned when an identifier is followed by `(` but does not match any built-in. Position is the start of the identifier.
- `TRAILING_CONTENT` is returned when the expression is complete but non-whitespace tokens remain. Position is the start of the first remaining token.
- `INVALID_DATE` is returned only when a terminated double-quoted string's content is not a valid `YYYY-MM-DD` calendar date. Position is the start of the opening `"`.

Error messages must be human-readable English, at most 200 characters, and must not include JavaScript stack traces or internal engine details.

### Evaluator error handling

The evaluator is total: it never throws. All error paths return `{ ok: false, error: EvalError }`.

- `DIVISION_BY_ZERO`: the right operand of `/` evaluated to the number `0`.
- `TYPE_MISMATCH`: operand types are incompatible with the operator (including non-date `days_between` arguments, ordering of non-comparable operands, and non-finite numbers read from the environment). The `expr` field on `EvalError` holds the printed sub-expression that caused the error (using `print()`), capped at 1000 characters.
- `NUMERIC_OVERFLOW`: a numeric operation produced `NaN` or `±Infinity`.
- `UNKNOWN_ERROR`: a catch-all for any error code not in the documented set. Used as the code when re-wrapping an unexpected internal condition. It is unreachable from parser-produced expressions (see Accepted Decisions).

Error propagation: the first `EvalError` encountered during depth-first traversal is returned as the result of the entire expression. No further evaluation occurs after an error.

### Printer error handling

The printer throws synchronously if it encounters an unrecognised `kind` field. This is an internal contract violation (the caller passed a value that is not a valid `Expr`) rather than a user error, so throwing is correct. The thrown value is a plain `Error` with a message indicating the unrecognised kind; it does not carry a stack trace in production.

---

## Testing Strategy

### Unit tests (Vitest, `*.test.ts`)

Unit tests cover specific examples and edge cases that complement the property tests. They are co-located with their source files or in a `__tests__/` subdirectory under `src/lang/`.

Key unit test areas:

**Parser:**
- Each literal form: `true`, `false`, integer, decimal, money integer, date literal, enum literal.
- Operator precedence: `a + b * c` parses as `a + (b * c)`, not `(a + b) * c`.
- Parentheses override precedence: `(a + b) * c`.
- Each built-in function with correct arity.
- Each parse error code: `EMPTY_INPUT`, `UNEXPECTED_END`, `UNEXPECTED_TOKEN`, `UNKNOWN_FUNCTION`, `TRAILING_CONTENT`, `INVALID_DATE`.
- YAML-safety: bare `2026-11-10` is not parsed as a date.
- Reserved keywords cannot be used as fact names.
- Leading/trailing whitespace is accepted.

**Printer:**
- Each literal kind formats correctly (`1.5` not `1.50`, `2` not `2.0`, `"2024-03-15"`, `'approved'`).
- Parentheses are inserted exactly where needed: `(a + b) * c` prints as `(a + b) * c`, not `a + b * c`.
- Parentheses are not inserted around the outermost expression.
- Left-associativity: `a - b - c` prints without extra parentheses; `a - (b - c)` prints with them.
- Unrecognised kind throws.

**Evaluator:**
- Each literal evaluates to itself.
- Absent fact name evaluates to `UNKNOWN`.
- Division by zero returns `DIVISION_BY_ZERO`.
- Type mismatches return `TYPE_MISMATCH`.
- Each Kleene truth table row for `and`, `or`, `not`.
- Short-circuit: `false and expr_that_would_error` returns `false` without error.
- `if` lazy semantics: the non-selected branch is not evaluated.
- `days_between` with known dates returns the signed day count.
- `round` half-up: `round(0.5)` = `1`, `round(-0.5)` = `0`.
- Error propagation: an error in a sub-expression propagates to the top.

### Property tests (fast-check, `*.props.test.ts`)

Three property-test files, each running a minimum of 100 iterations:

#### `round-trip.props.test.ts` (Requirement 7)

```typescript
// Tag: Feature: rule-language, Property 1: parser-printer round-trip

import * as fc from "fast-check";
import { parse, print } from "./parse";

export const MAX_DEPTH = 5;
export const DEFAULT_DEPTH = 3;

// Arbitrary: generates well-typed Expr trees up to MAX_DEPTH
const exprArbitrary = fc.letrec(/* ... */).expr;

fc.assert(
  fc.property(exprArbitrary, (expr) => {
    const result = parse(print(expr));
    return result.ok && deepEqual(result.expr, expr);
  }),
  { numRuns: 100 }
);
```

The generator uses `fc.letrec` for recursive arbitraries. At each level it picks from the five node kinds, with terminal nodes (literals and fact references) forced at `depth === 0` to prevent unbounded recursion. The generator is exported as a constant so the test file is self-documenting.

#### `total-parser.props.test.ts` (Requirement 8)

```typescript
// Tag: Feature: rule-language, Property 2: total parser

import * as fc from "fast-check";
import { parse } from "./parse";

fc.assert(
  fc.property(fc.string(), (input) => {
    let result: ReturnType<typeof parse> | undefined;
    try {
      result = parse(input);
    } catch {
      return false; // any throw is a failure
    }
    return (
      (result.ok === true && "expr" in result) ||
      (result.ok === false && "error" in result)
    );
  }),
  { numRuns: 100 }
);
```

No filtering on the input — `fc.string()` produces arbitrary Unicode strings.

#### `three-valued.props.test.ts` (Requirement 9)

```typescript
// Tag: Feature: rule-language, Property 3-5: Kleene and/or/not laws

import * as fc from "fast-check";
import { UNKNOWN } from "../../types";
import { evaluate } from "./evaluate";

const triArbitrary = fc.oneof(
  fc.constant(true),
  fc.constant(false),
  fc.constant(UNKNOWN)
);

// Properties 3, 4, 5 each expressed as fc.property(triArbitrary, ...)
// with numRuns: 100
```

The three properties (and, or, double-negation/De Morgan) are expressed as separate `fc.assert` calls or as separate `it` blocks within a single Vitest `describe` suite.

#### `finite-results.props.test.ts` (Requirement 11)

```typescript
// Tag: Feature: rule-language, Property 6: finite results
```

Generators build well-typed `Expr` trees by sort (numeric, boolean, date) so every operator receives operands of the right sort. Numeric leaves are drawn from `fc.oneof` over ordinary doubles, `1e308`, `-1e308`, `Number.MAX_SAFE_INTEGER`, `0`, and fact references; division right-hand sides include literal zero. Date leaves are valid `YYYY-MM-DD` strings (including leap days). The environment assigns each fact a value of its sort. The property wraps `evaluate` in a try/catch (a throw fails the test) and asserts that an `ok: true` numeric value satisfies `Number.isFinite`. `numRuns: 100`.

### Accepted decisions

- `UNKNOWN_ERROR` cannot be produced from any source the parser accepts; it arises only for hand-built `Expr` values and is kept as a defensive fallback so `evaluate` stays total.
- There is no money literal syntax: the parser tags every numeric literal `type: "number"` because it cannot tell money from a plain number by syntax; money typing is the concern of the knowledge-base validator and the evaluation context.

### Additional unit-test areas

**Parser:** `$` and `.5` → `UNEXPECTED_TOKEN` at the character; `a $ b` → `TRAILING_CONTENT`; `'abc` and `"2024-01-01` → `UNEXPECTED_END` at `source.length`; `''` → `UNEXPECTED_TOKEN` at the opening quote; a terminated invalid date such as `"2024-02-30"` → `INVALID_DATE`.

**Evaluator:** `days_between` with `'x'`, an invalid calendar date, and a number → `TYPE_MISMATCH`, with a valid pair still working; `1e308 * 10` → `NUMERIC_OVERFLOW`; `NaN`/`Infinity` in env → `TYPE_MISMATCH`; date ordering across a leap day, a year boundary, equal dates, and enum-vs-enum ordering → `TYPE_MISMATCH`.

### Test configuration

Property tests live in `packages/engine/src/lang/` and run under `pnpm test:props` (Vitest filtered to `*.props.test.ts`). Unit tests run under `pnpm check` (all `*.test.ts` files). Both suites must pass in CI before any gate closes.
