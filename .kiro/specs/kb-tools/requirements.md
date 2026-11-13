# Requirements Document

## Introduction

The kb-tools component is the knowledge-base toolchain of Dead Certain. It lives in `packages/kb-tools` (package `@dead-certain/kb-tools`). It reads the YAML knowledge bases at `apps/<app>/kb/*.yaml`, checks them, and compiles them to the `KnowledgeBase` JSON type declared in `packages/engine/src/types.ts`. The file format is defined in `docs/kb-format.md`. The `dc` command exposes the toolchain as `pnpm dc validate` and `pnpm dc build`.

The component covers five capabilities:

- **Load**: read a YAML file and check its shape with Zod.
- **Parse**: turn every `to` and `when` string into an `Expr` with the engine's `parse` function.
- **Check**: run the static checks (references, ids, clauses, placeholders, cycles, goals, questions, enums, derived facts), a static type check of every expression, the money-rounding check, and two warnings.
- **Compile**: produce a deterministic `KnowledgeBase` JSON value that the engine accepts.
- **Command**: run those steps from the `dc` command, with stable error codes and exit codes.

Boundary rules that shape every requirement:

- kb-tools uses the engine's types and its `parse` and `print` functions. It does not redefine any engine type.
- The engine keeps zero runtime dependencies. kb-tools may depend on `zod` and `yaml`, pinned to exact versions, and on `@dead-certain/engine`. Any other dependency needs the human's approval first.
- A validation problem is a returned diagnostic, not a thrown exception.
- This spec does not edit root configuration. The root `dc` script is a handoff note to the Claude Code lane (Requirement 16).

Each static check has a stable error code. A diagnostic carries the code, the file, and the rule or fact id where one applies. The codes are listed in the Glossary under Diagnostic_Code.

---

## Glossary

- **KB_Tools**: The package `@dead-certain/kb-tools` in `packages/kb-tools`.
- **Loader**: The part of KB_Tools that reads YAML text and returns a Raw_KB or diagnostics.
- **Schema**: The Zod definition of the YAML shape in `docs/kb-format.md`.
- **Validator**: The part of KB_Tools that runs the Schema check, the parse step and the static checks, and returns diagnostics.
- **Compiler**: The part of KB_Tools that turns a valid Raw_KB into a `KnowledgeBase` and serialises it to Compiled_JSON.
- **Dc_Command**: The `dc` command-line program with the subcommands `validate` and `build`.
- **Engine**: The package `@dead-certain/engine`.
- **Knowledge_Base**: A compiled `KnowledgeBase` value as declared in the Engine's `types.ts`.
- **Raw_KB**: The parsed YAML of one knowledge-base file, before expressions are parsed.
- **KB_File**: One file matching `apps/<app>/kb/*.yaml`. Each KB_File holds exactly one knowledge base.
- **Compiled_JSON**: The text that the Compiler writes for one KB_File: the `KnowledgeBase` as JSON with a fixed key order, 2-space indentation and one trailing line feed.
- **Diagnostic**: A record with a `severity` (`error` or `warning`), a `code`, a `file`, a `message`, and, where one applies, an `id` (a rule id or fact id) and a `field` (such as `to` or `when`).
- **Diagnostic_Code**: A stable upper-case name for one kind of Diagnostic. The error codes are `READ_ERROR`, `YAML_SYNTAX`, `SCHEMA_INVALID`, `PARSE_ERROR`, `DUPLICATE_FACT`, `DUPLICATE_RULE`, `DUPLICATE_CLAUSE`, `UNKNOWN_FACT`, `UNKNOWN_GOAL`, `UNKNOWN_SET_FACT`, `UNKNOWN_CLAUSE`, `UNKNOWN_PLACEHOLDER`, `CYCLE`, `GOAL_UNSET`, `MISSING_ASK`, `ENUM_VALUE_NOT_IN_OPTIONS`, `SET_NON_DERIVED`, `TYPE_MISMATCH`, `NOT_BOOLEAN` and `MONEY_NOT_ROUNDED`. The warning codes are `NO_FALLBACK_RULE` and `DEAD_GUARD`.
- **Error_Diagnostic**: A Diagnostic with severity `error`.
- **Warning_Diagnostic**: A Diagnostic with severity `warning`.
- **Fact_Reference**: A `fact` node in an `Expr`, or a `{name}` placeholder in a `because` sentence.
- **Placeholder**: A `{name}` token in a `because` string, where `name` follows the fact-name syntax of `docs/kb-format.md`.
- **Static_Type**: One of `boolean`, `number`, `date` or `enum`, computed for an expression without running it. A `money` fact has the Static_Type `number` and is also tracked as money (see Requirement 11).
- **Quoted_Literal_Hint**: The text `did you mean the enum literal '<name>'?` that follows an unknown-fact message when the expression is a single bare identifier.
- **Money_Rule**: A rule whose `set` names a fact of type `money`.
- **Rounded_Money_Expression**: An expression that is whole minor units by construction, as defined in Requirement 12.
- **Deduction_Fact**: A fact with `role: deduction`.
- **Unguarded_Rule**: A rule with no `when` field.
- **Dead_Guard**: A `when` expression that can never be true, detected by the cheap patterns in Requirement 14.
- **Derived_Fact**: A fact with `derived: true`.
- **Askable_Fact**: A fact without `derived: true`.
- **Dependency_Graph**: The directed graph with an edge from each Derived_Fact to every fact referenced in the `to` or `when` of a rule that sets it.
- **KB_Shape_Error**: An `EngineError` with code `INVALID_KB` or `CYCLE`, thrown by the Engine's `start` function.
- **Dead_Certain**: The product this component belongs to.

