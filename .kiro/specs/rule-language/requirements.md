# Requirements Document

## Introduction

The rule-language component is the expression sub-system of Dead Certain. It defines the grammar
for the expressions that appear in the `to:` and `when:` fields of every rule in a knowledge base,
and it provides the three operations the engine and the build toolchain call: **parse**, **print**,
and **evaluate**.

Expressions reference typed facts, perform arithmetic and comparisons, combine conditions with
three-valued logic, and call a small set of built-in functions. The evaluator treats unknown as a
first-class value and follows Kleene three-valued logic throughout, so the engine can stop asking
questions the moment the outcome is decided.

The compiled form of an expression — the `Expr` type currently declared as `unknown` in
`packages/engine/src/types.ts` — must be a concrete, JSON-serialisable AST defined by this
component. The proposed concrete type is included below as a contract change for human approval
before the design phase begins.

All code lives in `packages/engine` and carries zero runtime dependencies.

---

## Glossary

- **Expression**: A syntactic form in the rule language that evaluates to a typed value or to
  `unknown`. Expressions appear in the `to:` and `when:` fields of rules.
- **AST** (Abstract Syntax Tree): The in-memory tree representation of a parsed expression.
  Nodes are tagged-union objects; the full union is the `Expr` type.
- **Expr**: The concrete TypeScript type that represents the AST. It must be JSON-serialisable
  so that compiled knowledge bases can be stored as JSON and loaded without re-parsing.
- **Literal**: A constant value embedded directly in an expression — `true`, `false`, an integer
  or decimal number, a money amount (integer minor-unit), an ISO 8601 date string in double
  quotes (for example `"2026-11-10"`), or an enum literal written as a single-quoted string
  (for example `'approved'`). Fact names are bare identifiers. The three quoting forms are
  syntactically distinct: single quotes are used exclusively for enum literals, double quotes
  for date literals, and bare identifiers for fact names.
- **Fact name**: An identifier in an expression that refers to a fact defined in the enclosing
  knowledge base. Its value is the fact's current value, or `unknown` if not yet determined.
- **Unknown**: A first-class value that propagates through evaluation according to Kleene
  three-valued logic. It is distinct from `null`, `undefined`, or any boolean.
- **Kleene logic**: Three-valued logic where `and`, `or`, and `not` follow the standard
  Kleene truth tables. For example, `unknown and false` = `false`, `unknown or true` = `true`,
  and `not unknown` = `unknown`.
- **Parser**: The function `parse(source: string): ParseResult` that converts a source string
  into an `Expr` (success) or a `ParseError` (failure). It MUST NOT throw.
- **Printer**: The function `print(expr: Expr): string` that converts an `Expr` back into a
  canonical source string. The canonical form is the normalised, unambiguous representation.
- **Evaluator**: The function `evaluate(expr: Expr, env: Env): EvalResult` that reduces an `Expr`
  to a `FactValue | unknown`, propagating unknown through sub-expressions following Kleene logic.
- **Env** (Environment): An immutable map from fact names to `FactValue | unknown` supplied by
  the engine at evaluation time.
- **ParseError**: A structured error value returned by the parser when the input is not a valid
  expression. It carries a message, a position, and an error code.
- **EvalError**: A structured error value returned by the evaluator when evaluation cannot
  proceed for a reason other than unknown (for example, type mismatch or division by zero).
- **ParseResult**: The union `{ ok: true; expr: Expr } | { ok: false; error: ParseError }`.
- **EvalResult**: The union
  `{ ok: true; value: FactValue | unknown } | { ok: false; error: EvalError }`.
- **Round-trip property**: The property that `parse(print(expr))` returns an expression
  structurally equal to `expr` for every valid `Expr`.
- **Canonical string**: The unique string produced by the Printer for a given AST, used as
  the normalised representation for storage and round-trip testing.
- **Dead Certain**: The expert-system product this component belongs to.
- **kb-format.md**: The reference document at `docs/kb-format.md` that describes the full
  knowledge-base YAML schema, including the expression sub-language.

---

## Requirements

### Requirement 1: Expression Grammar

**User Story:** As a knowledge-base author, I want a well-defined expression grammar, so that I
can write rule conditions and computed values with predictable syntax and precedence.

#### Acceptance Criteria

