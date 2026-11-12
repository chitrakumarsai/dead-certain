# Implementation Plan: rule-language

## Overview

Implement the expression sub-system for Dead Certain. This covers the concrete `Expr` AST type,
a hand-written recursive-descent parser, a canonical printer, a Kleene-logic evaluator, three
property-test suites, and the `docs/kb-format.md` author reference. All code lives in
`packages/engine/src/` with zero runtime dependencies.

The first task is a contract change to `packages/engine/src/types.ts` that requires explicit
human approval before any other task begins.

---

## Tasks

- [x] 1. Update `types.ts` with the concrete `Expr` union (⚠️ requires human approval)
  - Replace `export type Expr = unknown` with the full concrete tagged-union definition
  - Add `export const UNKNOWN: unique symbol = Symbol.for("dead-certain.unknown")` and `export type Unknown = typeof UNKNOWN`
  - Add `export type BinaryOp` string union covering all twelve operators
  - Add `export type BuiltinFn` string union covering the five built-in function names
  - All new declarations must be in `packages/engine/src/types.ts` — not in any `lang/` file
  - Confirm zero TypeScript errors under `strict` and `noImplicitReturns` after the change
  - **⚠️ Pause after creating the diff and ask the human to approve the change before committing it**
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2. Add rule-language re-exports to `src/index.ts`
  - [x] 2.1 Create `packages/engine/src/lang/expr.ts` as a thin re-export shim
    - File re-exports `Expr`, `BinaryOp`, `BuiltinFn`, `UNKNOWN`, `Unknown` from `../types`
    - No new type definitions in this file
    - _Requirements: 6.5_
  - [x] 2.2 Update `packages/engine/src/index.ts` to add rule-language re-exports
    - Add `export type { Expr, BinaryOp, BuiltinFn, Unknown } from "./types"`
    - Add `export { UNKNOWN } from "./types"`
    - Stub re-exports for `ParseResult`, `ParseError`, `ParseErrorCode` from `./lang/parse` (create empty barrel placeholders if the file does not yet exist)
    - Stub re-exports for `EvalResult`, `EvalError`, `EvalErrorCode`, `Env` from `./lang/evaluate`
    - Add `export { print } from "./lang/print"`
    - _Requirements: 6.5_

- [x] 3. Implement the parser (`src/lang/parse.ts`)
  - [x] 3.1 Implement the lexer (internal, not exported)
    - Produce a flat token array before parsing (scan-then-parse strategy)
    - Token kinds: `NUMBER`, `DATE_LIT`, `ENUM_LIT`, `IDENT` (with keyword flag), `BOOL_LIT`, `LPAREN`, `RPAREN`, `COMMA`, `PLUS`, `MINUS`, `STAR`, `SLASH`, `EQ`, `NEQ`, `LT`, `LTE`, `GT`, `GTE`, `EOF`
    - Keyword detection in the lexer: tag `true`/`false` as `BOOL_LIT`; flag `and`, `or`, `not`, `min`, `max`, `round`, `if`, `days_between` as keywords
    - Whitespace (U+0009, U+000A, U+000D, U+0020) is consumed and discarded; never produces a token
    - Date validation after matching `DATE_LIT`: validate year 1–9999, month 01–12, day 01–28/29/30/31 accounting for month length and leap years; invalid value → `INVALID_DATE` error
    - YAML-safety: bare hyphenated date strings like `2026-11-10` are NEVER matched as date literals
    - Track UTF-16 code-unit position for every token
    - _Requirements: 1.11, 2.5, 5.3_
  - [x] 3.2 Implement the recursive-descent parser functions
    - Seven parsing functions mapping to the precedence grammar: `parseExpr` → `parseOr` → `parseAnd` → `parseCompare` → `parseAddSub` → `parseMulDiv` → `parseUnary` → `parsePrimary`
    - `parseCompare` consumes at most one comparison operator (non-associative at that level)
    - `parsePrimary` handles: `BOOL_LIT`, `NUMBER`, `DATE_LIT`, `ENUM_LIT`, function call (`IDENT "(" arglist ")"`), fact name (`IDENT`), grouped expression (`"(" expr ")"`)
    - Function call validation: check identifier against `BuiltinFn`; unknown identifier + `(` → `UNKNOWN_FUNCTION`; arity mismatch → `UNEXPECTED_TOKEN`
    - After a successful parse check that all tokens are consumed; remaining non-EOF token → `TRAILING_CONTENT`
    - First action in `parse()`: if token stream is only `EOF` → `EMPTY_INPUT` at position 0
    - Assign `type` field on each `"literal"` node per the parser rules in the design
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 1.8, 1.9, 1.11, 2.1, 2.2, 2.3, 2.6, 5.3_
  - [x] 3.3 Expose `parse()` public interface and error types
    - Export `ParseErrorCode`, `ParseError`, `ParseResult`, and `parse` from `lang/parse.ts`
    - `parse` never throws; all error paths return `{ ok: false, error: ParseError }`
    - Error messages: human-readable English, max 200 characters, no stack traces
    - `position` on `UNEXPECTED_END`: `source.length`
    - _Requirements: 2.1, 2.3, 2.4, 2.7, 5.1, 5.5, 5.6_
  - [x] 3.4 Write unit tests for the parser
    - Each literal form: `true`, `false`, integer, decimal, date literal, enum literal
    - Operator precedence: `a + b * c` parses as `a + (b * c)`; `(a + b) * c` overrides precedence
    - Each built-in with correct arity; arity mismatch error
    - Each `ParseErrorCode`: `EMPTY_INPUT`, `UNEXPECTED_END`, `UNEXPECTED_TOKEN`, `UNKNOWN_FUNCTION`, `TRAILING_CONTENT`, `INVALID_DATE`
    - YAML-safety: `2026-11-10` is not a date literal
    - Reserved keywords cannot be used as fact names
    - Leading/trailing whitespace accepted
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 1.8, 1.11, 2.3, 2.4, 2.5, 2.6, 2.7, 5.3, 5.5, 5.6_