---

## Requirements

### Requirement 1: Package and dependencies

**User Story:** As a maintainer, I want kb-tools to be a small, pinned package that builds on the engine, so that the toolchain stays reproducible and the engine stays dependency-free.

#### Acceptance Criteria

1. THE KB_Tools package SHALL be named `@dead-certain/kb-tools` and SHALL live in `packages/kb-tools`.
2. THE KB_Tools package SHALL declare `zod` at exactly 4.6.7 and `yaml` at exactly 2.9.1 under `dependencies`, each with no range operator.
3. THE KB_Tools package SHALL declare `@dead-certain/engine` as a workspace dependency.
4. THE KB_Tools package SHALL declare `fast-check` and `vite` at exactly 8.3.8 under `devDependencies`, SHALL run its tests with the root `vitest` as `packages/engine` does, SHALL declare no second copy of `vitest`, and SHALL declare no other dependency without the human's prior approval.
5. THE Engine SHALL keep zero entries under `dependencies` in `packages/engine/package.json` after this spec is implemented.
6. THE KB_Tools package SHALL import `KnowledgeBase`, `FactDef`, `Rule`, `Clause`, `Expr` and every other shared type from `@dead-certain/engine` and SHALL declare none of them again.
7. THE KB_Tools package SHALL expose a `bin` entry named `dc` that starts the Dc_Command from the Vite-bundled file `dist/dc.mjs`.
8. THE KB_Tools package SHALL make no network call.

### Requirement 2: Loading YAML

**User Story:** As a knowledge engineer, I want a knowledge-base file read safely, so that a broken file produces a clear message instead of a crash.

#### Acceptance Criteria

1. WHEN the Loader receives YAML text, THE Loader SHALL parse it with the `yaml` package and return a Raw_KB.
2. IF the YAML text is not well-formed YAML, THEN THE Loader SHALL return an Error_Diagnostic with code `YAML_SYNTAX` whose message includes the line and column that the `yaml` package reports.
3. IF a YAML mapping repeats a key, THEN THE Loader SHALL return an Error_Diagnostic for each repeated key: `DUPLICATE_FACT` when the mapping is `facts`, `DUPLICATE_CLAUSE` when the mapping is `clauses`, and `YAML_SYNTAX` for any other mapping.
4. IF the document is empty, or its top-level value is not a mapping, THEN THE Loader SHALL return an Error_Diagnostic with code `SCHEMA_INVALID`.
5. THE Loader SHALL treat the keys `__proto__`, `constructor` and `prototype` as ordinary names and SHALL leave the prototype of every object it builds unchanged.
6. WHEN the Loader reads a KB_File, THE Loader SHALL decode the file as UTF-8.
7. IF a KB_File cannot be read, THEN THE Loader SHALL return an Error_Diagnostic with code `READ_ERROR` that names the file and the operating-system reason, and SHALL not throw.
8. IF a KB_File is read but its bytes are not valid UTF-8, THEN THE Loader SHALL return an Error_Diagnostic with code `READ_ERROR` that names the file and whose message states that the file is not valid UTF-8 instead of giving an operating-system reason, and SHALL not throw.
9. THE Loader SHALL not use the code `YAML_SYNTAX` for a KB_File that cannot be read or is not valid UTF-8.

### Requirement 3: Schema validation with Zod