1. THE Expression_Grammar SHALL support the following literal forms:
   - Boolean literals `true` and `false`
   - Integer and decimal number literals (for example `42`, `3.14`), where integers are in the range −9,007,199,254,740,991 to 9,007,199,254,740,991 and decimals carry up to 15 significant digits
   - Money literals expressed as non-negative integer minor-unit values in the range 0 to 999,999,999,999,999 (for example `100000` for ₹1,000.00)
   - Date literals as ISO 8601 calendar-date strings of exactly the form `"YYYY-MM-DD"`
   - Enum literals as single-quoted strings (for example `'approved'` or `'pending'`), where the content between the single quotes is a non-empty string that matches a known enum option at evaluation time; single quotes are used exclusively for enum literals so they are syntactically distinct from date literals (double-quoted) and fact names (bare identifiers)

2. THE Expression_Grammar SHALL support fact names as identifiers that resolve to the current value of the named fact in the enclosing environment, where a valid identifier starts with a letter or underscore, contains only letters, digits, and underscores, is at most 128 characters long, and is not equal to any reserved keyword (`true`, `false`, `and`, `or`, `not`, `min`, `max`, `round`, `if`, `days_between`).

3. THE Expression_Grammar SHALL support arithmetic operators `+`, `-`, `*`, and `/` on numeric
   and money operands.

4. THE Expression_Grammar SHALL support comparison operators `==`, `!=`, `<`, `<=`, `>`, and
   `>=` that return a boolean or `unknown` when either operand is `unknown`, and that accept
   numeric operands or two date operands as specified in criterion 12.

5. THE Expression_Grammar SHALL support logical operators `and`, `or`, and `not` following
   Kleene three-valued logic.

6. THE Expression_Grammar SHALL support the following built-in functions:
   - `min(a, b)` — returns the lesser of two numeric or money values
   - `max(a, b)` — returns the greater of two numeric or money values
   - `round(x)` — rounds a numeric value to the nearest integer using half-up rounding (0.5 rounds to 1, −0.5 rounds to 0)
   - `if(cond, then, else)` — returns `then` when `cond` is `true`, `else` when `cond` is `false`, and `unknown` when `cond` is `unknown`
   - `days_between(d1, d2)` — returns the signed number of whole days computed as d2 − d1, expressed as a non-negative integer when d2 is later than d1 and as a negative integer when d2 is earlier than d1

7. THE Expression_Grammar SHALL define operator precedence, from highest to lowest binding, as: (1) function calls; (2) unary `not` and unary `-`; (3) `*` and `/`; (4) `+` and `-`; (5) comparison operators `==`, `!=`, `<`, `<=`, `>`, `>=`; (6) `and`; (7) `or`; with all binary operators at the same precedence level associating left-to-right, and parentheses overriding all precedence rules.

8. WHERE the source text contains syntactically ambiguous forms, THE Expression_Grammar SHALL
   resolve ambiguity deterministically using the precedence and associativity rules in criterion 7.

9. IF the source text uses the `/` operator, THEN THE Expression_Grammar SHALL parse it as a binary division node; the Evaluator is responsible for detecting a zero divisor at evaluation time and returning an `EvalError` with code `"DIVISION_BY_ZERO"` as specified in Requirement 4.

10. WHEN an expression appears as a YAML scalar value in a rule field (for example `to:` or `when:`), THE Expression_Grammar's literal syntax SHALL be safe from silent YAML alteration provided the author follows the rule in Requirement 10 (kb-format.md): YAML strips leading and trailing quote characters only when they delimit the *entire* scalar value, so an expression that begins with a single-quoted enum literal (e.g. `'gold'`) or a double-quoted date literal (e.g. `"2026-11-10"`) would have its quotes stripped by YAML and would reach the parser as a bare identifier (e.g. `gold` or `2026-11-10`). Authors MUST wrap such expressions in the other YAML quote style (e.g. `to: "'gold'"` or `to: '"2026-11-10"'`) or use a YAML block scalar. The rule-language parser operates on the post-YAML string value.

11. THE Parser SHALL treat the bare text `2026-11-10` (a hyphenated date string without surrounding quotes) as a fact name or an `UNEXPECTED_TOKEN` error — it SHALL NEVER silently parse it as a date literal. A date literal is only valid when enclosed in double quotes as `"2026-11-10"`.

