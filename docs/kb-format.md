# Knowledge-base format

A knowledge base is a YAML file at `apps/<app>/kb/*.yaml`. It holds the typed facts, the rules that derive them, and the rulebook clauses those rules cite. `pnpm dc validate` checks the file, and `pnpm dc build` compiles it to JSON at build time. The compiled form matches the `KnowledgeBase` type in `packages/engine/src/types.ts`.

This section describes the YAML schema. The expressions used in `to` and `when` are covered in the next section, "Expression language".

## Top-level fields

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `id` | string | required | Identifies the knowledge base, for example `claim-check`. |
| `currency` | string | optional | ISO 4217 code, for example `INR`. Give it when the knowledge base uses money. |
| `goals` | array of strings | required | Names of the facts the engine must decide. A verdict reports one value per goal. |
| `facts` | map | required | Fact name to fact definition. See "The `facts` map". |
| `rules` | array | required | Ordered list of rules. See "The `rules` array". |
| `clauses` | map | required | Clause id to clause. See "The `clauses` map". |

## The `facts` map

Each key is a fact name. Each value is a fact definition. Fact names are the bare identifiers that expressions use to refer to a fact.

### Fact types

| Type | Meaning |
| --- | --- |
| `boolean` | `true` or `false`. |
| `number` | A number, integer or decimal. |
| `money` | An integer in minor units, for example `100000` for 1,000.00 in a two-decimal currency. |
| `date` | An ISO 8601 calendar-date string, `YYYY-MM-DD`. |
| `enum` | One of the strings listed in the fact's `options`. |

### Fact properties

| Property | Type | Required | Constraints |
| --- | --- | --- | --- |
| `type` | `boolean`, `number`, `money`, `date` or `enum` | required | Fixes the type of the fact's value. |
| `ask` | string | optional | The question text. Present on facts the engine may ask for. |
| `why` | string | optional | Why the question matters. Shown with the question. |
| `derived` | boolean | optional | Marks a fact that rules compute, rather than one the user answers or an app collects. |
| `options` | array of strings | optional | The allowed values. Used when `type` is `enum`. |
| `role` | `deduction` or `check` | optional | Marks facts the interface lists as line items. A `deduction` fact must have type `money`. A `check` fact must have type `boolean`. Any other type is reported as `ROLE_TYPE_MISMATCH`. |
| `label` | string | optional | Display name shown on ledger lines. When absent, the engine derives one from the fact name: underscores become spaces and the first letter is capitalised. |

## The `rules` array

A rule sets one fact from one expression and cites one clause. Rules for the same fact are tried in file order.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `id` | string | required | The rule's identifier, for example `ROOM-01`. |
| `cite` | string | required | The id of a clause in `clauses`. It must name an existing clause. Quote values such as `"4.2"` so YAML reads them as strings. |
| `set` | string | required | The name of the fact this rule sets. |
| `to` | expression | required | The value the rule gives the fact. One expression. |
| `when` | expression | optional | A guard. When present, it limits where the rule applies. |
| `because` | string | required | A plain sentence that explains the rule. It may contain `{fact}` placeholders, which are filled with the fact's value when a proof is shown. |

## The `clauses` map

Each key is a clause id, and `cite` on a rule must name one of these keys. Each value has these fields. The clause id is the map key, so it is not repeated inside the value.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `title` | string | required | A short heading for the clause. |
| `text` | string | required | The rulebook wording the rule relies on. |

## Example

A small knowledge base based on the room-rent rule. It also shows a `when` guard, `role`, and a clause map.

```yaml
id: claim-check
currency: INR
goals: [room_rent_excess]

facts:
  room_rent_per_day:
    type: money
    ask: What was the room rent per day?
    why: The policy caps room rent, and a higher rent reduces other charges too.
  sum_insured: { type: money, ask: What is the sum insured on the policy? }
  room_rent_cap: { type: money, derived: true }
  rent_over_cap: { type: boolean, derived: true }
  room_rent_excess:
    type: money
    derived: true
    role: deduction
    label: Room rent over the limit

rules:
  - id: ROOM-01
    cite: "4.2"
    set: room_rent_cap
    to: sum_insured * 0.01
    because: The room rent limit is 1% of the sum insured per day.
  - id: ROOM-02
    cite: "4.2"
    set: rent_over_cap
    to: room_rent_per_day > room_rent_cap
    because: Room rent of {room_rent_per_day} is above the limit of {room_rent_cap}.
  - id: ROOM-03
    cite: "4.2"
    set: room_rent_excess
    when: rent_over_cap
    to: room_rent_per_day - room_rent_cap
    because: The part of the rent above the limit, {room_rent_cap}, is not covered.

clauses:
  "4.2":
    title: Room rent limit
    text: Room rent is covered up to 1% of the sum insured per day.
```

## Validator note: quoted literals that YAML strips

YAML removes quote characters that wrap an entire scalar value. A rule written as `to: 'gold'` reaches the expression parser as the bare identifier `gold`, not as the enum literal `'gold'`. To keep the quotes, wrap the expression in the other quote style, for example `to: "'gold'"`, or use a YAML block scalar. The same applies to a date literal such as `"2026-11-10"`.

The `kb-tools` validator must reject any rule whose expression is a bare identifier that names no defined fact. Its diagnostic must hint that the expression may have been a quoted literal whose quotes YAML stripped, for example:

```text
Fact 'gold' is not defined — did you mean the enum literal 'gold'?
```

## Expression language

Expressions are the values of the `to` and `when` fields of a rule. Each field holds one expression. The parser works on the string that YAML hands over, after YAML has parsed the file. It never sees the raw YAML text, which matters for quotes (see "YAML safety" below).

An expression is built from literals, fact names, operators and built-in functions. Whitespace (space, tab, line feed, carriage return) between tokens is ignored.

### Literals