**User Story:** As a knowledge engineer, I want the YAML shape checked against the documented format, so that a misspelled field is caught before it reaches the engine.

#### Acceptance Criteria

1. THE Schema SHALL require the top-level fields `id`, `goals`, `facts`, `rules` and `clauses`, and SHALL accept the optional field `currency`, as documented in `docs/kb-format.md`.
2. THE Schema SHALL accept for each fact the properties `type`, `ask`, `why`, `derived`, `options`, `role` and `label`, where `type` is one of `boolean`, `number`, `money`, `date` and `enum`, and `role` is `deduction` or `check`.
3. THE Schema SHALL require for each rule the string fields `id`, `cite`, `set` and `because`, and the field `to`, and SHALL accept the optional field `when`.
4. THE Schema SHALL require for each clause the string fields `title` and `text`.
5. WHEN a value is present where the Schema requires a string, THE Schema SHALL accept only a value of YAML type string.
6. IF a `cite` value or a clause key is read by YAML as a number or another non-string type, such as the unquoted `4.2`, THEN THE Validator SHALL return an Error_Diagnostic with code `SCHEMA_INVALID` whose message tells the author to quote the value.
7. IF a top-level field, fact property, rule field or clause field is not listed in `docs/kb-format.md`, THEN THE Validator SHALL return an Error_Diagnostic with code `SCHEMA_INVALID` that names the field.
8. IF a fact has `type: enum` and no non-empty `options` list, THEN THE Validator SHALL return an Error_Diagnostic with code `SCHEMA_INVALID` that names the fact.
9. IF a fact has `options` and its type is not `enum`, or its `options` list repeats a value, THEN THE Validator SHALL return an Error_Diagnostic with code `SCHEMA_INVALID` that names the fact.
10. IF a `currency` value is present and is not three upper-case ASCII letters, THEN THE Validator SHALL return an Error_Diagnostic with code `SCHEMA_INVALID`.
11. THE Validator SHALL report every Schema violation it finds in one KB_File in one run, and SHALL not stop at the first.
12. THE Validator SHALL set the `file` of every Diagnostic and, for a Schema violation inside a fact, rule or clause, the `id` of that fact, rule or clause where the id is a string.

### Requirement 4: Parsing expressions

**User Story:** As a knowledge engineer, I want every `to` and `when` parsed with the engine's own parser, so that the tools and the engine agree on what an expression means.

#### Acceptance Criteria

1. WHEN the Validator reads a rule, THE Validator SHALL parse the `to` string and, if present, the `when` string with the Engine's `parse` function.
2. IF `parse` returns an error, THEN THE Validator SHALL return an Error_Diagnostic with code `PARSE_ERROR` that names the rule id, the field (`to` or `when`), the parse error code and the position, and that includes the parse error message.
3. THE Validator SHALL parse each expression exactly as the string that the YAML library returns, with no change to its quotes or whitespace.
4. THE Validator SHALL not call the Engine's `evaluate` function.
5. WHEN a `to` or `when` value is a YAML boolean or number rather than a string, such as `when: true`, THE Validator SHALL parse the value as its canonical text (`true`, `false` or the decimal digits) and SHALL not report it as `SCHEMA_INVALID`.
6. THE Compiler SHALL store each parsed expression exactly as `parse` returned it, with no rewriting.

### Requirement 5: Reference, id and clause checks

**User Story:** As a knowledge engineer, I want broken references and duplicate ids reported with the offending file and id, so that I can fix them quickly.

#### Acceptance Criteria

1. IF a Fact_Reference in a `to` or `when` expression names a fact that is not in `facts`, THEN THE Validator SHALL return an Error_Diagnostic with code `UNKNOWN_FACT` that names the rule id, the field and the unknown name.
2. IF two or more rules share an `id`, THEN THE Validator SHALL return one Error_Diagnostic with code `DUPLICATE_RULE` for each rule after the first, naming the id.
3. IF two or more facts share a name, THEN THE Validator SHALL return an Error_Diagnostic with code `DUPLICATE_FACT` naming the fact.
4. IF two or more clauses share an id, THEN THE Validator SHALL return an Error_Diagnostic with code `DUPLICATE_CLAUSE` naming the clause.
5. IF a name in `goals` is not a fact, THEN THE Validator SHALL return an Error_Diagnostic with code `UNKNOWN_GOAL` naming the goal.
6. IF the `set` of a rule is not a fact, THEN THE Validator SHALL return an Error_Diagnostic with code `UNKNOWN_SET_FACT` naming the rule id and the name.
7. IF the `cite` of a rule is not a key of `clauses`, THEN THE Validator SHALL return an Error_Diagnostic with code `UNKNOWN_CLAUSE` naming the rule id and the cited value.
8. IF a Placeholder in the `because` of a rule names a fact that is not in `facts`, THEN THE Validator SHALL return an Error_Diagnostic with code `UNKNOWN_PLACEHOLDER` naming the rule id and the placeholder name.
9. THE Validator SHALL look up every fact name, clause id and rule id with an own-property check, so that names such as `toString` and `__proto__` are not found by prototype lookup.
10. WHEN a name check fails, THE Validator SHALL include the file path in the Diagnostic.

