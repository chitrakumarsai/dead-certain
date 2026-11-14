# Implementation Plan: kb-tools

## Overview

This plan builds the knowledge-base toolchain in `packages/kb-tools` (package `@dead-certain/kb-tools`), in TypeScript strict mode, on top of the finished engine. The order is: package and build groundwork, the Loader, the test kit, the Schema and the analysis pipeline, the parse, reference and cycle checks, the type, enum and money checks, the two warnings, the Compiler, the `dc` command, the Vite bundle with its dist smoke test, and the documentation catalogue. Each step builds on the one before it and ends with the code wired into `analyse.ts` or `index.ts`, so no code is left unused.

All work stays in the Kiro lane (`packages/kb-tools`, plus the approved Diagnostic_Code catalogue in `docs/kb-format.md`). Items for the Claude Code lane, including the root `dc` script, are listed under "Handoff notes for Claude Code" and are not tasks.

## Working rules for every task

- Run every command under Node 22 (`.nvmrc`). Before the first command in a session, run `nvm use` (or an equivalent) and confirm `node -v` prints `v22.x`. If it does not, stop and fix the shell first.
- Never use watch mode or any long-running process. Run tests only with `pnpm vitest run <path>`, `pnpm test:props` or `pnpm check`.
- Tasks run one at a time, in the order listed. Do not start a task while another is in progress, and do not run tasks in parallel.
- Do not edit root configuration (`package.json`, `biome.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.github`). `pnpm install` may change the root `pnpm-lock.yaml` as a side effect; report that in the pull request description.
- The engine keeps zero `dependencies`. kb-tools declares exactly: `dependencies` `@dead-certain/engine` (`workspace:*`), `yaml` (`2.9.1`), `zod` (`4.6.7`); `devDependencies` `fast-check` (`4.10.2`) and `vite` (`8.3.8`). No other dependency, no second `vitest`, no `@types/node`, no `tsx`.
- Library code under `packages/kb-tools/src` outside `cli/host-node.ts` and `cli/main.ts` imports no Node module, reads no clock, random source or environment variable, and makes no network call. Node file access uses `// @ts-expect-error TS2591` on the `node:*` import, as the engine's tests do.
- kb-tools imports `KnowledgeBase`, `FactDef`, `Rule`, `Clause`, `Expr` and every other shared type from `@dead-certain/engine` and declares none of them again. It never edits `packages/engine`.
- A validation problem is a returned Diagnostic, never a thrown exception.
- Every property test file ends in `.props.test.ts`, runs each fast-check property at least 100 times (`{ numRuns: 100 }` or more), and starts each property with a comment of the form `// Feature: kb-tools, Property N: <title>`.
- Every new check is wired into `analyse.ts` in the same task that creates it.
- A task is done when `pnpm check` exits with 0 (Biome, `tsc --noEmit`, Vitest unit and property tests) and the task is ticked in this file.
- Do not edit `requirements.md` or `design.md`.

## Tasks

- [x] 1. Groundwork: package, build configuration and diagnostics
  - [x] 1.1 Create the package, the Vite build and the bin shim
    - Create `packages/kb-tools/package.json` exactly as in the design's "Package manifest": `"type": "module"`, `bin.dc` = `./bin/dc.mjs`, `exports` `.` = `./src/index.ts`, the single script `"build": "vite build"`, and the dependencies listed in the working rules. No `postinstall` or other lifecycle script.
    - Create `vite.config.ts` per the design's option table: `build.ssr` = `src/cli/main.ts`, `ssr.target` `node`, `ssr.noExternal` `["@dead-certain/engine"]`, `ssr.external` `["zod", "yaml"]`, `build.rolldownOptions.output` `entryFileNames` `dc.mjs` and format `es`, `outDir` `dist`, `emptyOutDir` true, `minify` false, `sourcemap` true, `target` `node22`.
    - Create `bin/dc.mjs` (`#!/usr/bin/env node`): import `../dist/dc.mjs` if it exists; otherwise print `dist/dc.mjs is missing: run "pnpm --filter @dead-certain/kb-tools build"` to standard error and set `process.exitCode = 2`. It never builds, writes or compares timestamps.
    - Create a stub `src/cli/main.ts` and `src/index.ts` (one exported constant each) so the package type-checks and builds. Run `pnpm install` under Node 22, then `pnpm --filter @dead-certain/kb-tools build`.
    - Confirm the three Vite settings the design could not settle: `ssr.noExternal` inlines the engine's TypeScript source without a plugin; `build.target: "node22"` is accepted; `ssr.external` is honoured for a `build.ssr` entry. If one is rejected, switch to the design's fallback (`build.lib` with `formats: ["es"]` and `build.rolldownOptions.external: ["zod", "yaml", /^node:/]`) and record the change in a comment in `vite.config.ts`.
    - Run `pnpm check`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8_

  - [x] 1.2 Implement `diagnostics.ts` and `limits.ts`
    - `diagnostics.ts`: the `Severity`, `ErrorCode`, `WarningCode`, `DiagnosticCode` and `Diagnostic` types from the design; the severity of each code; maker helpers that set `severity` from the code; `clip(text, 200)` (appends `…` when it clips); and the sort comparator over `(section, index, code, field, message)` by code unit, with the internal `at = { section, index }` dropped before a result is returned.
    - `limits.ts`: `MAX_FILE_BYTES` (1048576), `MAX_QUOTE` (200), `MAX_DEPTH` (64).
    - Export the types from `index.ts`.
    - _Requirements: 16.9, 17.7, 18.1, 18.2, 18.3, 18.5_

  - [x] 1.3 Write unit tests for diagnostics
    - `diagnostics.test.ts`: every code has the right severity (`NO_FALLBACK_RULE` and `DEAD_GUARD` are warnings, the other 20 are errors); `clip` leaves 200 characters alone and clips 201 to 200 plus `…`; the comparator orders by section, index, code, field, message.
    - Run with `pnpm vitest run packages/kb-tools/src/diagnostics.test.ts`.
    - _Requirements: 13.4, 14.5, 18.1, 18.5_