| Kind | Syntax | Examples |
| --- | --- | --- |
| Boolean | `true` or `false` | `true` |
| Number | Digits, with an optional `.` and more digits | `42`, `0.01`, `3.14` |
| Date | `YYYY-MM-DD` inside double quotes | `"2026-11-10"` |
| Enum | Text inside single quotes | `'approved'` |

- A number needs digits on both sides of the decimal point. `.5` and `1.` are not valid. A leading minus is the unary `-` operator, not part of the literal.
- A date must be a real calendar date. `"2026-02-30"` is an `INVALID_DATE` error.
- An enum literal needs at least one character. `''` is an `UNEXPECTED_TOKEN` error at the opening quote.
- Both kinds of quoted literal must be closed. `'abc` and `"2024-01-01` are `UNEXPECTED_END` errors.
- A bare `2026-11-10` is never a date. It reads as the subtraction `2026 - 11 - 10`. Always put dates in double quotes.
- There is no separate syntax for money. A money value is a whole number of minor units, written like any number, for example `100000`.

### Fact names

A fact name is a bare identifier that stands for the current value of that fact.

- It starts with a letter or an underscore.
- The rest is letters, digits and underscores.
- It is at most 128 characters long.
- It must not be a reserved word.

Reserved words: `true`, `false`, `and`, `or`, `not`, `min`, `max`, `round`, `if`, `days_between`.

Using a reserved word where a fact name is expected, such as `min + 1`, is an `UNEXPECTED_TOKEN` error. An identifier followed by `(` that is not a built-in function is an `UNKNOWN_FUNCTION` error.

### Operators and precedence

From highest to lowest. Operators on the same row bind equally.

| Level | Operators | Associativity |
| --- | --- | --- |
| 1 | Parentheses `( )` and function calls | n/a |
| 2 | Unary `not`, unary `-` | Prefix; they nest, so `not not a` and `- -a` are valid |
| 3 | `*`, `/` | Left to right |
| 4 | `+`, `-` | Left to right |
| 5 | `==`, `!=`, `<`, `<=`, `>`, `>=` | Non-associative |
| 6 | `and` | Left to right |
| 7 | `or` | Left to right |

Things to watch:

- Comparisons do not chain. `a < b < c` is an error (`TRAILING_CONTENT`). Write `a < b and b < c`.
- Unary `not` binds tighter than a comparison. `not a == b` means `(not a) == b`. To negate a comparison, write `not (a == b)`.
- Unary `-` binds tighter than `*`. `-a * b` means `(-a) * b`.

What each operator accepts:

| Operators | Operands | Result |
| --- | --- | --- |
| `+`, `-`, `*`, `/` | Numbers, which includes money | Number. The result is not rounded. Use `round(...)` when you need whole minor units. |
| `==`, `!=` | Two values of the same type: booleans, numbers, dates or enums | Boolean |
| `<`, `<=`, `>`, `>=` | Two numbers (money included), or two dates | Boolean |
| `and`, `or`, `not` | Booleans | Boolean |
| unary `-` | A number | Number |

Dates are compared as calendar dates, so `<`, `<=`, `>`, `>=`, `==` and `!=` all work on two dates:

```yaml
when: admission_date < policy_start
```

With `admission_date` = `"2026-01-01"` and `policy_start` = `"2026-03-01"` this is `true`. With `admission_date` absent it is `unknown`.

- A date compared with a number or a boolean is a `TYPE_MISMATCH` error, for both ordering and `==`.
- Ordering (`<`, `<=`, `>`, `>=`) on strings that are not dates, such as `'a' < 'b'`, is a `TYPE_MISMATCH` error. Enums can be compared only with `==` and `!=`.
- Use `days_between` when you need the number of days, for example `days_between(policy_start, admit_date) < 30`. You do not need it for ordering.

### Built-in functions

| Function | Result | If an argument is unknown |
| --- | --- | --- |
| `min(a, b)` | The lesser of two numbers | `unknown` |
| `max(a, b)` | The greater of two numbers | `unknown` |
| `round(x)` | `x` rounded to the nearest whole number, with halves rounding up: `round(0.5)` is 1, `round(-0.5)` is 0, `round(-1.5)` is -1 | `unknown` |
| `if(cond, then, else)` | `then` when `cond` is true, `else` when `cond` is false | `unknown` when `cond` is unknown. Only the chosen branch is evaluated. |
| `days_between(d1, d2)` | The number of whole days from `d1` to `d2`, as `d2 - d1`. It is negative when `d2` is earlier. | `unknown` |

- `min` and `max` take money as well as plain numbers, because a money value is a number. Both arguments must be numbers.
- `days_between` takes two dates. It computes the difference from the two date strings at midnight UTC. A known argument that is not a valid `YYYY-MM-DD` date, such as `'x'` or `"2026-02-30"`, is a `TYPE_MISMATCH` error. An unknown argument gives `unknown`, as usual.
- Each function takes exactly the number of arguments shown. A different count is an `UNEXPECTED_TOKEN` error.

### Errors at evaluation time

An evaluation error is different from `unknown`. It means the expression cannot be computed at all.

| Code | When |
| --- | --- |
| `DIVISION_BY_ZERO` | The divisor of `/` is known and equals zero. This is an error, not `unknown`. |
| `TYPE_MISMATCH` | An operand or argument has the wrong type, for example `true + 1`, `1 == true`, or `not 5`. Also: ordering a date against a non-date, ordering two non-date strings, a `days_between` argument that is not a valid date, and a non-finite number (`NaN` or `Infinity`) in the environment. |
| `NUMERIC_OVERFLOW` | An arithmetic result is not a finite number, for example `a * 10` with `a` = `1e308`, or `a * a * a` with `a` = `1e200`. |

An error stops the evaluation of the whole expression. For arithmetic, comparisons and functions, `unknown` is checked before types, so `unknown + true` is `unknown`, not an error.