### Requirement 6: Quoted literals that YAML strips

**User Story:** As a knowledge engineer, I want a clear message when YAML has removed the quotes from an enum literal, so that I can see the real mistake instead of an "unknown fact" riddle.

#### Acceptance Criteria

1. IF a `to` or `when` expression is a single bare identifier that names no fact, THEN THE Validator SHALL return an Error_Diagnostic with code `UNKNOWN_FACT` whose message is `Fact '<name>' is not defined — did you mean the enum literal '<name>'?`.
2. WHERE the unknown bare identifier is the whole expression, THE Validator SHALL append to the message the corrected YAML, `"'<name>'"`, so that the author can copy it.
3. IF an unknown identifier is part of a larger expression, THEN THE Validator SHALL return the plain `UNKNOWN_FACT` message without the Quoted_Literal_Hint.
4. WHEN a bare identifier names a defined fact, THE Validator SHALL accept the expression and SHALL not report the Quoted_Literal_Hint.

### Requirement 7: Goals, questions and derived facts

**User Story:** As a knowledge engineer, I want goals that nothing sets, questions with no text, and rules that overwrite user answers reported, so that the engine never meets a knowledge base it cannot decide.

#### Acceptance Criteria

1. IF no rule has a `set` equal to a goal, THEN THE Validator SHALL return an Error_Diagnostic with code `GOAL_UNSET` naming the goal.
2. IF an Askable_Fact has no `ask` text, THEN THE Validator SHALL return an Error_Diagnostic with code `MISSING_ASK` naming the fact.
3. IF a rule's `set` names a fact that is not a Derived_Fact, THEN THE Validator SHALL return an Error_Diagnostic with code `SET_NON_DERIVED` naming the rule id and the fact.
4. IF a Derived_Fact has `ask` text, THEN THE Validator SHALL accept the knowledge base without a Diagnostic for that text.
5. IF a `role` is present on a fact that is not a Derived_Fact, THEN THE Validator SHALL return an Error_Diagnostic with code `SCHEMA_INVALID` naming the fact, because the Engine lists only derived facts as line items.

### Requirement 8: Cycles between derived facts

**User Story:** As a knowledge engineer, I want dependency cycles found at build time, so that the engine does not reject the knowledge base at run time.

#### Acceptance Criteria

1. THE Validator SHALL build the Dependency_Graph from the parsed rules, adding an edge from the `set` fact of each rule to each fact referenced in its `to` and `when`.
2. IF the Dependency_Graph contains a cycle, THEN THE Validator SHALL return one Error_Diagnostic with code `CYCLE` that lists the facts on the cycle in order, starting from the alphabetically first fact name on the cycle.
3. IF a rule sets a fact that its own `to` or `when` references, THEN THE Validator SHALL return a `CYCLE` Error_Diagnostic that names that fact.
4. THE Validator SHALL return the same `CYCLE` Diagnostic for a given set of rules regardless of the order of the rules in the file.
5. THE Validator SHALL run the cycle check only over rules whose `set`, `to` and `when` passed their reference checks, so that one mistake does not produce a second, misleading Diagnostic.
6. WHEN the Dependency_Graph is acyclic, THE Validator SHALL return no `CYCLE` Diagnostic.

### Requirement 9: Enum values

**User Story:** As a knowledge engineer, I want enum values checked against the fact's options, so that a typo in a literal is caught before it silently makes a rule never fire.

#### Acceptance Criteria