12. THE Expression_Grammar SHALL allow `<`, `<=`, `>`, and `>=` on two operands that are both valid `YYYY-MM-DD` calendar-date strings, compared as calendar dates in chronological order; and `==` and `!=` on two dates SHALL compare the same way. Because values are plain strings at run time, THE Evaluator SHALL treat a string as a date if and only if it is a valid calendar date (year 1–9999, real month and day, leap years observed). Ordering a date against a number, a boolean, or a non-date string, or ordering two non-date strings (for example two enum values), SHALL be a type mismatch as specified in Requirement 4.

13. THE Expression_Grammar SHALL require every quoted literal to be terminated by its closing quote, and SHALL require the content of an enum literal to be non-empty; the Parser behaviour for violations is specified in Requirement 2, criteria 9 and 10.

---

### Requirement 2: Parser

**User Story:** As an engine developer, I want a total parser that always returns a result, so
that the build toolchain and the engine can safely parse expressions without defensive
try-catch wrapping.

#### Acceptance Criteria

1. THE Parser SHALL expose a function `parse(source: string): ParseResult` where
   `ParseResult` is `{ ok: true; expr: Expr } | { ok: false; error: ParseError }`.

2. WHEN the source string is a valid expression, THE Parser SHALL return
   `{ ok: true; expr: Expr }` where `expr` is the AST for that expression.

3. WHEN the source string is not a valid expression, THE Parser SHALL return
   `{ ok: false; error: ParseError }` with a `message` of 1 to 200 characters, a `position`
   value in the range 0 to `source.length` (measured in UTF-16 code units) indicating
   the offset where parsing failed, and a non-empty `code` string from the defined set of
   error class identifiers.

4. FOR ALL input strings, THE Parser SHALL return a `ParseResult` without throwing a
   JavaScript exception — including inputs that are empty, contain only whitespace, or
   contain arbitrary Unicode.

5. THE Parser SHALL accept leading and trailing whitespace characters (Unicode code points
   U+0009, U+000A, U+000D, U+0020) in the source string without treating them as a parse
   error.

6. WHEN the source string contains a valid expression followed by trailing non-whitespace
   content, THE Parser SHALL return a `ParseError` with `code` set to `"TRAILING_CONTENT"`
   and `position` set to the UTF-16 code unit offset of the first non-whitespace character
   after the expression.

7. IF the source string is empty or contains only whitespace characters, THEN THE Parser
   SHALL return `{ ok: false; error: ParseError }` with `code` set to `"EMPTY_INPUT"` and
   `position` set to `0`.

8. WHEN the source contains a character that starts no valid token (for example `$`, or a leading `.` as in `.5`), THE Parser SHALL return a `ParseError` with `code` `"UNEXPECTED_TOKEN"` and `position` set to the UTF-16 offset of that character; THE Parser SHALL NOT report `"INVALID_DATE"` for it. The `"INVALID_DATE"` code is reserved for a terminated double-quoted string that is not a valid `YYYY-MM-DD` calendar date.

9. WHEN a single-quoted or double-quoted literal has no closing quote, THE Parser SHALL return a `ParseError` with `code` `"UNEXPECTED_END"` and `position` equal to `source.length`; THE Parser SHALL NOT report `"INVALID_DATE"` for an unterminated double-quoted string.

10. WHEN an enum literal is empty (`''`), THE Parser SHALL return a `ParseError` with `code` `"UNEXPECTED_TOKEN"` and `position` set to the offset of the opening quote.

---

### Requirement 3: Printer

**User Story:** As a knowledge-base toolchain developer, I want a printer that converts any
AST back to a canonical string, so that expressions can be stored, displayed, and round-trip
tested reliably.

#### Acceptance Criteria

1. THE Printer SHALL expose a function `print(expr: Expr): string` that accepts any `Expr`
   and returns a string.

2. WHEN the Printer is applied to any `Expr`, THE Printer SHALL return a string that the
   Parser accepts as valid and that round-trips to the same `Expr` — that is,
   `parse(print(expr)).ok` is `true` and the resulting `expr` is structurally equal to the
   input, where structural equality means every node kind, operator, operand value, and
   child-node structure matches recursively.

3. THE Printer SHALL produce a canonical (normalised) form: two structurally equal `Expr`
   values MUST produce identical strings, character for character.