- [x] 2. Loader
  - [x] 2.1 Implement `cli/host.ts`, `load/decode.ts`, `load/yaml-load.ts` and `readKbFile`
    - `host.ts`: the `Host` interface and `HostError { reason }` from the design.
    - `decode.ts`: `decodeUtf8(bytes)` with `new TextDecoder("utf-8", { fatal: true })`. A `TypeError` becomes a `READ_ERROR` whose message is `Cannot read '<file>': the file is not valid UTF-8.` and gives no operating-system reason. A leading byte-order mark is dropped.
    - `readKbFile(path, file, host)` in `index.ts`: check `bytes.byteLength` against `MAX_FILE_BYTES` before decoding; a `HostError` becomes a `READ_ERROR` naming the file and the reason; no throw; never `YAML_SYNTAX` for a read or decoding failure.
    - `yaml-load.ts`: `parseDocument(text, { uniqueKeys: false, maxAliasCount: 100, prettyErrors: false })` inside one `try`/`catch` (a `RangeError` becomes `YAML_SYNTAX`); each `doc.errors` entry becomes `YAML_SYNTAX` with `line L, column C`; an iterative or `MAX_DEPTH`-limited walk of the Document nodes that builds objects with `Object.fromEntries`, reports repeated keys (`DUPLICATE_FACT` in top-level `facts`, `DUPLICATE_CLAUSE` in top-level `clauses`, `YAML_SYNTAX` elsewhere, first occurrence wins), reports non-string keys as `SCHEMA_INVALID` telling the author to quote the key, and reports nesting deeper than `MAX_DEPTH` as `SCHEMA_INVALID`. An empty document or a non-mapping top level is `SCHEMA_INVALID`.
    - Size check first: `text.length > MAX_FILE_BYTES`, otherwise the exact `TextEncoder` length, gives `SCHEMA_INVALID` stating the 1 MiB limit.
    - Export `loadText(text, file)` returning a `LoadResult`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.6, 17.7_

  - [x] 2.2 Write unit tests for the Loader
    - `load.test.ts`: malformed YAML reports line and column; the three duplicate-key mappings; empty document, list and scalar; `__proto__`, `constructor` and `prototype` keys leave prototypes unchanged; unquoted clause key `4.2` reported as `SCHEMA_INVALID` telling the author to quote it; exactly 1 MiB accepted and one byte more rejected.
    - Invalid UTF-8 bytes through a fake `Host` give one `READ_ERROR` naming the file, with `not valid UTF-8` in the message and no operating-system reason, and no new diagnostic code. A host `HostError` gives a `READ_ERROR` containing its reason. Neither is `YAML_SYNTAX`.
    - Run with `pnpm vitest run packages/kb-tools/src/load.test.ts`.
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 3.6, 17.7_

  - [x] 2.3 Write the UTF-8 and read-failure property test
    - **Property 19: UTF-8 decoding and read failures**
    - File `read.props.test.ts`. Round-trip arbitrary text through `readKbFile` (a byte-order mark is dropped); arbitrary byte sequences that are not valid UTF-8 give exactly one `READ_ERROR` containing `not valid UTF-8` and no operating-system reason; arbitrary host reason strings give exactly one `READ_ERROR` containing that reason; no read failure is ever `YAML_SYNTAX`.
    - **Validates: Requirements 2.6, 2.7, 2.8, 2.9**

- [x] 3. Test kit
  - [x] 3.1 Build the generators and the YAML renderer in `src/testkit/`
    - `exprArb(sort, scope, depth)` (boolean, number, date, enum sorts; integer literals 0 to 100, decimals to two places; division right-hand sides may be zero), `moneyExprArb` (tagged rounded or deliberately unrounded), `kbArb` (1 to 6 askable and 0 to 6 derived facts, acyclic by construction, names including `constructor`, `toString` and `__proto__`, clause ids including `4.2` and `10`, optional fields present or absent), `answersArb(kb)` (money integers in ±10,000, numbers finite in ±1,000, valid calendar dates, enum options), and `renderYaml(kb)` using `yaml.stringify` with `print`ed expressions, quoting that survives YAML (`to: "'gold'"`) and quoted keys where needed.
    - Test-only: never imported from non-test source and never re-exported from `index.ts`.
    - Add `testkit.test.ts` with a sanity test: `kbArb` renders to YAML that `loadText` accepts, and at least 80 percent of 200 draws have zero Error_Diagnostics once the later checks exist (assert only the `loadText` part now; the full validator part is added in task 4.1).
    - _Requirements: 19.2_

  - [x] 3.2 Build the fault, cycle and tree generators and the in-memory host in `src/testkit/`
    - `faultArb(kb)`: injects exactly one named fault (unknown fact in an expression, repeated rule id, goal that is not a fact, `set` that is not a fact, `cite` that is not a clause, placeholder naming no fact, goal no rule sets, askable fact without `ask`, rule setting a non-derived fact; and the schema faults: removed required field, string replaced by a number or boolean, unknown key, bad `currency`) and returns the expected diagnostic code, id and name.
    - `cyclicKbArb`: adds back-edges and self-edges to an acyclic base. `treeArb`: a directory tree with `apps/<app>/kb/*.yaml`, other files, `kb/dist/` contents and unrelated folders.
    - `memoryHost(tree)`: an in-memory `Host` that records every `writeFile` and `makeDir` path, can shuffle `readDir` order, and can raise a `HostError` on chosen paths.
    - _Requirements: 19.2_