1. IF an enum literal in a `to` expression can become the value of the rule's `set` fact, and the set fact is an enum, and the literal is not in that fact's `options`, THEN THE Validator SHALL return an Error_Diagnostic with code `ENUM_VALUE_NOT_IN_OPTIONS` naming the rule id, the literal and the fact.
2. IF an enum literal is compared with `==` or `!=` to an enum fact and the literal is not in that fact's `options`, THEN THE Validator SHALL return an Error_Diagnostic with code `ENUM_VALUE_NOT_IN_OPTIONS` naming the rule id, the field, the literal and the fact.
3. THE Validator SHALL treat the branches of `if(...)` as places where an enum literal can become the value, and SHALL not treat the condition of `if(...)` as one.
4. WHEN every enum literal that meets criteria 1 and 2 is in the relevant `options`, THE Validator SHALL return no `ENUM_VALUE_NOT_IN_OPTIONS` Diagnostic.

### Requirement 10: Static type checking of expressions

**User Story:** As a knowledge engineer, I want type mistakes found before run time, so that a rule never fails with a type error in front of a user.

#### Acceptance Criteria

1. THE Validator SHALL compute a Static_Type for every sub-expression of every `to` and `when`: a literal has the type of its literal, a Fact_Reference has the type of the referenced fact (with `money` counted as `number`), and a call or operator has the result type given in `docs/kb-format.md`.
2. IF an arithmetic operator (`+`, `-`, `*`, `/`) or the unary `-` has an operand whose Static_Type is not `number`, THEN THE Validator SHALL return an Error_Diagnostic with code `TYPE_MISMATCH` naming the rule id, the field and the printed sub-expression.
3. IF `==` or `!=` compares two operands whose Static_Types differ, such as a date and an enum, THEN THE Validator SHALL return an Error_Diagnostic with code `TYPE_MISMATCH`.
4. IF `<`, `<=`, `>` or `>=` has an operand whose Static_Type is not `number` or `date`, or the two operands have different Static_Types, THEN THE Validator SHALL return an Error_Diagnostic with code `TYPE_MISMATCH`.
5. IF `and`, `or` or `not` has an operand whose Static_Type is not `boolean`, THEN THE Validator SHALL return an Error_Diagnostic with code `TYPE_MISMATCH`.
6. IF `min`, `max` or `round` has an argument whose Static_Type is not `number`, or `days_between` has an argument whose Static_Type is not `date`, THEN THE Validator SHALL return an Error_Diagnostic with code `TYPE_MISMATCH`.
7. IF the condition of `if(...)` does not have Static_Type `boolean`, or its two branches have different Static_Types, THEN THE Validator SHALL return an Error_Diagnostic with code `TYPE_MISMATCH`.
8. IF the Static_Type of a `to` expression does not match the type of the `set` fact, THEN THE Validator SHALL return an Error_Diagnostic with code `TYPE_MISMATCH` naming the rule id, the fact, the expected type and the found type. A `money` or `number` fact accepts a `number` expression; a `boolean`, `date` or `enum` fact accepts only its own type.
9. IF a `number` expression is assigned to a `date` fact, THEN THE Validator SHALL return an Error_Diagnostic with code `TYPE_MISMATCH`.
10. IF the Static_Type of a `when` expression is not `boolean`, THEN THE Validator SHALL return an Error_Diagnostic with code `NOT_BOOLEAN` naming the rule id and the found type.
11. IF a sub-expression already has a `TYPE_MISMATCH` or `UNKNOWN_FACT` Diagnostic, THEN THE Validator SHALL treat the type of that sub-expression as unknown and SHALL not report further type Diagnostics that depend only on it.
12. WHEN every `to` and `when` in a knowledge base passes criteria 1 to 11, THE Validator SHALL return no `TYPE_MISMATCH` and no `NOT_BOOLEAN` Diagnostic.

### Requirement 11: Money type

**User Story:** As a knowledge engineer, I want money typed as a number that is whole minor units, so that arithmetic on money is allowed and the result is checked where it matters.

#### Acceptance Criteria

1. THE Validator SHALL accept a `money` fact wherever a `number` is accepted, and a `number` expression as the `to` of a `money` fact, subject to Requirement 12.
2. THE Validator SHALL accept a `money` or `number` fact, or an expression of Static_Type `number`, as an operand of `==`, `!=`, `<`, `<=`, `>` and `>=` against a `money` or `number` operand.
3. THE Validator SHALL not accept a `money` expression as the `to` of a `date`, `boolean` or `enum` fact.

### Requirement 12: Money rules need an explicit round

**User Story:** As a knowledge engineer, I want any money rule that could produce a fraction rejected at build time, so that the engine never throws `NON_INTEGER_MONEY` in front of a user.

#### Acceptance Criteria