### YAML safety

YAML removes quote characters that wrap a whole scalar value. If an expression begins with a quoted literal, YAML strips the quotes before the parser sees it.

```yaml
# Wrong: YAML strips the quotes, so the parser reads the fact name gold
to: 'gold'

# Right: the outer double quotes are removed by YAML, and 'gold' reaches the parser
to: "'gold'"

# Right for a date literal: wrap it in single quotes
to: '"2026-11-10"'
```

Quotes in the middle of an expression are safe, because they no longer wrap the whole value:

```yaml
when: tier == 'gold'
to: days_between(admit_date, "2026-11-10")
```

A YAML block scalar also works. The validator rejects a bare identifier that names no defined fact, and its message hints at this mistake (see "Validator note" above).

## Three-valued logic

Facts do not always have a value. Expressions use three-valued logic, also called Kleene logic, so they can still give an answer when some facts are missing.

### Unknown is a value

`unknown` is a value that means "not decided yet". It is not an error and it is not false. A fact is unknown when:

- it is absent from the environment, because it has not been answered or collected; or
- it is in the environment with the value `unknown` set explicitly.

You cannot write `unknown` in an expression. It only comes from facts.

Most operators pass it along. If any operand of an arithmetic operator, a comparison, `-`, `min`, `max`, `round` or `days_between` is unknown, the result is unknown. The logical operators are the exception, because they can sometimes decide without it.

### Truth tables

In these tables T is true, F is false and ? is unknown.

`not`:

| a | not a |
| --- | --- |
| T | F |
| F | T |
| ? | ? |

`and`:

| a \ b | T | F | ? |
| --- | --- | --- | --- |
| T | T | F | ? |
| F | F | F | F |
| ? | ? | F | ? |

`or`:

| a \ b | T | F | ? |
| --- | --- | --- | --- |
| T | T | T | T |
| F | T | F | ? |
| ? | T | ? | ? |

The rule behind the tables: `and` is false if either side is false, and `or` is true if either side is true, even when the other side is unknown. Otherwise, an unknown side makes the result unknown.

### Short-circuiting

- `false and x` is false and `true or x` is true. The right side is not evaluated, so an error on that side (such as a type mismatch) is not reported.
- If the left side of `and` is true or unknown, the right side is evaluated. If the left side of `or` is false or unknown, the right side is evaluated.
- `if(cond, then, else)` evaluates `cond` first, then only the selected branch. The other branch is never evaluated, so `if(d != 0, x / d, 0)` never divides by zero. If `cond` is unknown, neither branch is evaluated and the result is unknown.

### Why this matters

The engine asks the user for a fact only when the answer could still change a goal. Because `false and x` and `true or x` are decided without `x`, a rule can finish while some facts are still unknown, and the engine never asks for them. Once every goal has a value, the engine stops asking questions.

## Worked examples

Each example was run through `parse`, `print` and `evaluate` in `packages/engine/src/lang/`. The results shown are the real results. Money values are whole minor units.

### Example 1: room-rent cap with arithmetic and comparisons

```yaml
rules:
  - id: ROOM-01
    cite: "4.2"
    set: room_rent_cap
    to: sum_insured * 0.01
    because: The room rent limit is 1% of the sum insured per day.
  - id: ROOM-02
    cite: "4.2"
    set: rent_over_cap
    to: room_rent_per_day > room_rent_cap
    because: Room rent of {room_rent_per_day} is above the limit of {room_rent_cap}.
  - id: ROOM-03
    cite: "4.2"
    set: room_rent_excess
    when: rent_over_cap
    to: room_rent_per_day - room_rent_cap
    because: The part of the rent above the limit, {room_rent_cap}, is not covered.
```

What each part means:

| Part | Meaning |
| --- | --- |
| `sum_insured` | A fact name. Its current value is used. |
| `0.01` | A number literal. |
| `sum_insured * 0.01` | Arithmetic. `*` takes two numbers. Money counts as a number. |
| `room_rent_per_day > room_rent_cap` | A comparison of two numbers. The result is a boolean. |
| `when: rent_over_cap` | A guard. A bare fact name whose value is a boolean. |
| `room_rent_per_day - room_rent_cap` | Subtraction of two numbers. |

Inputs and results:

| Expression | Facts | Result |
| --- | --- | --- |
| `sum_insured * 0.01` | `sum_insured` = 500000 | 5000 |
| `sum_insured * 0.01` | `sum_insured` absent | `unknown` |
| `room_rent_per_day > room_rent_cap` | `room_rent_per_day` = 6000, `room_rent_cap` = 5000 | `true` |
| `room_rent_per_day > room_rent_cap` | `room_rent_per_day` = 4000, `room_rent_cap` = 5000 | `false` |
| `room_rent_per_day > room_rent_cap` | `room_rent_per_day` absent, `room_rent_cap` = 5000 | `unknown` |
| `room_rent_per_day - room_rent_cap` | `room_rent_per_day` = 6000, `room_rent_cap` = 5000 | 1000 |
| `rent_over_cap` | `rent_over_cap` set to `unknown` | `unknown` |

A missing input is not an error. The result is `unknown`, and the answer can still change once the user gives the missing fact.

### Example 2: waiting period with `if` and `days_between`

```yaml
rules:
  - id: WAIT-01
    cite: "6.1"
    set: days_since_start
    to: days_between(policy_start, admit_date)
    because: The policy had been running for {days_since_start} days when the patient was admitted.
  - id: WAIT-02
    cite: "6.1"
    set: waiting_period_excluded
    to: if(days_since_start < 30, claim_amount, 0)
    because: A claim in the first 30 days is not covered.
```

What each part means:

| Part | Meaning |
| --- | --- |
| `days_between(policy_start, admit_date)` | The whole days from the first date to the second, as `admit_date - policy_start`. |
| `days_since_start < 30` | A comparison that gives the condition. |
| `claim_amount` | The value used when the condition is true. |
| `0` | The value used when the condition is false. |
| `if(cond, then, else)` | Only the chosen branch is evaluated. If `cond` is unknown, the result is `unknown`. |

Day counts, with `policy_start` = `"2026-01-01"`:

| `admit_date` | `days_between(policy_start, admit_date)` |
| --- | --- |
| `"2026-01-11"` | 10 |
| `"2026-03-01"` | 59 |
| `"2025-12-25"` | -7 (the admission is before the policy start, so the count is negative) |
| absent | `unknown` |

Condition results, with `claim_amount` = 80000:

| `days_since_start` | `if(days_since_start < 30, claim_amount, 0)` |
| --- | --- |
| 10 | 80000 |
| 59 | 0 |
| -7 | 80000 (a negative count is also below 30) |
| absent | `unknown` |

When `days_since_start` is 59 and `claim_amount` is absent, the result is 0, because the `then` branch is never evaluated.

## Parse error codes

`parse` returns `{ ok: false, error }` with a `code`, a `message` and a `position`. The position is a zero-based offset into the source string, counted in UTF-16 code units. The table shows the position the parser reports for each example.

| Code | Meaning | Example source | Position |
| --- | --- | --- | --- |
| `UNEXPECTED_TOKEN` | A token appears where it cannot. This includes a stray character such as `$`, a leading `.`, an empty enum literal `''`, a reserved word used as a fact name, and a wrong argument count. | `a + * 2` | 4 (the `*`) |
| `UNEXPECTED_END` | The input ends while the expression is not finished. This includes a quoted literal with no closing quote. | `1 +` | 3 |
| `UNKNOWN_FUNCTION` | A name followed by `(` is not a built-in function. | `sqrt(4)` | 0 |
| `TRAILING_CONTENT` | A full expression was read, but more text follows. | `1 2` | 2 |
| `INVALID_DATE` | Text in a closed pair of double quotes is not a real `YYYY-MM-DD` date. | `"2026-02-30"` | 0 |
| `EMPTY_INPUT` | The source is empty or only whitespace. | An empty string, or only spaces | 0 |

More examples that were checked:

| Source | Code | Position | Note |
| --- | --- | --- | --- |
| `(1 + 2` | `UNEXPECTED_END` | 6 | The closing `)` is missing. |
| `max(1, 2` | `UNEXPECTED_END` | 8 | The call is not closed. |
| `a < b < c` | `TRAILING_CONTENT` | 6 | Comparisons do not chain. The position is the second `<`. |
| `min + 1` | `UNEXPECTED_TOKEN` | 0 | `min` is a reserved word. |
| `if(a, 1)` | `UNEXPECTED_TOKEN` | 7 | Too few arguments. The position is the closing `)`. |
| `max(1, 2, 3)` | `UNEXPECTED_TOKEN` | 8 | Too many arguments. The position is the extra comma. |
| `1 + )` | `UNEXPECTED_TOKEN` | 4 | |
| `"2026-01-01` | `UNEXPECTED_END` | 11 | The closing quote is missing. The position is the source length. |
| `'abc` | `UNEXPECTED_END` | 4 | The closing quote is missing. The position is the source length. |
| `''` | `UNEXPECTED_TOKEN` | 0 | An enum literal cannot be empty. The position is the opening quote. |
| `a == ''` | `UNEXPECTED_TOKEN` | 5 | The opening quote of the empty literal. |
| `$ + 1` | `UNEXPECTED_TOKEN` | 0 | A stray character where an expression should start. |
| `.5` | `UNEXPECTED_TOKEN` | 0 | A leading `.` is not part of a number. |
| `1 + $` | `UNEXPECTED_TOKEN` | 4 | A stray character where an operand should be. |
| `a $ b` | `TRAILING_CONTENT` | 2 | A stray character after a complete expression. |

Two behaviours to know about:

- A character the language does not use, such as `$`, or a leading `.` as in `.5`, is an `UNEXPECTED_TOKEN` error at that character when it appears where an operand is expected, for example `$ + 1` or `1 + $`. When it follows a complete expression, the result is `TRAILING_CONTENT` instead, for example `a $ b` at position 2. The message names the offending text.
- `INVALID_DATE` is only for a double-quoted string that has a closing quote but is not a real calendar date, for example `"2026-02-30"`. An unclosed double quote is `UNEXPECTED_END`.

### Evaluation error codes

`evaluate` returns `{ ok: false, error }` with a `code`, a `message` and an `expr`, which is the printed sub-expression that caused the error.

| Code | Example | Facts | Reported `expr` |
| --- | --- | --- | --- |
| `DIVISION_BY_ZERO` | `a / b` | `a` = 1, `b` = 0 | `a / b` |
| `TYPE_MISMATCH` | `true + 1` | none | `true` (the offending operand) |
| `TYPE_MISMATCH` | `1 == true` | none | `1 == true` |
| `TYPE_MISMATCH` | `not 5` | none | `not 5` |
| `TYPE_MISMATCH` | `a < 5` | `a` = `"2024-02-29"` | `a` (a date cannot be ordered against a number) |
| `TYPE_MISMATCH` | `a < b` | `a` = `"x"`, `b` = `"y"` | `a` (ordering strings that are not dates) |
| `TYPE_MISMATCH` | `days_between(a, b)` | `a` = 5, `b` = `"2026-01-01"` | `a` |
| `TYPE_MISMATCH` | `days_between(a, b)` | `a` = `"x"`, `b` = `"2026-01-01"` | `a` (not a valid date) |
| `TYPE_MISMATCH` | `a + 1` | `a` = `Infinity` | `a` (non-finite number in the environment) |
| `TYPE_MISMATCH` | `a and 1` | `a` = true | `a and 1` |
| `NUMERIC_OVERFLOW` | `a * 10` | `a` = `1e308` | `a * 10` |
| `UNKNOWN_ERROR` | none from parsed source | | |