- [x] 4. Implement the printer (`src/lang/print.ts`)
  - [x] 4.1 Implement the `print()` function with parenthesisation algorithm
    - Recursive tree-walk with `parentPrec` parameter (initially 0)
    - Precedence table: `or`=1, `and`=2, comparisons=3, `+`/`-`=4, `*`/`/`=5, unary=6, atoms=7
    - Wrap in parentheses when node's level is lower than parent's level
    - Left-associativity: pass `level` (not `level - 1`) for the right-hand child of left-associative binary operators, so `a - (b - c)` prints as `a - (b - c)`
    - Format numbers: JS default `toString()` (no trailing zeros); integer-valued number → no decimal point
    - Format date literals: wrap value in double quotes (`"2024-03-15"`)
    - Format enum literals: wrap value in single quotes (`'approved'`)
    - Format function calls: args separated by `, `, no space before `(` or after `)`
    - Unrecognised `kind`: throw `new Error("print: unrecognised Expr kind: " + (expr as any).kind)`
    - Export `print` from `lang/print.ts`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - [x] 4.2 Write unit tests for the printer
    - Each literal kind: `1.5` not `1.50`; `2` not `2.0`; `"2024-03-15"`; `'approved'`
    - Parentheses inserted exactly where needed: `(a + b) * c`
    - No parentheses around outermost expression
    - Left-associativity: `a - b - c` prints without extra parens; `a - (b - c)` prints with them
    - Unrecognised kind throws
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 5. Checkpoint — parser and printer wired together
  - Ensure `pnpm check` passes for the engine package (lint, TypeScript, unit tests)
  - Confirm `parse(print(expr))` works manually for at least one expression before proceeding

