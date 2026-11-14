# Implementation Plan: kb-golden

## Overview

This plan adds golden scenarios to `packages/kb-tools` (package `@dead-certain/kb-tools`), in TypeScript strict mode, on top of the finished engine and kb-tools. The order is: types and groundwork, value checks, the loader, the checker, the runner, coverage, the `dc golden` command, the public exports and the bundle, then the documentation and the agent prompt.

All work stays in the Kiro lane: `packages/kb-tools`, the "Golden scenarios" section of `docs/kb-format.md`, and `.kiro/agents/knowledge-engineer.json`. No root configuration changes. Items for the Claude Code lane are listed under "Handoff notes for Claude Code".

This plan writes no golden scenarios for the real apps. Those come in Phase 2, after the rulebooks exist.

## Working rules for every task

- Run every command under Node 22 (`.nvmrc`). Before the first command in a session, run `nvm use` (or an equivalent) and confirm `node -v` prints `v22.x`. If it does not, stop and fix the shell first.
- Never use watch mode or any long-running process. Run tests only with `pnpm vitest run <path>`, `pnpm test:props` or `pnpm check`.
- Tasks run one at a time, in the order listed. Do not start a task while another is in progress, and do not run tasks in parallel.
- Do not edit root configuration (`package.json`, `biome.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.github`). If a task seems to need a root change, stop and write a handoff note for the Claude Code lane.
- Add no dependency. kb-tools keeps exactly its present `dependencies` (`@dead-certain/engine` as `workspace:*`, `yaml`, `zod`) and `devDependencies` (`fast-check`, `vite`).
- Library code under `packages/kb-tools/src/golden/` imports no Node module, reads no clock, random source or environment variable, and makes no network call. Only `cli/host-node.ts` and `cli/main.ts` touch Node. `cli/golden.ts` reads files through the `Host` and nothing else.
- kb-golden imports `FactValue`, `FactDef`, `KnowledgeBase`, `Verdict`, `Question`, `ProofNode`, `Session` and every other shared type from `@dead-certain/engine`, and declares none of them again. It never edits `packages/engine`.
- A problem with a golden file, or a failed scenario, is a returned diagnostic, never a thrown exception.
- Every message that prints a value goes through the exported `shown` or through `describeValue`, so no message can throw.
- Every property test file ends in `.props.test.ts`, runs each fast-check property at least 100 times (`{ numRuns: 100 }` or more), and starts each property with a comment of the form `// Feature: kb-golden, Property N: <title>`. Reuse `kbArb`, `answersArb` and `renderYaml` from `src/testkit`. New generators go in `src/testkit/golden.ts`.
- Vitest's default time limit is now 60 s (root config). A test that runs a build or spawns Node still sets its own explicit limit.
- Every new check is wired into its caller (`checkGolden`, `runScenario`, `cli/golden.ts`) in the same task that creates it.
- A task is done when `pnpm check` exits with 0 (Biome, `tsc --noEmit`, Vitest unit and property tests) and the task is ticked in this file.
- Do not edit `requirements.md` or `design.md`.

## Tasks