4. THE Printer SHALL insert parentheses only where required to preserve the precedence
   relationships encoded in the AST; it MUST NOT insert parentheses around a sub-expression
   whose precedence is already higher than its parent operator, and it MUST NOT insert
   parentheses around the outermost expression.

5. THE Printer SHALL format numeric values without trailing zeros after a decimal point,
   except that integer-valued decimals SHALL be printed without a decimal point (for example,
   `1.50` prints as `1.5`, and `2.00` prints as `2`).

6. THE Printer SHALL format date literals as ISO 8601 calendar-date strings (`YYYY-MM-DD`)
   enclosed in double quotes (for example, `"2024-03-15"`).

7. IF the Printer receives an `Expr` node whose kind is not recognised, THEN the Printer
   SHALL throw an error indicating the unrecognised node kind without returning a partial
   string.

---

### Requirement 4: Evaluator

**User Story:** As an engine developer, I want an evaluator that reduces expressions to typed
values and propagates unknown correctly, so that the engine can determine when a goal is
decided without asking for every fact.

#### Acceptance Criteria

1. THE Evaluator SHALL expose a function `evaluate(expr: Expr, env: Env): EvalResult` where
   `Env` is `Readonly<Record<string, FactValue | unknown>>` and
   `EvalResult` is `{ ok: true; value: FactValue | unknown } | { ok: false; error: EvalError }`.

2. WHEN evaluating a literal, THE Evaluator SHALL return the literal's value unchanged.

3. WHEN evaluating a fact name that is present in `env`, THE Evaluator SHALL return the
   associated value (which may itself be `unknown`).

4. WHEN evaluating a fact name that is absent from `env`, THE Evaluator SHALL return
   `unknown`.

5. WHEN evaluating arithmetic, THE Evaluator SHALL return `unknown` if either operand
   evaluates to `unknown`.

6. WHEN evaluating a division whose divisor evaluates to zero, THE Evaluator SHALL return an
   `EvalError` with code `"DIVISION_BY_ZERO"`.

7. WHEN evaluating a comparison, THE Evaluator SHALL return `unknown` if either operand
   evaluates to `unknown`.

8. WHEN evaluating `not`:
   - `not true` SHALL evaluate to `false`
   - `not false` SHALL evaluate to `true`
   - `not unknown` SHALL evaluate to `unknown`

9. WHEN evaluating `and`:
   - `true and true` SHALL evaluate to `true`
   - `true and false` SHALL evaluate to `false`
   - `false and false` SHALL evaluate to `false`
   - `false and unknown` SHALL evaluate to `false`
   - `unknown and false` SHALL evaluate to `false`
   - `true and unknown` SHALL evaluate to `unknown`
   - `unknown and true` SHALL evaluate to `unknown`
   - `unknown and unknown` SHALL evaluate to `unknown`

10. WHEN evaluating `or`:
    - `false or false` SHALL evaluate to `false`
    - `true or false` SHALL evaluate to `true`
    - `true or true` SHALL evaluate to `true`
    - `true or unknown` SHALL evaluate to `true`
    - `unknown or true` SHALL evaluate to `true`
    - `false or unknown` SHALL evaluate to `unknown`
    - `unknown or false` SHALL evaluate to `unknown`
    - `unknown or unknown` SHALL evaluate to `unknown`

11. WHEN evaluating `if(cond, then, else)`:
    - WHEN `cond` evaluates to `true`, THE Evaluator SHALL return the value of `then`
    - WHEN `cond` evaluates to `false`, THE Evaluator SHALL return the value of `else`
    - WHEN `cond` evaluates to `unknown`, THE Evaluator SHALL return `unknown`

12. WHEN evaluating `min(a, b)` or `max(a, b)` where either argument evaluates to `unknown`,
    THE Evaluator SHALL return `unknown`.

13. WHEN evaluating `days_between(d1, d2)` where either argument evaluates to `unknown`,
    THE Evaluator SHALL return `unknown`.

14. WHEN evaluating `round(x)` where `x` evaluates to `unknown`, THE Evaluator SHALL return
    `unknown`.

15. WHEN evaluating an expression whose operand types are incompatible (for example, adding a
    boolean to a number), THE Evaluator SHALL return an `EvalError` with code `"TYPE_MISMATCH"`.