### Accepted limitations

These behaviours are deliberate and are not defects.

- `UNKNOWN_ERROR` is a defensive fallback. No source text that `parse` accepts can produce it. The parser checks the function name and the argument count, so the evaluator never sees a malformed call. It appears only when `evaluate` is given a hand-built `Expr` that breaks those checks. For example, `{ kind: "call", fn: "round", args: [] }` gives `UNKNOWN_ERROR` with the message `'round' requires exactly 1 argument`. An author cannot trigger it.
- There is no money literal. The parser tags every number `"number"`, because it cannot tell money from a plain number by syntax. A money value is a whole number of minor units, written like any number. Money typing is the job of the knowledge-base validator and the evaluation context, not the parser.

## Compiled form

`pnpm dc build` stores each expression as JSON in the shape of the `Expr` type in `packages/engine/src/types.ts`. Every node has a `kind` field.

| `kind` | Fields | Notes |
| --- | --- | --- |
| `literal` | `type`, `value` | `type` is `boolean`, `number`, `date` or `enum`. `value` is a boolean, a number, or a string. |
| `fact` | `name` | A reference to a fact by name. |
| `unary` | `op`, `operand` | `op` is `not` or `-`. |
| `binary` | `op`, `left`, `right` | `op` is one of `+`, `-`, `*`, `/`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `and`, `or`. |
| `call` | `fn`, `args` | `fn` is one of `min`, `max`, `round`, `if`, `days_between`. `args` is an array of nodes. |

- Number literals are tagged `"number"`, including ones you think of as money. The parser never produces a literal of type `money`.
- Date literals hold the date without quotes, for example `"2026-01-01"`.
- Enum literals hold the text without quotes.
- `UNKNOWN` is never stored in compiled JSON. It is a run-time value that comes from facts, and the language has no way to write it.

Example. The source `sum_insured * 0.01` compiles to:

```json
{
  "kind": "binary",
  "op": "*",
  "left": {
    "kind": "fact",
    "name": "sum_insured"
  },
  "right": {
    "kind": "literal",
    "type": "number",
    "value": 0.01
  }
}
```

A longer source, `if(days_between(policy_start, "2026-01-01") > 0 and not waived, claim * 0.9, -1)`, compiles to a `call` node with three entries in `args`:

1. A `binary` `and` node. Its left side is a `binary` `>` node that compares a `days_between` call (a `fact` and a `date` literal) with the number literal `0`. Its right side is a `unary` `not` node on the fact `waived`.
2. A `binary` `*` node on the fact `claim` and the number literal `0.9`.
3. A `unary` `-` node on the number literal `1`. The source `-1` is a unary minus, not a negative literal.

Another case: `not a == b` compiles to a `binary` `==` node whose left side is the `unary` `not` node on `a` and whose right side is the fact `b`. The `not` binds to `a` alone.

## Printing

`print(expr)` turns an `Expr` back into source text in one canonical form. Two equal `Expr` values always print the same text, and `parse(print(e))` gives back an `Expr` equal to `e`. All the examples below round-trip.

The printer follows these rules:

- Operators and commas are separated by single spaces. Function calls print as `name(a, b)`.
- Parentheses appear only where they are needed to keep the structure. The outermost expression never gets parentheses.
- Numbers print without trailing zeros.
- Dates print in double quotes and enums in single quotes.

| Source | Printed form | Why |
| --- | --- | --- |
| `(a + b) + c` | `a + b + c` | Left-to-right grouping already gives this structure. |
| `a + (b + c)` | `a + (b + c)` | The parentheses change the structure, so they stay. |
| `1.50 + 2.00` | `1.5 + 2` | Trailing zeros are dropped. |
| `min( a ,b )` | `min(a, b)` | Spacing is normalised. |
| `(a or b) and c` | `(a or b) and c` | `and` binds tighter than `or`, so the parentheses stay. |
| `( a and b ) or c` | `a and b or c` | The parentheses are redundant. |
| `(not a) == b` | `not a == b` | `not` binds tighter than a comparison. |
| `not (a == b)` | `not (a == b)` | The parentheses are needed. |
| `(a < b) == c` | `(a < b) == c` | Comparisons do not chain, so a comparison inside a comparison always keeps its parentheses. |

## Notes for the kb-tools schema and validator

These notes record what the engine assumes about a knowledge base, so the `kb-tools` schema and validator can enforce it.

1. The schema accepts the optional `label` string on a fact, matching `FactDef.label`.
2. The validator warns when a fact with `role: deduction` has no unguarded fallback rule. The engine reports `undefined` for such a fact when every guard is false.
3. The `kb-tools` tests fail on any `money` rule that lacks an explicit `round(...)`, so `NON_INTEGER_MONEY` is caught at build time.
4. Every `cite` must name a clause. The engine assumes this and does not check it at run time.

## Diagnostic codes

`pnpm dc validate` and `pnpm dc build` report problems as diagnostics. Each diagnostic has a `severity`, a `code`, the `file`, and a `message`. It may also have an `id` (the rule id, fact name or clause id it is about) and a `field` (`to` or `when` for an expression, or the offending key for a schema problem). There are 23 codes. 21 are errors and 2 are warnings.

- An error means the knowledge base is not valid. `pnpm dc build` writes no output while any error is present.
- A warning does not stop a build. It points at something that is probably a mistake.
- Diagnostics are sorted by their place in the file: top level, goals, facts, rules, clauses. Quoted source text in a message is clipped to 200 characters, with a trailing `…`.

The `id` column says what the `id` of the diagnostic holds. "none" means the diagnostic has no `id`. The example messages show the form of each message. The names and values in them change from file to file.