- [x] 4. Schema and the analysis pipeline
  - [x] 4.1 Implement `schema.ts`, `model.ts` and `analyse.ts` phase 1
    - `schema.ts`: Zod strict schemas for the top level, one fact, one rule and one clause, applied one entity at a time over `Object.entries` (Zod never receives the user-named `facts` or `clauses` maps). Rules: `currency` matches `/^[A-Z]{3}$/`; `enum` needs a non-empty `options`; `options` on a non-enum fact or a repeated option is invalid; `role` on a fact that is not `derived: true` is invalid; `cite` accepts only a YAML string; `to` and `when` accept a string, boolean or finite number (non-finite is `SCHEMA_INVALID`), converted to canonical text.
    - `describeIssue(issue, entity)`: fixed English text per the design's issue-mapping table (never Zod's own message), naming the field and the fact, rule or clause id; the `cite` number case tells the author to quote the value. Collect every issue; do not stop at the first.
    - `model.ts`: `ParsedKb` and `ParsedRule` (entries as arrays and `Map`s, never prototype-bearing records keyed by user names).
    - `analyse.ts`: `analyse(input, file)` runs size check, YAML load, walk and Schema; if phase 1 has an error it sorts and returns without running phase 2; otherwise returns `{ diagnostics, model? }` with `model` present exactly when there is no error. Export `validateText` and `validateRaw` from `index.ts` returning `{ file, diagnostics, ok }`.
    - Extend the task 3.1 sanity test to the full validator once the later checks exist (revisit in task 11.1).
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 4.5, 7.5, 16.13, 17.7_

  - [x] 4.2 Write unit tests for the Schema
    - `schema.test.ts`: unquoted `4.2` as a `cite` and as a clause key; enum fact without options; `options` on a non-enum fact; repeated option; `role` on a non-derived fact; unknown field at every level naming the field; `currency: inr`; several violations in one file all reported in one run; `when: true` and `to: 5` accepted as canonical text; `to: .inf` rejected; the `id` of the offending fact, rule or clause is set.
    - Run with `pnpm vitest run packages/kb-tools/src/schema.test.ts`.
    - _Requirements: 3.1 to 3.12, 4.5, 7.5_

  - [x] 4.3 Write the shape-violation property test
    - **Property 18: Shape violations are named**
    - File `schema.props.test.ts`. Use `faultArb` to remove a required field, replace a string by a number or boolean, add an unknown key at any level, or set a bad `currency`; assert a `SCHEMA_INVALID` naming the field and the entity id, and that no phase 2 code appears in the same result.
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.7, 3.10**

- [x] 5. Parsing, references, goals and questions
  - [x] 5.1 Implement `expr-walk.ts` and `checks/parse-exprs.ts`
    - `expr-walk.ts`: `factRefs(expr)` (distinct fact names, left to right), `exprEqual(a, b)` (structural equality of parsed `Expr`), `valueLeaves(expr)` (a literal is itself; `if(c, t, e)` is the leaves of `t` and `e`, never of `c`; anything else is empty).
    - `parse-exprs.ts`: call the Engine's `parse` on each rule's `to` and `when` string, unchanged, inside a per-rule `try`/`catch (RangeError)`. A parse error is `PARSE_ERROR` naming the rule id, the field, the parse error code, the position and the engine message, with the source clipped to 200 characters. A `RangeError` is `PARSE_ERROR` saying the expression is too deeply nested. A non-finite number literal is `PARSE_ERROR` naming the rule. Never call `evaluate`.
    - Wire into `analyse.ts` as the first step of phase 2.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 15.8, 17.1_

  - [x] 5.2 Implement `checks/refs.ts` and `checks/goals.ts`
    - `refs.ts`: lookups through `Map`s built from validated entities. `UNKNOWN_FACT` (one per distinct unknown name per field), `DUPLICATE_RULE` (each rule after the first), `UNKNOWN_GOAL`, `UNKNOWN_SET_FACT`, `UNKNOWN_CLAUSE`, and `UNKNOWN_PLACEHOLDER` using `/\{([A-Za-z_][A-Za-z0-9_]{0,127})\}/g`. Every diagnostic carries the file; rule diagnostics carry the rule id and, for expressions, the field.
    - Quoted-literal hint: when the whole `to` or `when` is a single `fact` node naming no fact, the message is `Fact '<name>' is not defined — did you mean the enum literal '<name>'? Corrected YAML: "'<name>'"`; a larger expression gets `Fact '<name>' is not defined.`; a defined bare identifier gets nothing.
    - `goals.ts`: `GOAL_UNSET` (goal is a fact and no rule sets it), `MISSING_ASK` (not derived and no `ask`), `SET_NON_DERIVED`. A derived fact with `ask` is accepted silently.
    - `DUPLICATE_FACT` and `DUPLICATE_CLAUSE` already come from the Loader (task 2.1); assert that in the tests, do not duplicate the check.
    - Wire both into `analyse.ts`.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

  - [x] 5.3 Write unit tests for parsing, references and goals
    - `refs.test.ts`: the YAML text `to: 'gold'` gives the hint message and `to: "'gold'"` validates; `gold + 1` gives the plain message; a defined bare identifier gives none; `PARSE_ERROR` names rule, field, code and position; a 400-digit literal gives `PARSE_ERROR`; a chain of 5,000 `+ 1` terms returns a result without throwing; `toString` and `__proto__` as unknown names; a derived fact with `ask` gives no diagnostic; one passing and one failing example for each of the nine codes of this task.
    - Run with `pnpm vitest run packages/kb-tools/src/refs.test.ts`.
    - _Requirements: 4.2, 4.3, 5.1 to 5.10, 6.1 to 6.4, 7.1 to 7.4, 15.8, 19.1, 19.4_

  - [x] 5.4 Write the reference-checks property test
    - **Property 12: Reference, goal and question checks report exactly the broken items**
    - File `refs.props.test.ts`. Use `faultArb`; assert the diagnostics for the nine codes are exactly the injected faults with the right ids and names, and none for a fault-free knowledge base.
    - **Validates: Requirements 5.1, 5.2, 5.5, 5.6, 5.7, 5.8, 7.1, 7.2, 7.3**

  - [x] 5.5 Write the own-property lookup property test
    - **Property 13: Names are looked up as own properties only**
    - File `own-names.props.test.ts`. Names drawn from ordinary identifiers plus `toString`, `constructor`, `prototype`, `__proto__`; an undefined name is `UNKNOWN_FACT`; a defined one validates and compiles with prototypes unchanged (the compile part is asserted once task 11.1 exists; guard it with the validate part only until then and extend it in 11.1).
    - **Validates: Requirements 2.5, 5.9**

  - [x] 5.6 Write the quoted-literal hint property test
    - **Property 14: The quoted-literal hint appears for a lone unknown identifier only**
    - File `quoted-literal.props.test.ts`. Lone unknown identifier gives the hint message with the corrected YAML; `<name> + 1` gives the plain message; a defined identifier gives none.
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 6. Cycles
  - [x] 6.1 Implement `checks/cycles.ts`
    - Build the edge set (`Map<string, Set<string>>`) from reference-clean rules only (every `set`, `to` and `when` fact exists and the expressions parsed): edge from `rule.set` to each name in `factRefs(to)` and `factRefs(when)`.
    - Iterative Tarjan strongly connected components (no recursion). A component with two or more facts, or one fact with a self-edge, is a cycle. One `CYCLE` per component, ordered by the component's first fact in the file, `id` = the alphabetically first fact `s`.
    - Path: breadth-first search from `s` over the component's edges taking neighbours in alphabetical order, until `s` is reached again. Message `Dependency cycle: a -> b -> c -> a.`; a self-reference gives `Fact 'a' depends on itself: rule 'R-1' sets it from an expression that reads it.` naming the first such rule in file order.
    - Wire into `analyse.ts`.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 6.2 Write unit tests for cycles
    - `cycles.test.ts`: two-fact cycle; three-fact cycle starting at the alphabetically first fact; self-reference in `to` and in `when`; two separate cycles give two diagnostics; an acyclic graph gives none; a rule with an unknown fact reference is excluded and produces no misleading `CYCLE`; a 5,000-fact chain does not overflow the stack.
    - Run with `pnpm vitest run packages/kb-tools/src/cycles.test.ts`.
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 19.1_

  - [x] 6.3 Write the cycle-agreement property test
    - **Property 7: Cycle reports agree with the engine and are canonical**
    - File `cycles.props.test.ts`. Use `cyclicKbArb` and compare against the Engine's `start` throwing `CYCLE`; check each path starts at the alphabetically first fact, each consecutive pair is an edge, and the last fact has an edge back to the first. Include self-references.
    - **Validates: Requirements 8.2, 8.3, 8.6**

  - [x] 6.4 Write the cycle order-independence property test
    - **Property 8: The CYCLE diagnostics do not depend on rule order**
    - File `cycles-order.props.test.ts`. For any permutation of the rules, the `CYCLE` diagnostics (code, id, message) are identical.
    - **Validates: Requirements 8.4**