16. WHEN evaluating arithmetic where both operands resolve to known numeric values, THE
    Evaluator SHALL return a numeric `FactValue`; if either operand resolves to a non-numeric
    known value, THE Evaluator SHALL return an `EvalError` with code `"TYPE_MISMATCH"`.

17. WHEN evaluating a comparison where both operands resolve to known values of incompatible
    types (for example, comparing a number to a boolean), THE Evaluator SHALL return an
    `EvalError` with code `"TYPE_MISMATCH"`.

18. IF an `EvalError` is produced at any depth of a nested expression, THEN THE Evaluator
    SHALL propagate that `EvalError` as the result of the enclosing expression without further
    evaluation.

19. WHEN an argument of `days_between` evaluates to a known value that is not a string holding a valid `YYYY-MM-DD` calendar date (year 1–9999, real month and day, leap years observed — the same validity rules as the Parser), THE Evaluator SHALL return an `EvalError` with code `"TYPE_MISMATCH"`; THE Evaluator SHALL never return `NaN`.

20. THE Evaluator SHALL never return a `value` that is `NaN`, `Infinity`, or `-Infinity`.

21. WHEN an arithmetic operation, `round`, `min`, or `max` would produce a non-finite result (for example overflow from repeated multiplication), THE Evaluator SHALL return an `EvalError` with code `"NUMERIC_OVERFLOW"`.

22. WHEN a known numeric value read from the environment is `NaN`, `Infinity`, or `-Infinity`, THE Evaluator SHALL return an `EvalError` with code `"TYPE_MISMATCH"`.

23. WHEN evaluating `<`, `<=`, `>`, `>=`, `==`, or `!=` where both operands are known strings that are valid `YYYY-MM-DD` calendar dates, THE Evaluator SHALL compare them as calendar dates in chronological order.

24. WHEN evaluating `<`, `<=`, `>`, or `>=` where both operands are known and either is not a number or a valid date string (a date against a number, boolean, or non-date string; or two non-date strings such as two enum values), or where one operand is a number and the other a date, THE Evaluator SHALL return an `EvalError` with code `"TYPE_MISMATCH"`; WHEN either operand is `unknown`, THE Evaluator SHALL still return `unknown`.

---

### Requirement 5: Typed Errors

**User Story:** As a knowledge-base author, I want typed, structured error values from the
parser and evaluator, so that I can display actionable diagnostics in the build toolchain and
the IDE.

#### Acceptance Criteria

1. THE Parser SHALL return `ParseError` values that carry a string `message` (human-readable,
   in English, maximum 500 characters), a numeric `position` (zero-based byte offset into
   the source string, minimum 0 and maximum equal to the length of the source string in
   bytes), and a string `code` drawn from a documented set of parse error codes.

2. THE Evaluator SHALL return `EvalError` values that carry a string `message`
   (human-readable, in English, maximum 500 characters), a string `code` drawn from a
   documented set of evaluation error codes, and an optional `expr` field containing the
   sub-expression that caused the error as a string of maximum 1000 characters.

3. THE Expression_Grammar SHALL define and document the following parse error codes:
   - `"UNEXPECTED_TOKEN"` — a token appeared where the grammar did not expect it, including a character that starts no valid token and an empty enum literal `''`
   - `"UNEXPECTED_END"` — the input ended before the expression was complete, including an unterminated quoted literal (position `source.length`)
   - `"UNKNOWN_FUNCTION"` — an identifier followed by `(` does not match any built-in
   - `"TRAILING_CONTENT"` — valid expression followed by non-whitespace content
   - `"INVALID_DATE"` — a terminated double-quoted string that is not a valid `YYYY-MM-DD` calendar date
   - `"EMPTY_INPUT"` — the input string is empty or contains only whitespace

4. THE Expression_Grammar SHALL define and document the following evaluation error codes:
   - `"DIVISION_BY_ZERO"` — divisor evaluated to zero
   - `"TYPE_MISMATCH"` — operand types are incompatible with the operator or function, including a non-finite numeric value read from the environment, a non-date argument to `days_between`, and ordering of non-comparable operands
   - `"NUMERIC_OVERFLOW"` — an arithmetic operation, `round`, `min`, or `max` would produce a non-finite result
   - `"UNKNOWN_ERROR"` — an error code not in the documented set was encountered

5. WHEN the Parser returns a `ParseError`, THE Parser SHALL NOT include a JavaScript stack
   trace or any engine-internal detail in the `message` field.