1. THE Validator SHALL classify an expression as a Rounded_Money_Expression when it is one of: a call to `round`; an integer number literal; a reference to a `money` fact; a call to `min` or `max` whose two arguments are both Rounded_Money_Expressions; a call to `if` whose two branches are both Rounded_Money_Expressions; `a + b` or `a - b` where both operands are Rounded_Money_Expressions; unary `-` applied to a Rounded_Money_Expression; or `a * b` where one operand is a Rounded_Money_Expression and the other is an integer number literal. Division, and multiplication by an operand that is not an integer number literal, are not Rounded_Money_Expressions and need `round(...)`.
2. IF the `to` of a Money_Rule is not a Rounded_Money_Expression, THEN THE Validator SHALL return an Error_Diagnostic with code `MONEY_NOT_ROUNDED` naming all three of the rule id, the fact and the printed `to` expression. A `MONEY_NOT_ROUNDED` Diagnostic that omits the rule id, the fact or the printed `to` expression does not satisfy this criterion.
3. THE `MONEY_NOT_ROUNDED` message SHALL tell the author to wrap the expression in `round(...)`.
4. WHEN the `to` of a Money_Rule is a Rounded_Money_Expression, THE Validator SHALL return no `MONEY_NOT_ROUNDED` Diagnostic for that rule.
5. THE KB_Tools test suite SHALL include a test that runs the Validator over every `apps/*/kb/*.yaml` file in the repository and fails when any `MONEY_NOT_ROUNDED` Diagnostic appears.

### Requirement 13: Deduction facts need a fallback

**User Story:** As a knowledge engineer, I want a warning when a deduction fact can end up with no value, so that I add a default rule.

#### Acceptance Criteria

1. IF a Deduction_Fact has no Unguarded_Rule that sets it, THEN THE Validator SHALL return a Warning_Diagnostic with code `NO_FALLBACK_RULE` naming the fact and explaining that the Engine reports `undefined` for the fact when every guard is false.
2. WHEN a Deduction_Fact has at least one Unguarded_Rule that sets it, THE Validator SHALL return no `NO_FALLBACK_RULE` Diagnostic for that fact.
3. THE Validator SHALL not apply criterion 1 to a fact whose `role` is `check` or absent.
4. THE Validator SHALL report `NO_FALLBACK_RULE` with severity `warning` and SHALL not count it toward a failing exit code.

### Requirement 14: Guards that can never be true

**User Story:** As a knowledge engineer, I want an obviously dead rule flagged, so that I do not ship a rule that can never fire.

#### Acceptance Criteria

1. IF the `when` of a rule is the literal `false`, THEN THE Validator SHALL return a Warning_Diagnostic with code `DEAD_GUARD` naming the rule id.
2. IF the `when` of a rule is `x and not x`, or `not x and x`, where `x` is any expression and both occurrences are structurally equal, THEN THE Validator SHALL return a Warning_Diagnostic with code `DEAD_GUARD` naming the rule id.
3. IF the `when` of a rule is an `and` whose left or right operand is itself a Dead_Guard under criteria 1, 2 or this criterion, THEN THE Validator SHALL return a Warning_Diagnostic with code `DEAD_GUARD`. This check is recursive through nested `and` nodes at any depth, so that `(x and not x) and y and z` and `a and b and c` with any dead operand are flagged. One dead operand makes the whole `and` chain dead, so the recursion cannot produce a false warning.
4. THE Validator SHALL compare expressions for criterion 2 by structural equality of the parsed `Expr` values.
5. THE Validator SHALL report `DEAD_GUARD` with severity `warning` and SHALL not count it toward a failing exit code.
6. THE Validator SHALL not report `DEAD_GUARD` for a guard that is not matched by criteria 1 to 3, and SHALL not claim to detect every unsatisfiable guard.

### Requirement 15: Compiling to KnowledgeBase JSON

**User Story:** As an app developer, I want a compiled JSON file that the engine accepts as is, so that the apps load it without further checks.

#### Acceptance Criteria