- [x] 7. Checkpoint - references and cycles
  - Ensure all tests pass, ask the user if questions arise. Run `pnpm check` and `pnpm test:props` under Node 22.

- [x] 8. Static types, enums and money
  - [x] 8.1 Implement `checks/types.ts`
    - `inferType(expr)`: post-order walk returning `"boolean" | "number" | "date" | "enum" | "unknown"` per the design's type table (`money` read as `number`). An `unknown` operand makes the node `unknown` and reports nothing; a node that reports its own `TYPE_MISMATCH` returns `unknown`. Each `TYPE_MISMATCH` names the rule id, the field and `print(subExpr)` clipped to 200 characters. Do not recurse without a `RangeError` guard (reported as `PARSE_ERROR`, as in task 5.1).
    - After inference: `to` against the `set` fact (a `money` or `number` fact accepts `number`; `boolean`, `date` and `enum` facts accept only their own type; a number assigned to a date fact, and a money expression assigned to a date, boolean or enum fact, are `TYPE_MISMATCH` naming the rule, fact, expected and found type). `when` must be `boolean`, else `NOT_BOOLEAN` naming the rule and the found type.
    - Skip a sub-expression that already has `UNKNOWN_FACT` (type unknown). Wire into `analyse.ts`.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 11.1, 11.2, 11.3_

  - [x] 8.2 Write the type-rule example tests
    - `types.test.ts`: one test per rule of Requirement 10 (arithmetic and unary minus, `==`/`!=` on a date against an enum, ordering operators, `and`/`or`/`not`, `min`/`max`/`round`/`days_between`, `if` condition and branches, `to` against the `set` fact, a number assigned to a date fact, `when` not boolean), a money expression assigned to a boolean fact, money accepted wherever a number is, and the no-cascade case (an unknown fact does not also give `TYPE_MISMATCH`).
    - Run with `pnpm vitest run packages/kb-tools/src/types.test.ts`.
    - _Requirements: 10.1 to 10.12, 11.1, 11.2, 11.3, 19.1, 19.5_

  - [x] 8.3 Write the type-soundness property test
    - **Property 9: A type-checked expression never fails the engine's type checks**
    - File `types.props.test.ts`. For generated expressions the validator accepts with no `TYPE_MISMATCH` or `NOT_BOOLEAN`, and type-valid environments (some facts unknown), `evaluate` never returns `TYPE_MISMATCH`; only `DIVISION_BY_ZERO` and `NUMERIC_OVERFLOW` may occur. A well-typed generator expression produces no type diagnostic.
    - **Validates: Requirements 10.1, 10.12, 11.1, 11.2**

  - [x] 8.4 Write the no-cascade property test
    - **Property 10: One mistake does not cascade**
    - File `no-cascade.props.test.ts`. Replace one sub-expression of a well-typed expression with a reference to an undefined fact; assert exactly the `UNKNOWN_FACT` for that reference and no dependent `TYPE_MISMATCH` or `NOT_BOOLEAN`.
    - **Validates: Requirements 10.11**

  - [x] 8.5 Implement `checks/enums.ts`
    - Enum literal as a leaf of `valueLeaves(to)` for a rule whose `set` fact is an enum must be in its `options`; a `==` or `!=` between an enum literal and an enum `fact` node, in either order, anywhere in `to` or `when`, needs the literal in that fact's `options`. The condition of `if(...)` is not a value leaf. `ENUM_VALUE_NOT_IN_OPTIONS` names the rule, the field, the literal and the fact. Wire into `analyse.ts`.
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 8.6 Write unit tests for enums
    - `enums.test.ts`: literal in `to` not in options; literal in an `if` branch; literal in an `if` condition (not checked under rule 1); `==` and `!=` in both operand orders; all literals valid gives no diagnostic.
    - Run with `pnpm vitest run packages/kb-tools/src/enums.test.ts`.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 19.1_

  - [x] 8.7 Write the enum property test
    - **Property 15: Enum literals are checked against options**
    - File `enums.props.test.ts`. For a branch leaf and for either side of `==`/`!=`, `ENUM_VALUE_NOT_IN_OPTIONS` appears if and only if the literal is not in the options; an `if` condition literal is not checked for the `set` rule.
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [x] 8.8 Implement `checks/money.ts`
    - `isRoundedMoney(expr, facts)` per the design's table: `round` call; integer number literal (`Number.isInteger`); `money` fact reference; `min`/`max` with both arguments rounded; `if` with both branches rounded; `+`/`-` with both operands rounded; unary `-` of a rounded operand; `*` with one rounded operand and one integer number literal. Everything else is not rounded.
    - For a rule whose `set` fact has type `money` and a parsed `to` that is not rounded, report `MONEY_NOT_ROUNDED` with message `Rule '<id>' sets money fact '<fact>' from '<print(to)>', which can produce a fraction. Wrap the expression in round(...).` The message must contain all three of the rule id, the fact and the printed `to`. The check does not wait for the type check. Wire into `analyse.ts`.
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 8.9 Write unit tests for money
    - `money.test.ts`: `sum_insured * 0.01` unrounded with all three names in the message and the text `round(`; `round(sum_insured * 0.01)` accepted; each Rounded_Money_Expression form accepted; division and `*` of two non-literals rejected; the rule on a non-money fact is not checked.
    - Add the repository test `money-repo.test.ts` (Requirement 12, criterion 5): read every `apps/*/kb/*.yaml` and every file in `packages/kb-tools/fixtures/` and fail on any `MONEY_NOT_ROUNDED`. When `apps/*/kb` has no files, it passes on the fixtures alone and its name says so. Add a toy fixture under `packages/kb-tools/fixtures/` that is a valid knowledge base.
    - Run with `pnpm vitest run packages/kb-tools/src/money.test.ts packages/kb-tools/src/money-repo.test.ts`.
    - _Requirements: 12.1 to 12.5, 19.1_

  - [x] 8.10 Write the money property test
    - **Property 11: Rounded money expressions evaluate to whole numbers**
    - File `money.props.test.ts`. For `isRoundedMoney`-accepted expressions and small-integer money environments, `evaluate` gives an integer or `UNKNOWN`; `MONEY_NOT_ROUNDED` is reported if and only if `isRoundedMoney` rejects the `to`, and the message contains the rule id, fact name, printed `to` and `round(`.
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