6. IF the Parser receives a source string of length zero, THEN THE Parser SHALL return a
   `ParseError` with `code` `"EMPTY_INPUT"` and `position` `0`.

7. IF the Evaluator encounters a `code` value not present in the documented set of evaluation
   error codes, THEN THE Evaluator SHALL return an `EvalError` with `code` `"UNKNOWN_ERROR"`
   and a `message` indicating the unrecognised operation.

---

### Requirement 6: Expr Type (Contract Change Proposal)

**User Story:** As a cross-lane developer, I want a concrete `Expr` type that replaces
`Expr = unknown` in `packages/engine/src/types.ts`, so that the engine and the build toolchain
share a typed, JSON-serialisable AST without a runtime parsing step.

#### Acceptance Criteria

1. THE Expr_Type SHALL be a TypeScript tagged-union where each variant carries a `kind`
   discriminant string field, such that a `switch` statement on `kind` that handles every
   variant listed in criterion 2 produces no TypeScript error under `strict` and
   `noImplicitReturns` compiler flags, and a round-trip through `JSON.stringify` followed by
   `JSON.parse` produces a value that is structurally equal to the original.

2. THE Expr_Type SHALL include variants for every node kind required by the grammar:
   - `{ kind: "literal"; type: FactType; value: FactValue }` for all literal forms
   - `{ kind: "fact"; name: string }` for fact-name references, where `name` is a non-empty
     string
   - `{ kind: "unary"; op: "not" | "-"; operand: Expr }` for unary operators
   - `{ kind: "binary"; op: BinaryOp; left: Expr; right: Expr }` for all binary operators,
     where `BinaryOp` is a string union of `"+", "-", "*", "/", "==", "!=", "<", "<=", ">",
     ">=", "and", "or"`
   - `{ kind: "call"; fn: BuiltinFn; args: readonly Expr[] }` for function calls, where
     `BuiltinFn` is a string union of `"min", "max", "round", "if", "days_between"`, and
     `args` contains between 1 and 5 elements inclusive

3. THE Expr_Type SHALL be JSON-serialisable: every field value MUST be a JSON primitive, a
   `readonly` array of `Expr`, or a nested `Expr`; and the TypeScript type MUST NOT include
   `Function`, `symbol`, `bigint`, `undefined`, or class-instance types in any field
   position, verified by TypeScript compilation under `strict` mode producing zero errors.

4. WHERE `packages/engine/src/types.ts` currently declares `export type Expr = unknown`,
   THE Expr_Type proposal SHALL replace that declaration with the concrete union defined in
   criteria 1 and 2 above, subject to human approval before the design phase begins.

5. THE Expr_Type SHALL be defined in `packages/engine/src/types.ts` and re-exported from
   `packages/engine/src/index.ts` so that both the engine and the build toolchain import it
   from the same canonical location, verified by confirming that no other file in
   `packages/engine/src/` exports a declaration named `Expr`.

6. IF any existing file in `packages/engine/src/` or `packages/kb-tools/src/` imports `Expr`
   from a path other than `packages/engine/src/index.ts` after the replacement is applied,
   THEN the TypeScript compiler SHALL report an error, ensuring the canonical export location
   is the sole source of truth; and the declaration in `packages/engine/src/types.ts` and
   its re-export from `packages/engine/src/index.ts` MUST be committed and compile cleanly
   before any other file in `packages/engine/src/` or `packages/kb-tools/src/` is updated
   to import the new concrete `Expr` type.

---

### Requirement 7: Round-Trip Property

**User Story:** As a quality-assurance engineer, I want a property-based test that verifies
every printed expression parses back to the same AST, so that the printer and parser stay
consistent as the codebase evolves.

#### Acceptance Criteria

1. THE Round_Trip_Test SHALL be implemented as a property-based test using fast-check in a
   file named `packages/engine/src/round-trip.props.test.ts`.

2. THE Round_Trip_Test SHALL define an arbitrary generator that produces well-typed `Expr`
   values such that every value yielded by the generator conforms to one of the tagged-union
   variants defined in Requirement 6, Criterion 2 — covering all node kinds: literals, fact
   references, unary operators, binary operators, and function calls — and such that any
   generated node of kind `"literal"` carries a `value` whose JavaScript type is consistent
   with its `type` field (boolean for `type: "boolean"`, number for `type: "number"` or
   `type: "money"`, ISO 8601 date string for `type: "date"`, and string for `type: "enum"`);
   the generator SHALL enforce a maximum recursion depth of 5 and a default depth of 3
   controlled by a numeric constant exported from the test file.