| Code | Severity | `id` | Example message |
| --- | --- | --- | --- |
| `READ_ERROR` | error | none | `Cannot read 'apps/x/kb/y.yaml': ENOENT (no such file or directory).` |
| `YAML_SYNTAX` | error | none | `YAML syntax error at line 3, column 1: BAD_INDENT: Flow sequence in block collection must be sufficiently indented and end with a ]` |
| `SCHEMA_INVALID` | error | entity id | `The 'cite' of rule 'ROOM-01' is a number. Quote it, for example cite: "4.2".` |
| `PARSE_ERROR` | error | rule id | `Rule 'ROOM-02' field 'to' does not parse (UNEXPECTED_END at position 3): Unexpected end of input Source: '1 +'` |
| `DUPLICATE_FACT` | error | fact name | `Fact 'sum_insured' (line 12, column 3) is defined more than once. The first definition is used.` |
| `DUPLICATE_RULE` | error | rule id | `Rule id 'ROOM-01' is used by more than one rule.` |
| `DUPLICATE_CLAUSE` | error | clause id | `Clause '4.2' (line 40, column 3) is defined more than once. The first definition is used.` |
| `UNKNOWN_FACT` | error | rule id | `Fact 'gold' is not defined — did you mean the enum literal 'gold'? Corrected YAML: "'gold'"` |
| `UNKNOWN_GOAL` | error | goal | `Goal 'payable' is not a fact.` |
| `UNKNOWN_SET_FACT` | error | rule id | `Rule 'ROOM-01' sets 'room_cap', which is not a fact.` |
| `UNKNOWN_CLAUSE` | error | rule id | `Rule 'ROOM-01' cites clause '4.3', which is not in clauses.` |
| `UNKNOWN_PLACEHOLDER` | error | rule id | `The 'because' text of rule 'ROOM-01' uses {rent}, which is not a fact.` |
| `CYCLE` | error | first fact | `Dependency cycle: a -> b -> a.` |
| `GOAL_UNSET` | error | goal | `Goal 'payable' is not set by any rule.` |
| `MISSING_ASK` | error | fact | `Fact 'sum_insured' is not derived and has no 'ask' text.` |
| `ENUM_VALUE_NOT_IN_OPTIONS` | error | rule id | `Rule 'TIER-01' field 'to': 'platinum' is not an option of enum fact 'tier' (options: gold, silver).` |
| `SET_NON_DERIVED` | error | rule id | `Rule 'ROOM-01' sets 'sum_insured', which is not marked derived: true.` |
| `TYPE_MISMATCH` | error | rule id | `Rule 'ROOM-02' field 'when': '==' compares date with enum in 'admit_date == 'gold''.` |
| `NOT_BOOLEAN` | error | rule id | `Rule 'ROOM-03' field 'when' must be boolean but has type number.` |
| `MONEY_NOT_ROUNDED` | error | rule id | `Rule 'ROOM-03' sets money fact 'room_rent_excess' from 'sum_insured * 0.01', which can produce a fraction. Wrap the expression in round(...).` |
| `ROLE_TYPE_MISMATCH` | error | fact name | `Fact 'room_rent_excess' has role 'deduction' but its type is 'number'. A deduction fact must have type money. Change the type or remove the role.` |
| `NO_FALLBACK_RULE` | warning | fact | `Deduction fact 'room_rent_excess' has no rule without a 'when' guard, so the engine reports it as undefined whenever every guard is false. Add an unguarded default rule.` |
| `DEAD_GUARD` | warning | rule id | `Rule 'ROOM-04' has a guard that can never be true: 'rent_over_cap and not rent_over_cap'. The rule never fires.` |

Notes on specific codes:

- `READ_ERROR` has two messages. When the operating system cannot read the file, the message gives the system's reason: `Cannot read 'apps/x/kb/y.yaml': ENOENT (no such file or directory).` When the bytes are not valid UTF-8, the message gives no system reason: `Cannot read 'apps/x/kb/y.yaml': the file is not valid UTF-8.`
- A file larger than 1 MiB is reported as `SCHEMA_INVALID`, with no `id`: `File 'apps/x/kb/y.yaml' is larger than the 1 MiB limit (1048576 bytes).`
- `SCHEMA_INVALID` also covers a missing required field, a field of the wrong type, an unknown field, a value outside an allowed set, and a mapping key that YAML does not read as a string. The `id` is the id of the rule, fact or clause that holds the problem, when there is one.
- `YAML_SYNTAX` also covers a duplicate key outside `facts` and `clauses`. Its `id` is absent and its `field` is the repeated key. A duplicate key inside `facts` or `clauses` is `DUPLICATE_FACT` or `DUPLICATE_CLAUSE`. For all three, the first definition is the one used.
- `UNKNOWN_FACT` adds the hint about an enum literal only when the whole expression is a bare identifier, which is what YAML leaves of a quoted literal (see "Validator note: quoted literals that YAML strips"). In any other expression the message is `Fact 'x' is not defined.`
- `CYCLE` is reported once for each group of facts that depend on each other. The path starts at the alphabetically first fact. A fact that reads itself gets a message of the form `Fact 'a' depends on itself: rule 'R-1' sets it from an expression that reads it.`
- A fact with a `role` that is not derived gets `SCHEMA_INVALID`. When its type is also wrong for the role, it gets both `SCHEMA_INVALID` and `ROLE_TYPE_MISMATCH`, once each, with `ROLE_TYPE_MISMATCH` first. An invalid `role` or `type` value gets only `SCHEMA_INVALID`.
- `PARSE_ERROR` is also used when a number literal is too large to be finite, and when an expression is nested too deeply to parse or to type-check.

## Golden scenarios

A golden scenario is a regression test for a knowledge base. It states the facts given and the verdict the engine must reach. If a rule is misread from its clause, or edited later, a scenario's result changes and `pnpm dc golden` fails.