- [x] 6. Implement the evaluator (`src/lang/evaluate.ts`)
  - [x] 6.1 Implement the recursive tree-walking `evaluate()` function
    - Import `UNKNOWN` and `Unknown` from `../types`
    - Export `EvalErrorCode`, `EvalError`, `EvalResult`, `Env`, and `evaluate` from `lang/evaluate.ts`
    - Literal evaluation: return value unchanged
    - Fact lookup: return `env[name]` if present; return `UNKNOWN` if absent
    - Arithmetic (`+`, `-`, `*`, `/`): propagate `UNKNOWN` if either operand is `UNKNOWN`; type-check numeric operands; division-by-zero check before division
    - Comparison (`==`, `!=`, `<`, `<=`, `>`, `>=`): propagate `UNKNOWN`; `TYPE_MISMATCH` for incompatible known types
    - `not`: `not true` → `false`, `not false` → `true`, `not UNKNOWN` → `UNKNOWN`; `TYPE_MISMATCH` for non-boolean known operand
    - `and` with short-circuit: `false and x` → `false` immediately (do not evaluate `x`); then propagate `UNKNOWN`
    - `or` with short-circuit: `true or x` → `true` immediately; then propagate `UNKNOWN`
    - `if(cond, then, else)`: evaluate `cond` only; lazy — do not evaluate the non-selected branch
    - `min`, `max`, `round`, `days_between`: propagate `UNKNOWN` on any `UNKNOWN` argument
    - `round`: `Math.floor(x + 0.5)` (half-up)
    - `days_between`: parse with `new Date(s + "T00:00:00Z")`; result is `Math.trunc((d2 - d1) / 86_400_000)`
    - Error propagation: first `EvalError` at any depth propagates immediately
    - `evaluate` never throws; all error paths return `{ ok: false, error: EvalError }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.18_
  - [x] 6.2 Write unit tests for the evaluator
    - Each literal evaluates to itself
    - Absent fact name → `UNKNOWN`
    - Division by zero → `DIVISION_BY_ZERO`
    - Type mismatches → `TYPE_MISMATCH` (bool + number, etc.)
    - All nine Kleene rows for `and` and `or`; all three rows for `not`
    - Short-circuit: `false and expr_that_would_error` → `false` without error
    - `if` lazy semantics: non-selected branch is not evaluated
    - `days_between` with known dates returns signed day count
    - `round` half-up: `round(0.5)` = `1`, `round(-0.5)` = `0`
    - Error propagation: error in a sub-expression propagates to the top
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.18_

- [x] 7. Checkpoint — full pipeline end-to-end
  - Ensure `pnpm check` passes for the engine package
  - Verify `parse` → `evaluate` works for `sum_insured * 0.01` with a sample `Env`
  - Verify `if(age >= 61, claim * 0.05, 0)` with known and unknown fact values

- [x] 8. Write property tests
  - [x] 8.1 Write the round-trip property test (`lang/round-trip.props.test.ts`)
    - Use `fc.letrec` to build a recursive `Expr` arbitrary; force terminals (literals, fact refs) at `depth === 0`
    - Export `MAX_DEPTH = 5` and `DEFAULT_DEPTH = 3` as named constants from the test file
    - Generator covers all five node kinds; `"literal"` nodes carry values whose JS type is consistent with their `type` field
    - Property: `parse(print(expr)).ok === true` and resulting `expr` is recursively deeply equal to input
    - `numRuns: 100`
    - File comment tag: `Feature: rule-language, Property 1: parser-printer round-trip`
    - **Property 1: Parser–Printer round-trip**
    - **Validates: Requirements 3.2, 7.3**
  - [x] 8.2 Write the total-parser property test (`lang/total-parser.props.test.ts`)
    - Use `fc.string()` with no filtering
    - Property: `parse(input)` does not throw; return value is `{ ok: true, ... }` or `{ ok: false, ... }`
    - Any throw from `parse` is a test failure
    - `numRuns: 100`
    - File comment tag: `Feature: rule-language, Property 2: total parser`
    - **Property 2: Total parser**
    - **Validates: Requirements 2.4, 8.3**
  - [x] 8.3 Write the three-valued-logic property test (`lang/three-valued.props.test.ts`)
    - Define `triArbitrary` using `fc.oneof(fc.constant(true), fc.constant(false), fc.constant(UNKNOWN))`
    - Separate `fc.assert` calls (or separate `it` blocks) for each of Properties 3, 4, and 5
    - Property 3 (`and` Kleene laws): `false and x` = `false`; `x and false` = `false`; `true and true` = `true`; `true and UNKNOWN` = `UNKNOWN`; `UNKNOWN and true` = `UNKNOWN`
    - Property 4 (`or` Kleene laws): `true or x` = `true`; `x or true` = `true`; `false or false` = `false`; `false or UNKNOWN` = `UNKNOWN`; `UNKNOWN or false` = `UNKNOWN`
    - Property 5 (double negation + De Morgan): `not (not a)` = `a`; `not (a and b)` = `(not a) or (not b)`; `not (a or b)` = `(not a) and (not b)`
    - Each `fc.assert` uses `numRuns: 100`
    - File comment tag: `Feature: rule-language, Property 3-5: Kleene and/or/not laws`
    - **Properties 3–5: Kleene and/or/not laws**
    - **Validates: Requirements 4.8, 4.9, 4.10, 9.3, 9.4, 9.5, 9.6**

- [x] 9. Checkpoint — all tests green
  - Run `pnpm test:props` and confirm all three property-test files pass with zero counterexamples
  - Run `pnpm check` and confirm zero lint, TypeScript, and unit-test failures

- [x] 10. Write `docs/kb-format.md`
  - [x] 10.1 Write the top-level YAML schema section
    - Document `id`, `currency`, `goals`, `facts`, `rules`, `clauses` fields: type, required/optional, constraints
    - Document the `facts` map: all five fact types with their properties (`ask`, `why`, `derived`, `options`, `role`)
    - Document the `rules` array: all fields (`id`, `cite`, `set`, `to`, `when`, `because`) with types and constraints
    - Document the `clauses` map: `id`, `title`, `text` fields
    - Include the `kb-tools` validator diagnostic: "Fact 'X' is not defined — did you mean the enum literal 'X'?"
    - _Requirements: 10.1_
  - [x] 10.2 Write the Expression Language and Three-valued logic sections
    - "Expression Language" section: all literal forms, fact names, arithmetic, comparisons, logical operators, all five built-in functions with signatures and behaviour on `unknown`
    - "Three-valued logic" section: Kleene truth tables for `and`, `or`, `not` using `T`/`F`/`?` notation
    - _Requirements: 10.2, 10.3_
  - [x] 10.3 Write worked examples, error code reference, and compiled-form section
    - At least two complete worked examples: one using arithmetic and comparisons, one using `if` and `days_between`; each includes YAML snippet, expression annotation, and expected evaluation result
    - Parse error codes section: all six codes from Req 5.3 with explanation and example source string
    - "Compiled form" section: JSON shape of the `Expr` type with one example expression and its corresponding JSON
    - YAML-safety note: rule for wrapping single-quoted and double-quoted literals in YAML scalar context
    - _Requirements: 10.4, 10.5, 10.6_

- [x] 11. Final checkpoint — definition of done
  - Run `pnpm check` (Biome lint + format, `tsc --noEmit`, unit + property tests) — all pass
  - Run `pnpm test:props` — confirm round-trip, total-parser, and three-valued-logic suites all pass
  - Confirm `packages/engine/src/index.ts` re-exports all new public types and functions
  - Confirm `docs/kb-format.md` exists and covers every section listed in Requirement 10

- [x] 12. Behaviour fixes
  - [x] 12.1 Add shared date helper `packages/engine/src/lang/dates.ts` and switch the lexer to it
    - Export `isValidDate(s: string): boolean` (exact `YYYY-MM-DD`, year 1–9999, real month and day, leap years) and `compareDates(a: string, b: string): number`
    - Replace the lexer's inline date validation in `lang/parse.ts` with `isValidDate` (extensionless import `./dates`); behaviour unchanged, existing tests still pass
    - Add small unit tests in `lang/dates.test.ts` (leap day, non-leap Feb 29, month 13, year 0000)
    - _Requirements: 1.12, 2.3, 4.19, 4.23_
  - [x] 12.2 Lexer and parser: unknown characters, unterminated and empty quoted literals
    - Add the `UNKNOWN_CHAR` token and the `BAD_QUOTE` token (unterminated / empty) to the lexer; keep `INVALID_DATE` only for terminated double-quoted strings that fail `isValidDate`
    - Map in the parser: `UNKNOWN_CHAR` → `UNEXPECTED_TOKEN` at the character; unterminated quote → `UNEXPECTED_END` at `source.length`; empty `''` → `UNEXPECTED_TOKEN` at the opening quote
    - Add unit tests in `lang/parse.test.ts` for `$`, `.5`, `a $ b` (still `TRAILING_CONTENT`), `'abc`, `"2024-01-01` (unterminated double), `''`, and a terminated invalid date (still `INVALID_DATE`)
    - Update any existing parser tests whose expectations change
    - _Requirements: 1.13, 2.3, 2.8, 2.9, 2.10, 5.3_
  - [x] 12.3 Evaluator: `days_between` validation, finite-result guard, `NUMERIC_OVERFLOW`
    - Add `"NUMERIC_OVERFLOW"` to `EvalErrorCode`
    - `days_between` validates known arguments with `isValidDate`; otherwise `TYPE_MISMATCH` (never `NaN`)
    - Non-finite known numbers read from the environment → `TYPE_MISMATCH`; non-finite results of `+ - * /`, `round`, `min`, `max` → `NUMERIC_OVERFLOW`
    - Add unit tests in `lang/evaluate.test.ts`: `days_between` with `'x'`, an invalid calendar date, a number, and a valid pair; `1e308 * 10` built as an AST and repeated multiplication → `NUMERIC_OVERFLOW`; `NaN` / `Infinity` in env → `TYPE_MISMATCH`
    - _Requirements: 4.19, 4.20, 4.21, 4.22, 5.4_
  - [x] 12.4 Evaluator: date ordering
    - `<`, `<=`, `>`, `>=`, `==`, `!=` on two valid date strings compare chronologically via `compareDates`; mixed or non-date operands for ordering → `TYPE_MISMATCH`; `unknown` operands still give `unknown`
    - Add unit tests in `lang/evaluate.test.ts`: leap-day pair, year boundary, equal dates, date vs number, enum-vs-enum ordering → `TYPE_MISMATCH`, unknown operand → `unknown`
    - _Requirements: 1.12, 4.23, 4.24_
  - [x] 12.5 Write the finite-results property test (`lang/finite-results.props.test.ts`)
    - Well-typed generators per Requirement 11 criterion 2, including `1e308`, `Number.MAX_SAFE_INTEGER`, and zero divisors
    - Assert `evaluate` never throws and never returns `ok: true` with `NaN` or `±Infinity`; `numRuns: 100`
    - File comment tag: `Feature: rule-language, Property 6: finite results`
    - **Property 6: Finite results**
    - **Validates: Requirements 4.19, 4.20, 4.21, 4.22, 11.4**
  - [x] 12.6 Update `docs/kb-format.md` to match the new behaviour
    - Error code table and positions: `UNEXPECTED_TOKEN` for stray characters and `''`, `UNEXPECTED_END` for unterminated quotes, `INVALID_DATE` only for terminated invalid dates
    - Document the `''` rule, `days_between` `TYPE_MISMATCH`, date ordering in the operators and operand-types text, and `NUMERIC_OVERFLOW` in the evaluation error table
    - Add an "Accepted limitations" note for `UNKNOWN_ERROR` and the missing money literal
    - Remove or correct every sentence the old behaviour made true (the NaN note, the "dates cannot be ordered" guidance, the unterminated-enum note, the stray-character `INVALID_DATE` note)
    - Re-verify any example whose output changes by running it
    - _Requirements: 10.5, 10.7_
  - [x] 12.7 Checkpoint — run the full gates under Node 22
    - Use the Node 22 in `~/.nvm` (the shell default is Node 18)
    - Run `pnpm check` and `pnpm test:props`; all must pass
    - _Requirements: 7.4, 8.4, 9.7, 11.5_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP, but are strongly recommended before marking the spec complete.