- [ ] 1. Groundwork
  - [x] 1.1 Create the golden types and export `shown`
    - Create `src/golden/model.ts` with the types from the design's "Public API": `GoldenCode`, `GoldenDiagnostic`, `GoldenValue`, `Expectation`, `Scenario`, `GoldenSet`, `Difference`, `ScenarioResult`, `GoldenRun`, `LoadGoldenResult`. Types only, plus the constants `MINIMUM_SCENARIOS` (12) and `GOLDEN_ERROR_CODES` and `GOLDEN_WARNING_CODES` (the lists the design gives; `TOO_FEW_SCENARIOS` is the only warning), and `goldenSeverity(code)`.
    - Add a `makeGolden(code, file, message, parts?)` helper that sets `severity` from the code.
    - In `src/schema.ts`, change `function shown` to `export function shown`. Change nothing else there.
    - Write `src/golden/model.test.ts`: every code has the right severity (14 errors, 1 warning); `makeGolden` omits `id` and `field` when not given; `shown` still gives `0n` for a BigInt, `[value that cannot be shown]` for a cycle and `?` for a symbol (so the export changed no behaviour).
    - _Requirements: 10.4, 12.2_

  - [x] 1.2 Confirm that the YAML loader suits a golden file
    - Add a test in `src/golden/yaml.test.ts` that passes a golden-shaped text to `loadText` (a top-level `kb`, a `scenarios` list whose entries hold a `facts` mapping and an `expect.goals` mapping) and asserts it returns `ok: true` with no diagnostics, and that the raw value keeps each mapping's key order.
    - Add tests that a duplicate key inside a scenario, a non-string key, an alias, a file over 1 MiB and a nesting over 64 levels each give the same diagnostic as for a knowledge base.
    - If the first test fails because `loadText` reads a nested `facts` as the top-level `facts` context, make the context depend on depth (or a parameter with the existing default) in `src/load/yaml-load.ts`, keep every existing test passing, and say what changed in the task's pull-request note. If it passes, change no source.
    - _Requirements: 2.5_

- [ ] 2. Value checks
  - [x] 2.1 Implement `golden/values.ts`
    - `isCalendarDate(text)`: matches `^\d{4}-\d{2}-\d{2}$`, month 1 to 12, day 1 to the month's length, with the Gregorian leap rule. No `Date`.
    - `checkValue(def, value)`: returns `undefined` when the value fits the fact's type, else the type phrase for the message: `a boolean`, `a number` (finite), `a whole number of minor units` (money: `Number.isSafeInteger`), `a date written YYYY-MM-DD` (`isCalendarDate`), or `one of a, b, c` (enum, the fact's `options`). `-0` fits `number` and `money`.
    - `describeValue(value)`: `null` and `undefined` give `unknown`, a string prints as it is, a number or boolean prints as JSON, anything else goes through `shown`.
    - Write `src/golden/values.test.ts`: each type with a fitting and a failing value; `2024-02-29` fits, `2023-02-29`, `2024-13-01`, `2024-1-1` and `2024-02-30` do not; `1e21` is not a money value; `NaN` and `Infinity` are not numbers; an enum value outside `options` fails and the phrase lists the options in order; `describeValue` on `null`, `"x"`, `7`, `true`, a BigInt and a cycle.
    - _Requirements: 3.3, 3.4, 4.8_

  - [x] 2.2 Write the value-agreement property test
    - File `src/golden/values.props.test.ts`.
    - **Property 9: Accepted dates are real dates the engine accepts**
    - *For all* strings, `isCalendarDate` accepted implies the engine's `answer` on a `date` fact does not throw `INVALID_ANSWER`, and every ISO date the engine accepts is accepted. *For all* values and fact types, `checkValue` accepts only values that the engine's `answer` accepts for that type. Use a small knowledge base with one fact of each type, built with `compileText`.
    - **Validates: Requirements 3.3, 3.4**