1. WHEN a Raw_KB has no Error_Diagnostic, THE Compiler SHALL produce a `KnowledgeBase` value whose `id`, `currency`, `goals`, `facts`, `rules` and `clauses` follow the YAML.
2. THE Compiler SHALL set the `id` of each compiled `Clause` to its key in `clauses`.
3. THE Compiler SHALL keep the rules in file order and the goals in file order.
4. THE Compiler SHALL copy `ask`, `why`, `derived`, `options`, `role` and `label` onto a compiled fact only where the YAML supplies them, and SHALL not add a `label` of its own.
5. THE Compiler SHALL omit `currency` and `when` from the output when the YAML omits them.
6. THE Compiler SHALL write Compiled_JSON with object keys in a fixed order that depends only on the field names, with 2-space indentation, and with one trailing line feed.
7. THE Compiler SHALL include no timestamp, absolute path, version stamp or other value that depends on the machine or the time of the run.
8. IF a number in a compiled expression is not finite, THEN THE Compiler SHALL not produce output and SHALL return an Error_Diagnostic with code `PARSE_ERROR` naming the rule.
9. FOR ALL valid knowledge bases, compiling the same YAML text twice SHALL produce byte-identical Compiled_JSON.
10. FOR ALL valid knowledge bases, `JSON.parse` of the Compiled_JSON SHALL be deep-equal to the `KnowledgeBase` the Compiler produced (round-trip property).
11. FOR ALL compiled expressions, parsing the Engine's `print` of the expression SHALL produce a value equal to the expression (round-trip property of the printer over compiled output).
12. THE Compiler SHALL return a result that distinguishes success (a `KnowledgeBase` and its Compiled_JSON) from failure (the Diagnostics), and SHALL not return a partial knowledge base on failure.

### Requirement 16: The `dc` command

**User Story:** As a knowledge engineer and as a CI job, I want one command that checks and builds the knowledge bases, so that hooks, agents and CI run the same gate.

#### Acceptance Criteria

1. WHEN the user runs `dc validate` with no path argument, THE Dc_Command SHALL validate every KB_File under `apps/*/kb/` relative to the repository root.
2. WHERE the user passes one or more KB_File paths or `apps/<app>` directories, THE Dc_Command SHALL validate only those files.
3. WHEN the user runs `dc build`, THE Dc_Command SHALL validate the same set of files, and for each file with no Error_Diagnostic SHALL write its Compiled_JSON to `apps/<app>/kb/dist/<file-stem>.json`, creating the directory when needed.
4. IF any KB_File has an Error_Diagnostic, THEN THE Dc_Command SHALL write no Compiled_JSON for any file in that run.
5. WHEN `dc validate` or `dc build` finishes with zero Error_Diagnostics, THE Dc_Command SHALL exit with status 0, even when Warning_Diagnostics exist.
6. IF one or more Error_Diagnostics exist, including a `READ_ERROR`, THEN THE Dc_Command SHALL exit with a non-zero status of 1.
7. WHEN the user runs `dc validate` or `dc build` with no path argument and no KB_File is found, THE Dc_Command SHALL print the summary line with 0 files checked, 0 errors and 0 warnings, and exit with status 0.
8. THE Dc_Command SHALL print each Diagnostic on its own line in the form `<file>: <severity> <code> [<id>] <message>`, where `[<id>]` appears only when the Diagnostic has an id.
9. THE Dc_Command SHALL print the Diagnostics in an order that depends only on the content of the files: sorted by file path, then by the order of the rules, facts and clauses in the file, then by code.
10. THE Dc_Command SHALL end a run by printing a one-line summary with the number of files checked, errors and warnings.
11. WHEN `dc build` is run twice on unchanged input, THE Dc_Command SHALL leave every output file byte-identical.
12. THE Dc_Command SHALL contain no network call and SHALL write only inside `apps/<app>/kb/dist/`.
13. THE KB_Tools package SHALL export the Loader, Validator and Compiler as functions that take YAML text and a file name and return a result, so that tests and the MCP server can call them without the command line.
14. IF the command is unknown, an argument is malformed, or an explicitly passed path matches no KB_File, THEN THE Dc_Command SHALL print a usage message to standard error and exit with status 2.

### Requirement 17: Totality and the engine contract

**User Story:** As a maintainer, I want the validator to be total and trustworthy, so that a passing knowledge base is one the engine accepts.

#### Acceptance Criteria

1. FOR ALL strings and all values that the `yaml` package can parse, THE Validator SHALL return a result and SHALL not throw.
2. FOR ALL arbitrary Raw_KB values, including values with wrong types, missing fields, null, arrays in place of objects, very long strings and deeply nested values, THE Validator SHALL return at least one Error_Diagnostic or a valid result and SHALL not throw.
3. FOR ALL knowledge bases that pass validation with zero Error_Diagnostics, THE Engine's `start` function SHALL not throw a KB_Shape_Error on the compiled `KnowledgeBase`.
4. FOR ALL knowledge bases that pass validation and all assignments of type-valid answers to Askable_Facts, THE Engine's `audit` function SHALL not throw `NON_INTEGER_MONEY`, `INVALID_KB` or `CYCLE`.
5. FOR ALL knowledge bases that pass validation, THE Engine's `next` function called on `start` of the compiled knowledge base SHALL not throw a KB_Shape_Error.
6. THE Validator SHALL return the same Diagnostics for the same input text and file name on every call.
7. THE Validator SHALL stop processing a KB_File whose size exceeds 1 MiB and SHALL return an Error_Diagnostic with code `SCHEMA_INVALID` stating the limit.
8. THE Validator SHALL read no clock, random source or environment variable while it validates.