### Where a golden file lives

A golden file is a YAML file at `apps/<app>/golden/<name>.yaml`. It sits outside `kb/` on purpose: `pnpm dc validate` and `pnpm dc build` read only `apps/<app>/kb/*.yaml`, so they never see a golden file and never report a problem in one.

`pnpm dc golden` runs the scenarios. It compiles each knowledge base in memory, exactly as `pnpm dc build` would, and runs every scenario against the result. It writes no file. With no path it runs every `apps/*/golden/*.yaml`. It also accepts golden files and `apps/<app>` directories, relative to the repository root. The exit status is 0 when there is no error, 1 when there is an error, and 2 for a usage problem (an unknown option such as `--json`, or a path that matches no golden file).

### The file

| Field | Required | What it holds |
| --- | --- | --- |
| `kb` | yes | The `id` of the knowledge base the file runs against. It must name exactly one knowledge base in `apps/<app>/kb/`. |
| `scenarios` | yes | A list of at least one scenario. |

Any other field is an error. A scenario is a mapping with these fields:

| Field | Required | What it holds |
| --- | --- | --- |
| `id` | yes | Letters, digits, `_` and `-`, starting with a letter or a digit. Unique across all the golden files of one app. |
| `title` | yes | Plain words that say what the scenario shows. It is printed when the scenario fails. |
| `mode` | no | `consult` (the default) or `audit`. |
| `facts` | yes | A mapping from fact name to value, possibly empty. Only facts that are not derived. |
| `expect` | yes | What the engine must return. |

`expect` takes one of two forms. The first has a single field, `ask`, and is only for `consult`:

| Form | Fields | Meaning |
| --- | --- | --- |
| Question | `ask: <fact>` | The engine must still be asking, and its next question must be for that fact. `ask` is the only field of `expect`. |
| Verdict | `goals` (required), `line_items`, `needed`, `fires` | The engine must reach a verdict that matches. |

The fields of a verdict:

- `goals` lists every goal of the knowledge base, each with its expected value, or `null` for unknown. A goal left out is an error, so a scenario cannot leave a goal unchecked.
- `line_items` is optional. When present it must match the verdict's line items exactly: the same facts, no more and no fewer, each with its expected value or `null`. Only facts that have a `role` are line items.
- `needed` is only for `audit`. It lists, in order, the facts of the questions still needed. When it is left out, no question may be needed.
- `fires` is optional. It lists rule ids that must have fired. Other rules may have fired too.

### Values

| Fact type | In `facts` and `expect` |
| --- | --- |
| `boolean` | `true` or `false` |
| `number` | A finite number |
| `money` | A whole number of minor units, such as `595000` for 5,950.00. Never a decimal. |
| `date` | `YYYY-MM-DD`, a real day from year 0001 to 9999. YAML reads `2024-01-01` without quotes as a string, which is what is wanted. |
| `enum` | One of the fact's `options` |

`null` means unknown. It is allowed only in `expect.goals` and `expect.line_items`. A `null` in `facts` is a `BAD_VALUE` error: to leave a fact unanswered, leave it out.

### How a scenario runs

A scenario runs on its own, with no state from another scenario.

- A `consult` scenario starts a session, answers each fact in `facts` in the order written, and then asks the engine for its next step. That step is a question or a verdict. The order of the answers does not change the result.
- An `audit` scenario gives all of `facts` to the engine at once and takes the verdict. Facts left out are unknown, and the questions they would need are listed in the verdict's `needed`.

Collected facts, such as those that Pre-Flight reads from GitHub, go in `facts` like any other fact that is not derived.

### What "fires" means, and coverage

A rule fires in a scenario when its id appears as the deciding rule on any node of the proof of a goal or of a line item. A rule whose guard was false, and a rule that was never reached, did not fire.

A rule is covered when at least one passing scenario fires it. `pnpm dc golden` reports each uncovered rule as an error, `RULE_NOT_COVERED`, so that every rule is tested at least once. A scenario that fails or stops with an engine error covers nothing. Coverage and the scenario count are checked only on a run that holds every golden file of the app: a run with no path, or with an `apps/<app>` directory. A run given single golden file paths reports scenario results only.

The build plan asks for at least 12 scenarios per knowledge base. With fewer, `pnpm dc golden` prints a warning, `TOO_FEW_SCENARIOS`, which does not change the exit status.

### Example

This knowledge base applies a room-rent limit of 1% of the sum insured:

```yaml
id: claim-check
currency: INR
goals: [room_rent_excess]

facts:
  room_rent_per_day:
    type: money
    ask: What was the room rent per day?
  sum_insured: { type: money, ask: What is the sum insured on the policy? }
  room_rent_cap: { type: money, derived: true }
  room_rent_excess:
    type: money
    derived: true
    role: deduction
    label: Room rent over the limit

rules:
  - id: ROOM-01
    cite: "4.2"
    set: room_rent_cap
    to: round(sum_insured * 0.01)
    because: The room rent limit is 1% of the sum insured per day.
  - id: ROOM-02
    cite: "4.2"
    set: room_rent_excess
    when: room_rent_per_day > room_rent_cap
    to: room_rent_per_day - room_rent_cap
    because: The part of the rent above the limit, {room_rent_cap}, is not covered.
  - id: ROOM-03
    cite: "4.2"
    set: room_rent_excess
    to: 0
    because: Rent within the limit has no deduction.

clauses:
  "4.2":
    title: Room rent limit
    text: Room rent is covered up to 1% of the sum insured per day.
```

And this golden file, at `apps/claim-check/golden/room-rent.yaml`, runs it four ways: a consult run that reaches a verdict, an audit run, a consult run that stops at a question, and an audit run with an unknown goal:

```yaml
kb: claim-check
scenarios:
  - id: G-01
    title: Room rent over the limit
    facts:
      sum_insured: 500000
      room_rent_per_day: 600000
    expect:
      goals:
        room_rent_excess: 595000
      line_items:
        room_rent_excess: 595000
      fires: [ROOM-01, ROOM-02]

  - id: G-02
    title: Room rent within the limit
    mode: audit
    facts:
      sum_insured: 500000
      room_rent_per_day: 4000
    expect:
      goals:
        room_rent_excess: 0
      fires: [ROOM-03]

  - id: G-03
    title: Nothing answered yet, so the first question
    facts: {}
    expect:
      ask: room_rent_per_day

  - id: G-04
    title: Only the rent is known
    mode: audit
    facts:
      room_rent_per_day: 600000
    expect:
      goals:
        room_rent_excess: null
      needed: [sum_insured]
```

Run on its own, this file passes all four scenarios, covers `ROOM-01`, `ROOM-02` and `ROOM-03`, and gives one warning: it has 4 scenarios, not 12.

### The summary line

Every `pnpm dc golden` run ends with one line of this form, and a clean run prints nothing else:

```text
<F> files, <S> scenarios run, <P> passed, <C> of <R> rules covered, <E> errors, <W> warnings
```

`<C> of <R>` counts the rules of the knowledge bases whose coverage was checked. It reads `0 of 0` when the run was given single files or had no golden file. A run with nothing to do prints `0 files, 0 scenarios run, 0 passed, 0 of 0 rules covered, 0 errors, 0 warnings` and exits 0.

### Golden codes

`pnpm dc golden` prints each problem as `<file>: <severity> <code> [<id>] <message>`, with `[<id>]` only when the problem has an id. Lines are sorted by app, then by golden file path and the position of the scenario in the file, then by code. The lines about rule coverage come last and name the knowledge-base file. The messages below show the form. The names and values in them change from case to case.

| Code | Severity | `id` | Example message |
| --- | --- | --- | --- |
| `READ_ERROR` | error | none | `Cannot read 'apps/x/golden/y.yaml': ENOENT (no such file or directory).` |
| `YAML_SYNTAX` | error | none | `YAML syntax error at line 3, column 1: BAD_INDENT: Flow sequence in block collection must be sufficiently indented and end with a ]` |
| `SCHEMA_INVALID` | error | scenario id | `Unknown field 'colour' in scenario 'G-01'. Allowed fields: id, title, mode, facts, expect.` |
| `UNKNOWN_FACT` | error | scenario id | `Fact 'nope' is not in the knowledge base 'claim-check'.` |
| `KB_NOT_FOUND` | error | none | `No knowledge base with id 'claim-check' in apps/claim-check/kb.` |
| `KB_AMBIGUOUS` | error | none | `More than one knowledge base in apps/claim-check/kb has id 'claim-check': a.yaml, b.yaml.` |
| `KB_INVALID` | error | none | `The knowledge base 'apps/claim-check/kb/policy.yaml' has errors. Run dc validate first.` |
| `DUPLICATE_SCENARIO` | error | scenario id | `Scenario id 'G-01' is already used by scenario 1 of apps/claim-check/golden/a.yaml.` |
| `NOT_ASKABLE` | error | scenario id | `Fact 'room_rent_cap' is worked out by rules, so a scenario cannot give it. Give the facts it depends on.` |
| `BAD_VALUE` | error | scenario id | `Value 1.5 for fact 'sum_insured' is not a whole number of minor units.` |
| `UNKNOWN_RULE` | error | scenario id | `Rule 'R-9' is not in the knowledge base.` |
| `SCENARIO_FAILED` | error | scenario id | `Scenario 'G-01' (Room rent over the limit) failed: goals.room_rent_excess expected 595000, observed 0` |
| `ENGINE_ERROR` | error | scenario id | `Scenario 'G-01' (Room rent over the limit) stopped: the engine threw INVALID_ANSWER: Value for fact "age" is not a valid number.` |
| `RULE_NOT_COVERED` | error | rule id | `No passing scenario fires rule 'ROOM-03'.` |
| `TOO_FEW_SCENARIOS` | warning | none | `Knowledge base 'claim-check' has 4 scenarios; the build plan asks for at least 12.` |

Notes on specific codes:

- `READ_ERROR`, `YAML_SYNTAX` and `SCHEMA_INVALID` mean what they mean for a knowledge base. A golden file larger than 1 MiB is `SCHEMA_INVALID`, and a file that is not valid UTF-8 is `READ_ERROR`. `SCHEMA_INVALID` also reports a missing, extra or misspelled field, a wrong type, and an `expect.goals` that does not list exactly the goals of the knowledge base (`expect.goals must list exactly the goals of the knowledge base. Missing: a. Not a goal: b.`).
- `UNKNOWN_FACT` also covers a name in `expect.goals`, `expect.line_items`, `expect.ask` or `expect.needed` that is not a fact, and a line-item name that has no `role`. `NOT_ASKABLE` covers a derived fact given in `facts`, or named in `ask` or `needed`.
- A scenario with a `UNKNOWN_FACT`, `NOT_ASKABLE`, `BAD_VALUE`, `UNKNOWN_RULE`, `DUPLICATE_SCENARIO` or fit-time `SCHEMA_INVALID` error is not run. The other scenarios of the file still run.
- `KB_NOT_FOUND`, `KB_AMBIGUOUS` and `KB_INVALID` stop the whole file: none of its scenarios run.
- `SCENARIO_FAILED` lists each difference as `<field> expected <x>, observed <y>`, joined by `; `. The fields are `outcome` (a verdict was expected and a question came, or the reverse), `ask`, `goals.<name>`, `line_items.<name>`, `needed` and `fires`, in that order. A line item that is missing or extra reads `no such line item`. An unknown value reads `unknown`.
- `RULE_NOT_COVERED` and `TOO_FEW_SCENARIOS` name the knowledge-base file and not the golden file.