- [ ] 3. Loader
  - [x] 3.1 Implement `golden/schema.ts` and `golden/load.ts`
    - `schema.ts`: the strict Zod schema from the design's grammar: top level `kb` and `scenarios` (non-empty), each scenario `id` (pattern `[A-Za-z0-9][A-Za-z0-9_-]*`), `title` (non-empty), optional `mode` (`consult` or `audit`, default `consult`), `facts` (a mapping), `expect` (a union of `{ ask }` alone and `{ goals, line_items?, needed?, fires? }`). Use `z.strictObject` at every level. A `superRefine` on the scenario reports `needed` in a `consult` scenario, `ask` in an `audit` scenario, and `ask` beside any other `expect` field, each naming the field and the mode. A `facts` value that is `null` is left to the checker; here a `facts` value must be a boolean, a finite number or a string, and `expect.goals` and `expect.line_items` values must be those or `null`.
    - Translate Zod issues into `SCHEMA_INVALID` diagnostics with fixed English text and never use Zod's own message text (the approach of `src/schema.ts`): `Field 'x' of scenario 'G-01' must be a string.`, `Unknown field 'x' in scenario 'G-01'. Allowed fields: id, title, mode, facts, expect.`, `Scenario 'G-01' is missing the required field 'title'.`, and the mode and `ask` messages. Set `id` to the scenario id where it is known, and `field` to the first path step.
    - `load.ts`: `loadGolden(text, file)` calls `loadText`, then the schema; `loadGoldenRaw(value, file)` calls the schema. Map `line_items` to `lineItems`. On any error return `{ ok: false, diagnostics }` and no set. Use `READ_ERROR`, `YAML_SYNTAX` and `SCHEMA_INVALID` from the `loadText` diagnostics unchanged, converted to `GoldenDiagnostic`.
    - Write `src/golden/load.test.ts`: the design's example parses to the expected `GoldenSet`; each `SCHEMA_INVALID` cause with its exact message (missing `kb`, empty `scenarios`, unknown top-level field, unknown scenario field, unknown `expect` field, bad `mode`, bad `id` such as `-x` and `a b`, empty `title`, `needed` in consult, `ask` in audit, `ask` with `goals`, a list where a mapping belongs); `mode` defaults to `consult`; invalid YAML gives `YAML_SYNTAX` with a line; the `facts` key order survives.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.2, 4.3, 4.4, 4.5, 4.7, 12.3_

  - [x] 3.2 Write the loader totality property test
    - File `src/golden/load.props.test.ts`.
    - **Property 7: Total** (loader part)
    - *For all* strings, `loadGolden` returns a result and does not throw. *For all* arbitrary raw values (wrong types, null, arrays for mappings, long strings, deep nesting, BigInt, symbol, function, cycles), `loadGoldenRaw` returns an error diagnostic or a valid set and does not throw. Build the generator the way `total.props.test.ts` does, with golden key names added.
    - Also assert here that a seed replay of the BigInt counterexample `{ kb: "x", scenarios: [{ id: "a", title: "t", facts: { f: 0n }, expect: { goals: {} } }] }` returns diagnostics.
    - **Validates: Requirements 10.1, 10.2**

- [ ] 4. Checker
  - [x] 4.1 Implement `golden/check.ts`
    - `checkGolden(set, kb, file)` returns `{ runnable, diagnostics }` and applies, per scenario in order, the fit checks of the design's table: `UNKNOWN_FACT` and `NOT_ASKABLE` for `facts`; `BAD_VALUE` through `checkValue` (and for a `null` in `facts`); `UNKNOWN_FACT` and `BAD_VALUE` for `expect.goals` and `expect.lineItems` (a line-item key must be a fact with a `role`); `SCHEMA_INVALID` on `expect.goals` naming the missing and the extra goals; `UNKNOWN_FACT` or `NOT_ASKABLE` for `ask` and for each name in `needed`; `UNKNOWN_RULE` for each id in `fires`. A scenario with any error is left out of `runnable`; the others are untouched. Give each diagnostic the scenario `id` and the `field` (`facts`, `expect.goals`, `expect.line_items`, `expect.ask`, `expect.needed`, `expect.fires`).
    - `duplicateIds(files)`: takes `{ file, set }[]` for one app in file path order and returns one `DUPLICATE_SCENARIO` diagnostic per later scenario, with the message `Scenario id 'G-01' is already used by scenario 3 of apps/x/golden/a.yaml.`; and the list of `(file, id)` pairs to drop from `runnable`.
    - Write `src/golden/check.test.ts` with one case per table row and exact messages, a scenario with two errors giving two diagnostics, the other scenario still runnable, and the `duplicateIds` cases (same file, two files, three uses).
    - _Requirements: 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.6_