### Requirement 18: Diagnostic quality

**User Story:** As a knowledge engineer, I want every message to say what is wrong and where, so that I can fix it without opening the tool's source.

#### Acceptance Criteria

1. THE Validator SHALL give every Diagnostic a `code` from the Diagnostic_Code list, a `severity`, a `file` and a non-empty `message`.
2. WHERE a Diagnostic concerns one rule, THE Validator SHALL set `id` to that rule's id.
3. WHERE a Diagnostic concerns one fact and no rule, THE Validator SHALL set `id` to that fact's name.
4. THE Validator SHALL write each message in plain English, naming the offending value, and SHALL use the same text for the same problem across runs.
5. THE Validator SHALL clip any quoted source text in a message to at most 200 characters.
6. THE KB_Tools package SHALL document every Diagnostic_Code, its severity and one example in `docs/kb-format.md`.

### Requirement 19: Test coverage

**User Story:** As a reviewer, I want each check backed by tests, so that a change to one check shows up as a failing test.

#### Acceptance Criteria

1. THE KB_Tools test suite SHALL include at least one Vitest example test per Diagnostic_Code that triggers it and one that does not.
2. THE KB_Tools test suite SHALL include property tests, in files named `*.props.test.ts` and using fast-check, for: validation never throws (Requirement 17, criteria 1 and 2); a passing knowledge base never makes `start`, `audit` or `next` throw a KB_Shape_Error (criteria 3 and 5); for all knowledge bases that pass validation and all assignments of type-valid answers to Askable_Facts, `audit` never throws `NON_INTEGER_MONEY`, `INVALID_KB` or `CYCLE` (criterion 4); compile is deterministic (Requirement 15, criterion 9); the compiled JSON round-trips (Requirement 15, criteria 10 and 11); and diagnostics are independent of rule order for `CYCLE` (Requirement 8, criterion 4).
3. THE KB_Tools test suite SHALL include a test for the four notes at the end of `docs/kb-format.md`: the accepted `label`, the `NO_FALLBACK_RULE` warning, the `MONEY_NOT_ROUNDED` error, and the `UNKNOWN_CLAUSE` error.
4. THE KB_Tools test suite SHALL include a test of the YAML quoting rule in Requirement 6 using the YAML text `to: 'gold'`.
5. THE KB_Tools test suite SHALL include one test per static type rule in Requirement 10, including a date compared with an enum and a number assigned to a date fact.
6. WHEN `pnpm check` runs, THE KB_Tools test suite SHALL run as part of it.

---

## Handoff notes

These notes are for the Claude Code lane and the human. They are not requirements on KB_Tools.

1. **Root `dc` script.** This spec does not edit root configuration. The Claude Code lane adds this entry to the root `package.json` `scripts`: `"dc": "pnpm --filter @dead-certain/kb-tools build && node packages/kb-tools/dist/dc.mjs"`. It rebuilds the bundle on every run and always starts from the repository root. The `pnpm -s dc validate` hook command in `docs/BUILD_PLAN.md` depends on it.
2. **Build output location.** `dc build` writes to `apps/<app>/kb/dist/<file-stem>.json`. The apps import that file. The Claude Code lane should git-ignore `apps/*/kb/dist/` if the files are not committed.
3. **Documentation.** Requirement 18, criterion 6 adds a Diagnostic_Code table to `docs/kb-format.md`. That file is shared documentation, so the human confirms the edit.

These notes are for the design phase.

4. **Shared test runner.** Requirement 1, criterion 4 means the design uses the root `vitest` the way `packages/engine` does and declares only `fast-check` and `vite` as dev dependencies in the package. The design does not add a second copy of `vitest`.
5. **Running the `dc` bin under Node 22.** The approach is settled: the `dc` bin is a Vite-bundled `dist/dc.mjs` built with `vite` 8.3.8 (exact), an approved `devDependency` of kb-tools alongside `fast-check`. The approved runtime versions are `zod` 4.6.7 and `yaml` 2.9.1. No open question on a TypeScript runner remains, and the design adds no `tsx` or similar.