- [x] 9. Warnings
  - [x] 9.1 Implement `checks/fallback.ts` and `checks/dead-guards.ts`
    - `fallback.ts`: `NO_FALLBACK_RULE` (warning) for a fact with `role: deduction` that no rule without `when` sets. Message: `Deduction fact '<x>' has no rule without a 'when' guard, so the engine reports it as undefined whenever every guard is false. Add an unguarded default rule.` Facts with `role: check` or no role are skipped.
    - `dead-guards.ts`: `isDead(e)` as in the design — the boolean literal `false` is dead; an `and` is dead when its left or right operand is dead (recursive through nested `and` nodes at any depth, because the parser nests `a and b and c` and one dead operand makes the whole chain dead) or when its operands are `x` and `not x` in either order by `exprEqual`. `DEAD_GUARD` (warning) names the rule id and includes the printed guard, clipped. Nothing else is flagged: `a and b and not a` and `a < b` are not reported, and `false or x and not x` is not reported because it is an `or`.
    - Both are `severity: warning` and must not make `ok` false. Wire into `analyse.ts`.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 9.2 Write unit tests for the warnings
    - `warnings.test.ts`: `NO_FALLBACK_RULE` raised for a deduction with only guarded rules, absent with an unguarded rule, absent for `check` and role-less facts; a knowledge base with only warnings has `ok: true`.
    - `DEAD_GUARD`: `false`; `x and not x`; `not x and x`; `(x and not x) and y and z`; `a and (b and false) and c`; a dead operand at the left, middle and right of a four-operand chain; and the non-matches `a and b and not a`, `a < b` and `false or x and not x`.
    - Run with `pnpm vitest run packages/kb-tools/src/warnings.test.ts`.
    - _Requirements: 13.1 to 13.4, 14.1 to 14.6, 19.1_

  - [x] 9.3 Write the fallback-warning property test
    - **Property 16: The fallback warning is exactly characterised and never fails a run**
    - File `fallback.props.test.ts`. `NO_FALLBACK_RULE` for a fact if and only if `role` is `deduction` and no rule without `when` sets it. A knowledge base whose only diagnostics are warnings has `ok: true` and compiles (the exit-code half is asserted in task 13.5).
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 14.5**

  - [x] 9.4 Write the dead-guard property test
    - **Property 17: A reported dead guard is never true, and nested dead operands are found**
    - File `dead-guards.props.test.ts`. `x and not x` and `not x and x` give `DEAD_GUARD` for any generated `x`; an `and` chain of any length with a dead operand at any position gives `DEAD_GUARD`; for every guard reported and every environment (including unknown values), `evaluate` never returns `true`.
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4**

- [x] 10. Checkpoint - all static checks
  - Ensure all tests pass, ask the user if questions arise. Run `pnpm check` and `pnpm test:props` under Node 22.