3. FOR ALL `Expr` values produced by the generator, THE Round_Trip_Test SHALL assert that
   `parse(print(expr))` returns `{ ok: true }` and that the resulting `expr` is structurally
   equal to the input, where structural equality means recursive deep equality over every
   field of every `Expr` node — that is, equal `kind`, equal primitive fields, and
   recursively structurally equal child `Expr` nodes.

4. THE Round_Trip_Test SHALL run in Vitest under `pnpm test:props` and SHALL report any
   counterexample that fast-check finds as a minimal shrunk expression.

---

### Requirement 8: Total Parser Property

**User Story:** As a quality-assurance engineer, I want a property-based test that verifies
the parser never throws on any input, so that the build toolchain is safe from unexpected
crashes.

#### Acceptance Criteria

1. THE Total_Parser_Test SHALL be implemented as a property-based test using fast-check in a
   file named `packages/engine/src/total-parser.props.test.ts`.

2. THE Total_Parser_Test SHALL use `fc.string()` as the arbitrary generator — which produces
   arbitrary Unicode strings — with no additional filtering.

3. FOR ALL strings produced by the generator, THE Total_Parser_Test SHALL assert that
   calling `parse(input)` does not throw, and that the return value is either
   `{ ok: true; expr: Expr }` or `{ ok: false; error: ParseError }`.

4. THE Total_Parser_Test SHALL run in Vitest under `pnpm test:props` and SHALL report any
   counterexample that causes `parse` to throw rather than return a `ParseResult`.

---

### Requirement 9: Three-Valued Logic Property

**User Story:** As a quality-assurance engineer, I want a property-based test that verifies
the evaluator follows Kleene three-valued logic for all combinations of boolean and unknown
inputs, so that the engine's early-stop behaviour is correct.

#### Acceptance Criteria

1. THE Three_Valued_Logic_Test SHALL be implemented as a property-based test using fast-check
   in a file named `packages/engine/src/three-valued.props.test.ts`.

2. THE Three_Valued_Logic_Test SHALL define an arbitrary that generates elements from the
   set `{ true, false, unknown }`, where `unknown` is represented as the unique symbol
   exported from the engine as `UNKNOWN` (i.e., `Symbol.for("unknown")` or the equivalent
   sentinel value defined in `packages/engine/src/index.ts`), and `true` and `false` are
   the JavaScript boolean primitives.

3. FOR ALL pairs `(a, b)` from the arbitrary, THE Three_Valued_Logic_Test SHALL assert the
   following Kleene identities hold for `and`:
   - `false and x` = `false` for all `x`
   - `x and false` = `false` for all `x`
   - `true and true` = `true`
   - `true and unknown` = `unknown`
   - `unknown and true` = `unknown`

4. FOR ALL pairs `(a, b)` from the arbitrary, THE Three_Valued_Logic_Test SHALL assert the
   following Kleene identities hold for `or`:
   - `true or x` = `true` for all `x`
   - `x or true` = `true` for all `x`
   - `false or false` = `false`
   - `false or unknown` = `unknown`
   - `unknown or false` = `unknown`

5. FOR ALL `a` from the arbitrary, THE Three_Valued_Logic_Test SHALL assert that `not (not a)`
   = `a` (double negation law holds in Kleene logic).

6. FOR ALL pairs `(a, b)` from the arbitrary, THE Three_Valued_Logic_Test SHALL assert the
   De Morgan identities:
   - `not (a and b)` = `not a or not b`
   - `not (a or b)` = `not a and not b`

7. THE Three_Valued_Logic_Test SHALL run in Vitest under `pnpm test:props` and SHALL report
   any counterexample that violated an identity, including the operands involved: `(a, b)` for
   binary identities in criteria 3, 4, and 6, and `(a)` for the unary identity in criterion 5.

---

### Requirement 10: Knowledge-Base Format Reference

**User Story:** As a knowledge-base author, I want a complete written reference for the
knowledge-base YAML format, so that I can write rules, facts, and expressions without
consulting source code.

#### Acceptance Criteria