- Task 1 is a **contract change** that requires human approval before any downstream task starts; show the diff to the reviewer and wait for a go-ahead.
- All property-test files (`*.props.test.ts`) live in `packages/engine/src/lang/` and run under `pnpm test:props`.
- Unit tests run under `pnpm check` alongside lint and TypeScript checks.
- The engine package has **zero runtime dependencies**; Vitest and fast-check are devDependencies only.
- `UNKNOWN` uses `Symbol.for("dead-certain.unknown")` so it is stable across worker re-evaluations.
- The printer throws on unrecognised `kind` (internal contract violation); the parser and evaluator never throw.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2", "4.1"] },
    { "id": 5, "tasks": ["3.3"] },
    { "id": 6, "tasks": ["3.4", "4.2"] },
    { "id": 7, "tasks": ["6.1"] },
    { "id": 8, "tasks": ["6.2"] },
    { "id": 9, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 10, "tasks": ["10.1"] },
    { "id": 11, "tasks": ["10.2"] },
    { "id": 12, "tasks": ["10.3"] },
    { "id": 13, "tasks": ["12.1"] },
    { "id": 14, "tasks": ["12.2", "12.3"] },
    { "id": 15, "tasks": ["12.4"] },
    { "id": 16, "tasks": ["12.5"] },
    { "id": 17, "tasks": ["12.6"] }
  ]
}
```