- [x] 11. Compiler
  - [x] 11.1 Implement `compile.ts` and `compileText`
    - `compileModel(model)`: build the `KnowledgeBase` with `id`, `currency` (only if present), `goals`, `facts`, `rules` in file order, `clauses` with each `Clause.id` set from its key; copy `ask`, `why`, `derived`, `options`, `role`, `label` only where the YAML supplied them and never add a `label`; keep each `to`/`when` as `parse` returned it.
    - Rebuild objects with keys in the fixed order of the design's key-order table using `Object.fromEntries` (so `__proto__` stays an own property); the `facts` and `clauses` maps keep file order. Serialise with `JSON.stringify(value, null, 2) + "\n"`. No timestamp, path or version stamp.
    - A non-finite number literal returns `{ ok: false }` with `PARSE_ERROR` naming the rule (defence in depth). `compileText` calls `analyse` once and serialises that same `model`; it returns `{ ok: true, kb, json, diagnostics }` or `{ ok: false, diagnostics }` and never a partial value.
    - Export `compileText` from `index.ts`. Extend the sanity test in `testkit.test.ts` to the full validator (80 percent of 200 draws with zero Error_Diagnostics) and extend Property 13 to include compile.
    - _Requirements: 4.6, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.12, 16.13_

  - [x] 11.2 Write unit tests for the Compiler
    - `compile.test.ts`: key order of every object kind; two-space indentation and one trailing line feed; `currency` and `when` omitted when absent; no `label` invented; clause `id` equals its key (including `4.2`); rules and goals in file order; a failed compile has no `kb` and no `json`; the 400-digit literal returns no output.
    - Run with `pnpm vitest run packages/kb-tools/src/compile.test.ts`.
    - _Requirements: 15.1 to 15.8, 15.12_

  - [x] 11.3 Write the compile-rendering property test
    - **Property 4: Compiling the rendering of a knowledge base gives that knowledge base**
    - File `compile-render.props.test.ts`. `compileText(renderYaml(k))` succeeds and `kb` is deeply equal to `k`, with optional fields present or absent, number-like clause ids, and fact names such as `constructor` and `__proto__`.
    - **Validates: Requirements 2.1, 3.2, 4.1, 4.3, 4.6, 15.1, 15.2, 15.3, 15.4, 15.5**

  - [x] 11.4 Write the determinism and JSON round-trip property test
    - **Property 5: Compiled output is deterministic and round-trips through JSON**
    - File `compile-json.props.test.ts`. Compile twice for byte-identical `json`; `JSON.parse(json)` deep-equals `kb`; exactly one trailing line feed, two-space indentation, key order per the table, no absolute path; a failed compile has no `kb` and no `json`.
    - **Validates: Requirements 15.6, 15.7, 15.9, 15.10, 15.12**

  - [x] 11.5 Write the print/parse round-trip property test
    - **Property 6: Printing and parsing compiled expressions is the identity**
    - File `print-parse.props.test.ts`. For every expression in a compiled knowledge base, `parse(print(e))` is `{ ok: true }` with an expression deeply equal to `e`.
    - **Validates: Requirements 15.11**

  - [x] 11.6 Write the engine-acceptance property test
    - **Property 3: A passing knowledge base is accepted by the engine**
    - File `engine-accepts.props.test.ts`. For a knowledge base with zero Error_Diagnostics, `start(kb)` and `next(start(kb))` throw no `INVALID_KB` or `CYCLE`; and for every assignment from `answersArb`, `audit` throws no `NON_INTEGER_MONEY`, `INVALID_KB` or `CYCLE` (an `EVALUATION_ERROR` such as `DIVISION_BY_ZERO` is allowed).
    - **Validates: Requirements 17.3, 17.4, 17.5**

- [x] 12. Totality and diagnostic quality
  - [x] 12.1 Write the code-table example test
    - `codes.test.ts`: a table of all 22 codes with one failing and one passing example each; a test fails if a code in `DiagnosticCode` has no row; `READ_ERROR` appears in both of its message forms.
    - Run with `pnpm vitest run packages/kb-tools/src/codes.test.ts`.
    - _Requirements: 19.1, 18.4_

  - [x] 12.2 Write the totality and determinism property test
    - **Property 1: Validation is total and deterministic**
    - File `total.props.test.ts`. `validateText` over arbitrary strings and `validateRaw` over arbitrary JSON-like values (wrong types, nulls, arrays for objects, `__proto__` keys, very long strings, deep nesting) return without throwing, and a second call returns deeply equal diagnostics.
    - **Validates: Requirements 17.1, 17.2, 17.6**

  - [x] 12.3 Write the diagnostic-quality property test
    - **Property 2: Diagnostics are well formed and sorted**
    - File `diagnostic-shape.props.test.ts`. Every diagnostic has a known `code`, a matching `severity`, the given `file` and a non-empty `message`; rule-scoped codes carry an `id` that is a rule id in the input; fact-scoped codes carry a fact name in the input; quoted source text is at most 200 characters; the list is in comparator order.
    - **Validates: Requirements 3.12, 5.10, 16.9, 18.1, 18.2, 18.3, 18.5**

  - [x] 12.4 Write the notes and smoke tests for the library
    - `kb-format-notes.test.ts`: the four notes at the end of `docs/kb-format.md` — `label` accepted, `NO_FALLBACK_RULE` raised, `MONEY_NOT_ROUNDED` raised, `UNKNOWN_CLAUSE` raised.
    - `source-scan.test.ts`: scan non-test files in `packages/kb-tools/src` — no network module import, no `Date`, `Math.random` or `process.env` outside `cli/main.ts` and `cli/host-node.ts`, no re-declaration of an engine type name, no Node import outside the two host files, no `testkit` import from non-test code.
    - `manifest.test.ts`: package name; exact `zod` and `yaml` versions with no range operator; `@dead-certain/engine` as `workspace:*`; only `fast-check` and `vite` (both exact) under `devDependencies` and no `vitest`; a `build` script and no lifecycle script; a `bin.dc` entry; no `dependencies` entry in `packages/engine/package.json`.
    - Run with `pnpm vitest run packages/kb-tools/src/kb-format-notes.test.ts packages/kb-tools/src/source-scan.test.ts packages/kb-tools/src/manifest.test.ts`.
    - _Requirements: 1.1 to 1.6, 1.8, 17.8, 19.3_