- [ ] 5. Runner
  - [x] 5.1 Implement `runScenario` and `firedRules`
    - `golden/run.ts`: `runScenario(kb, scenario)` exactly as the design's pseudocode: fold `answer` over `facts` in both modes; `next` for consult and `audit` for audit; compare the outcome; the `outcome`, `ask`, `goals.<name>`, `line_items.<name>`, `needed` and `fires` differences with `describeValue` text; `firedRules(kb, session, facts)` walking `explain` trees; an `EngineError` becomes `status: "error"` with `engineError`. Compare `undefined` as `null`.
    - Write `src/golden/run.test.ts` with a small knowledge base compiled by `compileText` (a money fact with a rounded rule, a guarded rule and a fallback rule, a boolean check, an enum, and two goals): a passing consult scenario; a passing audit scenario with `needed`; a consult scenario that stops at a question (`ask`); a verdict where a question was expected and the reverse (`outcome`); a wrong goal; a missing and an extra line item; a wrong `needed` order; a `fires` id that did not fire; a scenario whose `answer` throws `INVALID_ANSWER` (status `error`, code and message kept); `-0` against `0`; a goal expected `null` that is unknown.
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.8_

  - [x] 5.2 Add the golden generators to the testkit
    - `src/testkit/golden.ts`: `recordScenario(kb, facts, mode)` that builds a `Scenario` from what the engine returns (the design's Property 1 recipe), and `goldenSetArb(kb)` that builds a `GoldenSet` of several recorded scenarios for a generated knowledge base with generated type-valid facts and ids `G-1`, `G-2` and so on. Export them from `src/testkit/index.ts`.
    - Write `src/testkit/golden.test.ts`: the generators return values that `checkGolden` accepts with no diagnostic on a fixed knowledge base, and `recordScenario` of an audit run has the audit's goals.
    - _Requirements: 11.1_

  - [x] 5.3 Write the record-and-replay property test
    - File `src/golden/replay.props.test.ts`.
    - **Property 1: Record and replay**
    - *For all* valid knowledge bases (passing `compileText`) and type-valid assignments from `answersArb`, in each mode, `runScenario(kb, recordScenario(kb, facts, mode))` has status `passed`, and `checkGolden` on the recorded set gives no diagnostic.
    - **Validates: Requirements 5.1, 5.2, 5.3, 4.2, 4.3, 4.4, 4.5, 11.1**

  - [x] 5.4 Write the mutation property test
    - File `src/golden/mutation.props.test.ts`.
    - **Property 2: Mutation is caught**
    - *For all* recorded verdict scenarios and each goal, replacing that goal's expected value with a different type-valid value (flip a boolean, add 1 to a number or money, pick another enum option or a different date, or swap `null` and a value) gives status `failed`, with exactly one difference whose field is `goals.<goal>`.
    - **Validates: Requirements 5.4, 4.8, 11.2**

  - [x] 5.5 Write the order-independence property tests
    - File `src/golden/order.props.test.ts`.
    - **Property 3: Scenario order does not matter** (statuses and fired rules per scenario id are the same for any permutation of the scenarios in `runGolden`)
    - **Validates: Requirements 5.6, 11.3**
    - **Property 4: Facts order does not matter** (`runScenario` on any permutation of the entries of `facts` of a consult scenario returns a deep-equal result)
    - **Validates: Requirements 11.4**
    - **Property 8: Deterministic and pure** (runner part: `runScenario` and `runGolden` called twice on the same input return deep-equal results, and neither mutates its input, checked by deep-freezing the scenario and the knowledge base)
    - **Validates: Requirements 5.7**

  - [x] 5.6 Implement `runGolden` and the failure messages
    - `runGolden(kb, scenarios, file)`: one fresh `runScenario` per scenario in order, and the `GoldenDiagnostic`s: `SCENARIO_FAILED` with the message `Scenario 'G-03' (Room rent over the limit) failed: <field> expected <x>, observed <y>; ...` in the order `outcome`, `ask`, `goals`, `line_items`, `needed`, `fires` (goals and line items in the knowledge base's order), and `ENGINE_ERROR` with `Scenario 'G-03' (...) stopped: the engine threw <CODE>: <message>.`. A passing scenario adds nothing.
    - Write `src/golden/run-golden.test.ts`: the exact failure line from the design; two failures in one scenario; an error scenario and a passing one in one run; the order of differences.
    - _Requirements: 5.4, 5.5, 5.6, 9.5_

- [ ] 6. Coverage
  - [x] 6.1 Implement `golden/coverage.ts`
    - `coverage(kb, kbFile, results, scenarioCount)` as in the design: `covered` is the union of `fired` over passed results; `RULE_NOT_COVERED` for each uncovered rule in the knowledge base's rule order, with `file` the KB_File path and `id` the rule id; `TOO_FEW_SCENARIOS` (warning) when `scenarioCount` is below `MINIMUM_SCENARIOS`.
    - Write `src/golden/coverage.test.ts`: none, some and all rules covered; a failed scenario covers nothing; an `ask` scenario covers nothing; 11 scenarios give the warning with the exact message and 12 do not; the warning is not an error.
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 6.2 Write the coverage property test
    - File `src/golden/coverage.props.test.ts`.
    - **Property 5: Coverage is exact**
    - *For all* generated golden sets, a rule id is in the `RULE_NOT_COVERED` diagnostics if and only if it is in no passed scenario's `fired`; the diagnostics follow the order of `kb.rules`; and replacing a passed scenario by a failed copy never adds a covered rule.
    - **Validates: Requirements 7.1, 7.2, 11.5**

- [ ] 7. The `dc golden` command
  - [x] 7.1 Add the `golden` command to `args.ts` and `discover.ts`
    - `args.ts`: `Command` gains `"golden"`; `parseArgs` accepts it with the rules of `validate` (so `--json` and any `-x` argument are usage errors); `USAGE` gains `  dc golden [path...]     run golden scenarios against the compiled knowledge bases`, and its path lines gain `apps/<app>/golden/<name>.yaml`.
    - `discover.ts`: add `GOLDEN_FILE = /^apps\/[^/]+\/golden\/[^/]+\.yaml$/` and `discoverGolden(paths, host)` returning `{ ok: true, root, files, wholeApps }`, where `wholeApps` lists the apps for which the run holds every Golden_File (a run with no path, or the `apps/<app>` directories passed). A path that matches no Golden_File is a usage error naming the expected forms. Do not change `KB_FILE` or `discover`.
    - Write `src/cli/golden-args.test.ts` and `src/cli/golden-discover.test.ts` with an in-memory `Host`: no path, a directory, a file, a file plus its directory, a path under `kb/` (usage error), a missing path, `--json`, an app with no `golden/` directory, a directory with a non-YAML file.
    - Write `src/cli/golden-discover.props.test.ts`.
    - **Property 6: Golden files do not change validation** (discovery part: *for all* generated trees with and without golden files, `discover` for validate and build returns the same files, none of them under `/golden/`, and `discoverGolden` returns none under `/kb/`)
    - **Validates: Requirements 1.1, 1.4, 11.6**
    - _Requirements: 1.1, 1.4, 8.1, 8.2, 8.5, 8.8_

  - [x] 7.2 Implement `cli/golden.ts` and the output
    - The handler follows the design's "The command" steps 1 to 7: discover; list and read the knowledge-base files of each app and `compileText` them, indexing by `raw.id` (decision 7); for each Golden_File read it with the same size and UTF-8 checks as `readKbFile` (`READ_ERROR`), `loadGolden`, find the knowledge base (`KB_NOT_FOUND`, `KB_AMBIGUOUS`, `KB_INVALID`), `checkGolden`; per app `duplicateIds` then `runGolden`; for whole-app runs `coverage` for each knowledge base that has a Golden_File. Never call `writeFile` or `makeDir`, and never read `kb/dist/`.
    - Sort by the key in the design (app, phase, file path, position, code). Print one line per diagnostic with `formatDiagnostic` (widen its parameter to the shared shape) and end with `formatGoldenSummary(files, run, passed, covered, rules, errors, warnings)`: `<F> files, <S> scenarios run, <P> passed, <C> of <R> rules covered, <E> errors, <W> warnings`. Exit 0 with no error, 1 with any.
    - `cli/run.ts` routes `golden` to this handler.
    - Write `src/cli/golden.test.ts` with an in-memory `Host` and the design's fixture app (as strings): a clean run prints only the summary; a failing scenario prints the exact line and exits 1; `KB_NOT_FOUND`, `KB_AMBIGUOUS` and `KB_INVALID` each stop the file's scenarios; a duplicate id across two files; golden files with no knowledge base in the app give `KB_NOT_FOUND`; an uncovered rule gives `RULE_NOT_COVERED` on the KB file and exit 1; 11 scenarios give the warning and exit 0; an explicit file path computes no coverage; a directory path does; no path and no golden files gives the all-zero summary and exit 0; the exact summary wording.
    - _Requirements: 1.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4, 9.6_

  - [x] 7.3 Write the command property tests
    - File `src/cli/golden.props.test.ts`.
    - **Property 6: Golden files do not change validation** (command part: `runCli(["validate"])` and `runCli(["build"])` on a generated tree return the same stdout, stderr, exit code and written files with golden files added to `apps/<app>/golden/`)
    - **Validates: Requirements 1.2, 1.3, 11.6**
    - **Property 8: Deterministic and pure** (command part: with a `Host` whose `writeFile` and `makeDir` throw, `runCli(["golden", ...])` never calls them and returns the same result twice)
    - **Validates: Requirements 1.5, 8.7**
    - **Property 10: Output is stable** (the printed lines are in the documented order whatever order the `Host` lists directories in; a clean run prints only the summary line; no absolute path, colour code or timestamp appears)
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6**
    - **Property 7: Total** (checker and runner part: *for all* generated knowledge bases and golden sets, including ones with faults injected into scenarios, `checkGolden`, `runGolden` and `runCli(["golden"])` do not throw, and the runner returns one result per runnable scenario)
    - **Validates: Requirements 10.3, 10.4**

- [ ] 8. Public API and bundle
  - [x] 8.1 Export the golden API and prove it needs no Node
    - `src/index.ts`: export `loadGolden`, `loadGoldenRaw`, `checkGolden`, `duplicateIds`, `runScenario`, `runGolden`, `coverage`, `MINIMUM_SCENARIOS`, the golden codes and the types `GoldenSet`, `Scenario`, `Expectation`, `ScenarioResult`, `Difference`, `GoldenRun`, `GoldenDiagnostic`, `GoldenCode`, `GoldenValue`, `LoadGoldenResult`.
    - Write `src/golden/exports.test.ts`: `expectTypeOf` lines for the exported types and function signatures, and a runtime check that each named export exists.
    - Write `src/golden/source-scan.test.ts`: every non-test file under `src/golden/` imports no `node:*` module, no `fs`, `path` or `process`, and no network module (Requirement 12, criterion 4 as a test of its own).
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 8.2 Extend the dist smoke test
    - In `src/dist-smoke.test.ts` (keep its explicit time limit), write a toy tree with one knowledge base and one golden file, build to a temporary directory, and spawn the bundle twice: `dc golden` on a passing scenario exits 0 and prints the summary line alone, and on a failing one exits 1 and prints the `SCENARIO_FAILED` line. Also run `dc validate` on the same tree and assert that it ignores the golden file. Clean up every temporary directory.
    - Confirm that `pnpm dc golden` works through the existing root script (pnpm appends the argument, as it does for `validate`), by running it once on the repository root with no golden files, expecting the all-zero summary and exit 0. If it does not forward the argument, stop and write a handoff note instead of editing the root script.
    - _Requirements: 8.1, 8.3, 8.4, 13.3_

- [ ] 9. Documentation and the agent prompt
  - [ ] 9.1 Add "Golden scenarios" to `docs/kb-format.md`
    - Ask the user to confirm this edit before making it (shared documentation). Add a section "Golden scenarios" with: where a golden file lives and why it is outside `kb/`; the file shape and the scenario fields; the `expect` block in its two forms; the value rules per fact type (money in minor units, dates `YYYY-MM-DD`, `null` for unknown); how a consult scenario and an audit scenario run; what "fires" and coverage mean; one worked example (the design's example, corrected against the finished code); the table of the 15 golden codes with severity, `id` and an example message; the summary line.
    - _Requirements: 13.1_

  - [ ] 9.2 Write the golden catalogue test
    - `src/golden/catalogue.test.ts`: every code in `GOLDEN_ERROR_CODES` and `GOLDEN_WARNING_CODES` appears in the new section of `docs/kb-format.md` with its severity; the worked example in the document loads with `loadGolden`, passes `checkGolden` against the document's own knowledge-base example, and passes `runGolden`. Read the file through Vite's `?raw` glob, as `kb-format-notes.test.ts` does.
    - _Requirements: 13.1_

  - [ ] 9.3 Update the knowledge-engineer agent and the `dc` usage line
    - In `.kiro/agents/knowledge-engineer.json`, change the prompt's last sentence to tell the agent to write golden scenarios in `apps/<app>/golden/`, to run `pnpm dc golden` until every scenario passes, and that every rule must fire in at least one scenario. Change nothing else in the file, and keep it valid JSON. Ask the user to confirm the edit first if a permission rule blocks it.
    - Confirm the `dc` usage text prints the `golden` line (done in task 7.1); add one line about `golden` to the kb-tools README section if the repository has one, and otherwise leave the usage text as the one-line description.
    - _Requirements: 13.2, 13.4_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise. Run `pnpm check` and `pnpm test:props` under Node 22 and confirm exit code 0. Run `pnpm dc validate` and `pnpm dc golden` on the repository and confirm each exits 0 (with no golden files yet, `dc golden` prints the all-zero summary).

## Notes

- Property tests are required here, not optional: the requirements name them (Requirement 11), and the mutation and record-and-replay properties are what stand in for a human reading every scenario.
- Each task references specific requirements for traceability. The checkpoint gives a final validation.
- Property tests validate universal properties; unit tests validate exact examples and edge cases.
- Tasks run strictly one at a time in the order listed. The dependency graph below therefore has one task per wave.
- Tasks 5.5 and 5.6 ran in the order 5.6, then 5.5, because Property 3 runs `runGolden`, which task 5.6 creates. Nothing else changed.
- The five departures from the first draft of the requirements (goal check in the checker, coverage on whole-app runs only, the fixed summary line, the `outcome` difference, coverage diagnostics on the KB file) were approved by the human and are now in the requirements. Tasks 4.1, 5.1, 6.1 and 7.2 build them.

## Handoff notes for Claude Code

These items belong to the Claude Code lane. They are recorded here so nothing is lost, and they are not tasks in this plan.

1. **Root `dc` script.** `pnpm dc golden` needs no root change if pnpm appends the argument, as it does for `validate`. Task 8.2 checks it. If it fails, the root script needs to forward its arguments.
2. **Playwright end-to-end tests.** For every golden scenario (build plan, Phase 3), import `loadGolden`, `checkGolden`, `duplicateIds` and `runScenario` from `@dead-certain/kb-tools`, or read the YAML directly. `ScenarioResult` and `GoldenRun` hold only strings, numbers and arrays, so they serialise. The scenarios do not exist until Phase 2.
3. **CI.** Add `pnpm run --if-present dc golden` after `dc validate` in `.github/workflows/ci.yml` once the first golden files exist, so Gate G2's golden check runs on every push.
4. **Git.** `apps/*/golden/*.yaml` must be committed. The Markdown-ignore rule does not touch YAML, so no `.gitignore` change is needed.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["5.1"] },
    { "id": 8, "tasks": ["5.2"] },
    { "id": 9, "tasks": ["5.3"] },
    { "id": 10, "tasks": ["5.4"] },
    { "id": 11, "tasks": ["5.5"] },
    { "id": 12, "tasks": ["5.6"] },
    { "id": 13, "tasks": ["6.1"] },
    { "id": 14, "tasks": ["6.2"] },
    { "id": 15, "tasks": ["7.1"] },
    { "id": 16, "tasks": ["7.2"] },
    { "id": 17, "tasks": ["7.3"] },
    { "id": 18, "tasks": ["8.1"] },
    { "id": 19, "tasks": ["8.2"] },
    { "id": 20, "tasks": ["9.1"] },
    { "id": 21, "tasks": ["9.2"] },
    { "id": 22, "tasks": ["9.3"] },
    { "id": 23, "tasks": ["10"] }
  ]
}
```