1. THE KB_Format_Reference SHALL be written to `docs/kb-format.md` and SHALL describe the
   full YAML schema for a knowledge base, covering: the `id`, `currency`, and `goals` fields;
   the `facts` map with all supported fact types (`boolean`, `number`, `money`, `date`,
   `enum`) and their properties (`ask`, `why`, `derived`, `options`, `role`); the `rules`
   array with all supported rule fields (`id`, `cite`, `set`, `to`, `when`, `because`); and
   the `clauses` map with the `id`, `title`, and `text` fields. The reference SHALL also note
   that the `kb-tools` validator must reject any rule whose compiled expression is a bare
   identifier naming no defined fact, with a diagnostic message hinting that the expression
   may have been a quoted literal whose quotes were stripped by YAML (for example: "Fact
   'gold' is not defined — did you mean the enum literal 'gold'?").

2. THE KB_Format_Reference SHALL include a complete specification of the expression
   sub-language in an "Expression Language" section, covering all literal forms, fact names,
   arithmetic operators, comparison operators, logical operators, and built-in functions with
   their signatures and behaviour on `unknown`.

3. THE KB_Format_Reference SHALL include a "Three-valued logic" section explaining Kleene
   logic with truth tables for `and`, `or`, and `not`.

4. THE KB_Format_Reference SHALL include at least two complete worked examples — where a
   complete example means a YAML snippet containing at least one rule with a `when` or `to`
   expression, an annotation of each expression used, and the expected evaluation result given
   stated input facts — with one example using arithmetic and comparisons, and one using `if`
   and `days_between`.

5. THE KB_Format_Reference SHALL list all parse error codes defined in Requirement 5 with an
   explanation and example source for each.

6. THE KB_Format_Reference SHALL include a "Compiled form" section showing the JSON shape of
   the `Expr` type defined in Requirement 6, with one example expression and its
   corresponding JSON.

7. THE KB_Format_Reference SHALL document the behaviours added by Requirements 1, 2, 4, and 5 (stray-character and unterminated-literal errors, the empty enum rule, `days_between` argument validation, date ordering, `NUMERIC_OVERFLOW`) and SHALL include an "Accepted limitations" note covering the decisions recorded in the Accepted Decisions section.

---

### Requirement 11: Finite Results Property

**User Story:** As a quality-assurance engineer, I want a property-based test that verifies the evaluator never yields a non-finite number and never throws for well-typed input, so that extreme magnitudes and zero divisors cannot corrupt verdicts.

#### Acceptance Criteria

1. THE Finite_Results_Test SHALL be implemented as a property-based test using fast-check in a file named `packages/engine/src/lang/finite-results.props.test.ts`.

2. THE Finite_Results_Test SHALL define arbitrary generators for well-typed `Expr` values and matching environments, where well-typed means: operands of arithmetic operators and `min`, `max`, and `round` are numeric; operands of `<`, `<=`, `>`, `>=` are both numeric or both valid `YYYY-MM-DD` date strings; operands of `and`, `or`, and `not` are boolean; the condition of `if` is boolean; and operands of `days_between` are valid `YYYY-MM-DD` date strings.

3. THE Finite_Results_Test generators SHALL include extreme-magnitude numbers (for example `1e308` and `Number.MAX_SAFE_INTEGER`) and zero divisors, so that overflow and division-by-zero paths are exercised.

4. FOR ALL generated well-typed expressions and environments, THE Finite_Results_Test SHALL assert that `evaluate` does not throw, and that any result with `ok: true` carries a `value` that is not `NaN`, `Infinity`, or `-Infinity`.

5. THE Finite_Results_Test SHALL run in Vitest under `pnpm test:props` with at least 100 iterations and SHALL report any counterexample as a minimal shrunk expression and environment.

---

## Accepted Decisions

The following behaviours are deliberately accepted and are not defects:

1. **`"UNKNOWN_ERROR"` is a defensive fallback.** No source string accepted by the Parser can cause the Evaluator to produce `"UNKNOWN_ERROR"`; it arises only for hand-built `Expr` values that bypass the Parser. The code is kept so that the Evaluator stays total (Requirement 5, criterion 7).

2. **There is no money literal syntax.** The Parser tags every numeric literal `type: "number"` because it cannot distinguish money from a plain number by syntax alone. Money typing is the concern of the knowledge-base validator and the evaluation context, not the Parser.