- [x] 13. The `dc` command
  - [x] 13.1 Implement `cli/args.ts`, `cli/discover.ts`, `cli/format.ts` and `cli/run.ts`
    - `args.ts`: `dc <validate|build> [path…]`, `dc help`, `dc --help`, `dc -h`. Anything else is a usage error: usage text on standard error, exit 2. Help prints usage to standard output and exits 0.
    - `discover.ts`: the repository root is the nearest ancestor of `host.cwd()` holding `pnpm-workspace.yaml` (none is a usage error). No paths: each `apps/*` (sorted), non-recursive `kb/*.yaml` files only (never `kb/dist/`). With paths: resolve against the root; `apps/<app>` expands to its `kb/*.yaml`; a file must match `apps/<app>/kb/<name>.yaml` with no `..` segment; a path that matches no KB_File is a usage error (exit 2); remove duplicates; sort by path. No paths and no files: print `0 files checked, 0 errors, 0 warnings`, exit 0.
    - `format.ts`: `<file>: <severity> <code> [<id>] <message>` with `[<id>]` only when `id` is set, then the summary line `<N> files checked, <E> errors, <W> warnings`. File paths are root-relative POSIX paths.
    - `run.ts`: `runCli(argv, host): { exitCode, stdout, stderr }`. For each file `readKbFile` then `validateText` (validate) or `compileText` (build); sort diagnostics by path then in-file order then code. For `build`, compile all files in memory first, and only if no file has an Error_Diagnostic create `apps/<app>/kb/dist/` and write `<stem>.json`. Exit 0 with zero errors (warnings allowed), 1 otherwise. A `HostError` during a write is printed as `<path>: error <reason>` on standard error with exit 1. Writes only below `apps/<app>/kb/dist/`; no environment variable is read.
    - Export `runCli` and `Host` from `index.ts`.
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 16.11, 16.12, 16.14_

  - [x] 13.2 Implement `cli/host-node.ts` and `cli/main.ts`
    - `host-node.ts`: import `node:fs` and `node:path` with `// @ts-expect-error TS2591`, wrap them in the typed `Host` (reads throw `HostError { reason }` carrying the operating-system code and description). No ambient module declaration and no `@types/node`.
    - `main.ts`: read `process.argv`, call `runCli` with the real host, write `stdout` and `stderr`, set `process.exitCode`; never call `process.exit`. It runs when imported, so `dist/dc.mjs` is directly runnable with `node`. Replace the stub from task 1.1.
    - Run `pnpm --filter @dead-certain/kb-tools build` and `node packages/kb-tools/dist/dc.mjs help` as a manual check, then `pnpm check`.
    - _Requirements: 1.7, 1.8, 16.12_

  - [x] 13.3 Write unit tests for the command
    - `cli.test.ts` through the in-memory host: `validate` with no files (summary `0 files checked, 0 errors, 0 warnings`, exit 0), with a file argument and with a directory argument; `build` writes the expected `apps/<app>/kb/dist/<stem>.json` paths; one file with an error writes nothing for any file; warnings only gives exit 0; a `READ_ERROR` gives exit 1; invalid UTF-8 prints the `not valid UTF-8` message; usage errors give exit 2 with empty standard output; `help` exits 0; a failing write is reported and exits 1; the printed order depends only on file content.
    - Run with `pnpm vitest run packages/kb-tools/src/cli.test.ts`.
    - _Requirements: 16.1 to 16.14, 2.7, 2.8_

  - [x] 13.4 Write the build-writes property test
    - **Property 20: A failing run writes nothing, a passing run is repeatable, and writes stay inside `kb/dist`**
    - File `cli-build.props.test.ts`. With `treeArb` and `memoryHost`: no file written when any KB_File has an Error_Diagnostic; otherwise exactly one `apps/<app>/kb/dist/<stem>.json` per file equal to `compileText(...).json`, byte-identical on a second run; every written path matches `apps/<app>/kb/dist/<stem>.json`.
    - **Validates: Requirements 16.3, 16.4, 16.11, 16.12**

  - [x] 13.5 Write the exit-code and output property test
    - **Property 21: Exit code, line format and summary agree with the diagnostics**
    - File `cli-output.props.test.ts`. Exit code 1 if and only if an Error_Diagnostic exists, else 0 (including warnings-only trees); each diagnostic line matches the format with `[<id>]` only when the diagnostic has an `id`; the summary counts equal the printed lines.
    - **Validates: Requirements 16.5, 16.6, 16.8, 16.10**

  - [x] 13.6 Write the discovery property test
    - **Property 22: Discovery finds exactly the matching files**
    - File `cli-discover.props.test.ts`. `dc validate` with no path checks exactly the files matching `apps/<app>/kb/<name>.yaml`, and the output order does not change when the host lists directories in a different order.
    - **Validates: Requirements 16.1, 16.9**

- [x] 14. Vite bundle and dist smoke test
  - [x] 14.1 Finalise the bundle configuration
    - Confirm `vite.config.ts` and `bin/dc.mjs` against the finished source. Run `pnpm --filter @dead-certain/kb-tools build`; confirm `dist/dc.mjs` and `dist/dc.mjs.map` exist, that `zod` and `yaml` appear as `import` statements and are not inlined, that the engine is inlined, and that no `@dead-certain/engine` import remains in the bundle.
    - Run `pnpm build` at the repository root and confirm the kb-tools build is picked up by `pnpm -r --if-present build` with no root edit.
    - _Requirements: 1.7, 1.8_

  - [x] 14.2 Write the dist smoke test
    - `dist-smoke.test.ts` (a plain Vitest test with a 60-second timeout): run the package build into a temporary output directory (Vite's programmatic `build` or `vite build --outDir`), then spawn `node <tmp>/dc.mjs validate` on a toy tree written to a temporary directory. Assert its standard output and exit code equal those of `runCli` from the TypeScript source for the same tree.
    - Load the bundled output's engine and call `audit` on the compiled toy knowledge base. Assert `zod` and `yaml` are imported rather than inlined and the engine is inlined. Run the shim `bin/dc.mjs` with a missing `dist/dc.mjs` (copy the shim to a temporary directory) and assert the build instruction on standard error and exit status 2.
    - Node access uses the `@ts-expect-error TS2591` pattern. Clean up every temporary directory. Run with `pnpm vitest run packages/kb-tools/src/dist-smoke.test.ts`.
    - _Requirements: 1.7, 1.8, 16.12, 16.13_

- [x] 15. Documentation catalogue
  - [x] 15.1 Add the Diagnostic_Code catalogue to `docs/kb-format.md`
    - Ask the user to confirm this edit before making it (shared documentation). Add a section "Diagnostic codes" with the 22-row catalogue table from the design (code, severity, `id`, example message), including both `READ_ERROR` messages and the `SCHEMA_INVALID` size-limit message. Change nothing else in the file.
    - _Requirements: 18.6_

  - [x] 15.2 Write the catalogue test
    - `catalogue.test.ts`: every code in `DiagnosticCode` appears in the new table with its severity and an example row.
    - Run with `pnpm vitest run packages/kb-tools/src/catalogue.test.ts`.
    - _Requirements: 18.6_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise. Run `pnpm check` and `pnpm test:props` under Node 22 and confirm exit code 0.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster path. They are the property-test sub-tasks. Example tests, smoke tests and the sanity test are not optional, because the requirements say the test suite SHALL include them (Requirement 19, criteria 1 and 3 to 6; Requirement 12, criterion 5). Requirement 19, criterion 2 names the property tests, so skipping the `*` tasks leaves that criterion unmet.
- Each task references specific requirements for traceability. Checkpoints give incremental validation.
- Property tests validate universal properties; unit tests validate exact examples and edge cases.
- Tasks run strictly one at a time in the order listed. The dependency graph below therefore has one task per wave.
- The Vite settings that the documentation did not settle are decided in task 1.1 and proven by task 14.2.
- Invalid UTF-8 is a `READ_ERROR` whose message says the file is not valid UTF-8, with no operating-system reason and no new code (Requirement 2, criteria 8 and 9). `DEAD_GUARD` recurses through nested `and` nodes at any depth (Requirement 14, criterion 3).

## Handoff notes for Claude Code

These items belong to the Claude Code lane. They are recorded here so nothing is lost, and they are not tasks in this plan.

1. **Root `dc` script.** Add to the root `package.json` `scripts`: `"dc": "pnpm --filter @dead-certain/kb-tools build && node packages/kb-tools/dist/dc.mjs"`. It rebuilds the bundle on every run, so the command can never be stale, and it starts at the repository root, so path arguments such as `apps/claim-check` are root-relative. This is the design's decision 8. It replaces the `pnpm --filter @dead-certain/kb-tools exec dc` form in the requirements' handoff note 1, which would run the bin shim without building. The hook command `pnpm -s dc validate` in `docs/BUILD_PLAN.md` and the CI step `pnpm run --if-present dc validate` both go through this script, so `.github/workflows/ci.yml` needs no change.
2. **Lockfile.** Task 1.1 runs `pnpm install`, which adds `zod` 4.6.7, `yaml` 2.9.1, `fast-check` 4.10.2 and `vite` 8.3.8 for kb-tools and changes the root `pnpm-lock.yaml`. Review that change. CI uses `pnpm install --frozen-lockfile`, so the lockfile must be committed with the first kb-tools pull request.
3. **Build output.** `dc build` writes `apps/<app>/kb/dist/<file-stem>.json`. The apps import that file. Git-ignore `apps/*/kb/dist/` if the files are not committed. `packages/kb-tools/dist/` is already covered by the root `.gitignore`.
4. **Root `pnpm build`.** The root `build` script is `pnpm -r --if-present build`, so it runs the kb-tools `vite build` with no root edit. Make sure an app build that imports a compiled knowledge base runs `pnpm dc build` first.
5. **Test and lint coverage.** The root `vitest.config.ts` include `packages/**/*.test.{ts,tsx}` already covers kb-tools. Biome lints and formats `bin/dc.mjs` and `vite.config.ts` (tabs, double quotes); they sit outside `src`, so the root `tsc` does not check them. If a Biome rule objects to either, change the root config; Kiro does not.
6. **Dist smoke test runtime.** `dist-smoke.test.ts` runs a Vite build and spawns Node, so it adds several seconds to `pnpm check`. If CI time matters, raise its timeout or split it into its own job; the test file name stays the same.
7. **Documentation edit.** Task 15.1 edits the shared `docs/kb-format.md`; the human confirms the catalogue before Kiro writes it.
8. **MCP server.** `packages/mcp` can call `validateText`, `validateRaw`, `compileText` and `readKbFile` from `@dead-certain/kb-tools` without the command line (Requirement 16, criterion 13).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2"] },
    { "id": 5, "tasks": ["2.3"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2"] },
    { "id": 8, "tasks": ["4.1"] },
    { "id": 9, "tasks": ["4.2"] },
    { "id": 10, "tasks": ["4.3"] },
    { "id": 11, "tasks": ["5.1"] },
    { "id": 12, "tasks": ["5.2"] },
    { "id": 13, "tasks": ["5.3"] },
    { "id": 14, "tasks": ["5.4"] },
    { "id": 15, "tasks": ["5.5"] },
    { "id": 16, "tasks": ["5.6"] },
    { "id": 17, "tasks": ["6.1"] },
    { "id": 18, "tasks": ["6.2"] },
    { "id": 19, "tasks": ["6.3"] },
    { "id": 20, "tasks": ["6.4"] },
    { "id": 21, "tasks": ["8.1"] },
    { "id": 22, "tasks": ["8.2"] },
    { "id": 23, "tasks": ["8.3"] },
    { "id": 24, "tasks": ["8.4"] },
    { "id": 25, "tasks": ["8.5"] },
    { "id": 26, "tasks": ["8.6"] },
    { "id": 27, "tasks": ["8.7"] },
    { "id": 28, "tasks": ["8.8"] },
    { "id": 29, "tasks": ["8.9"] },
    { "id": 30, "tasks": ["8.10"] },
    { "id": 31, "tasks": ["9.1"] },
    { "id": 32, "tasks": ["9.2"] },
    { "id": 33, "tasks": ["9.3"] },
    { "id": 34, "tasks": ["9.4"] },
    { "id": 35, "tasks": ["11.1"] },
    { "id": 36, "tasks": ["11.2"] },
    { "id": 37, "tasks": ["11.3"] },
    { "id": 38, "tasks": ["11.4"] },
    { "id": 39, "tasks": ["11.5"] },
    { "id": 40, "tasks": ["11.6"] },
    { "id": 41, "tasks": ["12.1"] },
    { "id": 42, "tasks": ["12.2"] },
    { "id": 43, "tasks": ["12.3"] },
    { "id": 44, "tasks": ["12.4"] },
    { "id": 45, "tasks": ["13.1"] },
    { "id": 46, "tasks": ["13.2"] },
    { "id": 47, "tasks": ["13.3"] },
    { "id": 48, "tasks": ["13.4"] },
    { "id": 49, "tasks": ["13.5"] },
    { "id": 50, "tasks": ["13.6"] },
    { "id": 51, "tasks": ["14.1"] },
    { "id": 52, "tasks": ["14.2"] },
    { "id": 53, "tasks": ["15.1"] },
    { "id": 54, "tasks": ["15.2"] }
  ]
}
```
