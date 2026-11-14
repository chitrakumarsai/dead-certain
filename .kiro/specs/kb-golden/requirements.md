# Requirements Document

## Introduction

Golden scenarios are the regression tests of a knowledge base. Each scenario states a set of answers or collected facts and the verdict the engine must reach, so that a rule that misreads its clause, or a rule edited later, changes a scenario's result and fails the build. The build plan asks for at least 12 scenarios per knowledge base, with every rule firing in at least one, and Gate G2 asks that `pnpm dc golden` passes every scenario.

The kb-golden component adds three things to `packages/kb-tools` (package `@dead-certain/kb-tools`):

- **Format**: a YAML file at `apps/<app>/golden/<name>.yaml`, outside `kb/`, so that `dc validate` and `dc build` never read it.
- **Runner**: pure functions that check a golden file and run its scenarios against a compiled knowledge base with the Engine.
- **Command**: a new subcommand, `dc golden`, that runs every scenario and reports each failure with the expected and the observed value.

Boundary rules that shape every requirement:

- kb-golden uses the Engine's public API (`start`, `answer`, `next`, `audit`, `explain`) and the existing kb-tools Loader, Validator and Compiler. It redefines no Engine type.
- It adds no runtime dependency. `zod` and `yaml` are already approved in kb-tools. Any other dependency needs the human's approval first.
- A problem with a golden file, or a failed scenario, is a returned diagnostic, not a thrown exception.
- The golden files are written by Kiro's `knowledge-engineer` agent and the human. Playwright in the Claude Code lane reads the same files, so the loader and its types are exported (Requirement 12).
- This spec does not edit root configuration. The root `dc` script already forwards every subcommand to `bin/dc.mjs`; Requirement 13 records the one handoff.

---

## Glossary

- **KB_Tools**: The package `@dead-certain/kb-tools` in `packages/kb-tools`.
- **Dc_Command**: The `dc` command-line program, with the subcommands `validate`, `build` and, from this spec, `golden`.
- **Engine**: The package `@dead-certain/engine`.
- **Knowledge_Base**: A compiled `KnowledgeBase` value as declared in the Engine's `types.ts`.
- **KB_File**: A file matching `apps/<app>/kb/*.yaml`. It holds exactly one knowledge base.
- **Golden_File**: A file matching `apps/<app>/golden/<name>.yaml`. It holds the scenarios for one knowledge base.
- **Golden_Loader**: The part of KB_Tools that reads Golden_File text and returns a Golden_Set or diagnostics.
- **Golden_Runner**: The part of KB_Tools that runs a Golden_Set against a Knowledge_Base and returns one result per scenario.
- **Golden_Set**: The checked content of one Golden_File: the `kb` it names and its Scenarios.
- **Scenario**: One entry of the `scenarios` list: an `id`, a `title`, a `mode`, the `facts` given, and the `expect` block.
- **Mode**: `consult` or `audit`. A `consult` Scenario runs the Engine's consultation functions. An `audit` Scenario runs the Engine's `audit`.
- **Scenario_Facts**: The `facts` mapping of a Scenario, from Askable_Fact name to value.
- **Askable_Fact**: A fact without `derived: true`.
- **Derived_Fact**: A fact with `derived: true`.
- **Engine_Error**: An error the Engine throws, with a `code` and a `message`.
- **Error_Diagnostic**, **Warning_Diagnostic**: A Golden_Diagnostic with severity `error`, or `warning`.
- **Expectation**: The `expect` block of a Scenario. It holds `goals`, and optionally `ask`, `line_items`, `needed` and `fires`, as Requirement 4 defines.
- **Outcome**: What a run produced: a Verdict, or in `consult` Mode a Question.
- **Fired_Rule**: A rule whose id appears as `rule` on any node of the proof trees that the Engine's `explain` returns for each goal and each line-item fact of a Verdict Outcome.
- **Covered_Rule**: A rule that is a Fired_Rule in at least one Scenario of the app's Golden_Files.
- **Golden_Diagnostic**: A diagnostic with a `severity` (`error` or `warning`), a `code`, a `file`, a `message` and, where one applies, an `id` (a Scenario id or rule id) and a `field`.
- **Golden_Code**: A stable upper-case name for one kind of Golden_Diagnostic. The error codes are `READ_ERROR`, `YAML_SYNTAX`, `SCHEMA_INVALID`, `KB_NOT_FOUND`, `KB_AMBIGUOUS`, `KB_INVALID`, `DUPLICATE_SCENARIO`, `UNKNOWN_FACT`, `NOT_ASKABLE`, `BAD_VALUE`, `UNKNOWN_RULE`, `SCENARIO_FAILED`, `ENGINE_ERROR` and `RULE_NOT_COVERED`. The warning code is `TOO_FEW_SCENARIOS`. `READ_ERROR`, `YAML_SYNTAX` and `SCHEMA_INVALID` keep their meaning from kb-tools.
- **Minimum_Scenarios**: 12, the number of Scenarios the build plan asks for per knowledge base.
- **Dead_Certain**: The product this component belongs to.

---

## Requirements

### Requirement 1: Where golden files live, and what `validate` and `build` do with them

**User Story:** As a knowledge engineer, I want scenarios kept apart from the knowledge base, so that `dc validate` stays a check of the rules alone.

#### Acceptance Criteria

1. THE Dc_Command SHALL treat a file as a Golden_File only WHEN its path is `apps/<app>/golden/<name>.yaml` relative to the repository root, where `<app>` and `<name>` contain no `/`.
2. WHEN the user runs `dc validate` or `dc build`, THE Dc_Command SHALL read no Golden_File and SHALL report no diagnostic about one, whatever `apps/<app>/golden/` holds.
3. WHEN the user runs `dc validate` or `dc build` on a tree that has Golden_Files and no KB_File, THE Dc_Command SHALL print the summary line with 0 files checked, 0 errors and 0 warnings, and exit with status 0.
4. THE Dc_Command SHALL treat no file under `apps/<app>/golden/` as a KB_File, and no file under `apps/<app>/kb/` as a Golden_File.
5. WHEN `dc golden` runs, THE Dc_Command SHALL write no file, and SHALL not create `apps/<app>/kb/dist/` or any other directory.

### Requirement 2: The Golden_File shape

**User Story:** As a knowledge engineer, I want one small, strict file format, so that a typo in a scenario is an error and not a scenario that checks nothing.

#### Acceptance Criteria

1. THE Golden_Loader SHALL require a top-level mapping with exactly the fields `kb` (a string, the `id` of the knowledge base the file runs against) and `scenarios` (a non-empty list).
2. THE Golden_Loader SHALL require each Scenario to be a mapping with the fields `id` (a string), `title` (a non-empty string), `facts` (a mapping, possibly empty) and `expect` (a mapping), and the optional field `mode`.
3. WHERE `mode` is absent, THE Golden_Loader SHALL treat the Scenario as `consult`. IF `mode` is present and is neither `consult` nor `audit`, THEN THE Golden_Loader SHALL report `SCHEMA_INVALID`.
4. IF a Golden_File or a Scenario holds a field that this requirement and Requirement 4 do not list, THEN THE Golden_Loader SHALL report `SCHEMA_INVALID` naming the field, and SHALL not ignore it.
5. IF the text is not valid YAML, THEN THE Golden_Loader SHALL report `YAML_SYNTAX` with the line and column the `yaml` package gives. IF the file cannot be read, or its bytes are not valid UTF-8, or it is larger than 1 MiB, THEN THE Golden_Loader SHALL report `READ_ERROR` or `SCHEMA_INVALID` in the same way as the knowledge-base Loader.
6. THE Golden_Loader SHALL accept a Scenario `id` that matches `[A-Za-z0-9][A-Za-z0-9_-]*` and SHALL report `SCHEMA_INVALID` for any other.
7. IF two Scenarios in the same app, in one Golden_File or in different ones, have the same `id`, THEN THE Golden_Loader SHALL report `DUPLICATE_SCENARIO` on the later one, naming the earlier.

### Requirement 3: Facts, and the types of their values

**User Story:** As a knowledge engineer, I want every value in a scenario checked against the knowledge base, so that a scenario cannot pass by asserting something the engine would reject.

#### Acceptance Criteria

1. WHEN a Scenario's `facts` holds a name that is not a fact of the Knowledge_Base, THE Golden_Runner SHALL report `UNKNOWN_FACT` naming the Scenario and the fact.
2. WHEN a Scenario's `facts` holds a Derived_Fact, THE Golden_Runner SHALL report `NOT_ASKABLE` naming the Scenario and the fact.
3. WHEN a value in `facts` does not match the fact's type, THE Golden_Runner SHALL report `BAD_VALUE` naming the Scenario, the fact, the type and the value. A `boolean` is `true` or `false`. A `number` is a finite number. A `money` is an integer in minor units. A `date` is a string `YYYY-MM-DD` that names a real calendar day. An `enum` is a string among the fact's `options`.
4. THE Golden_Runner SHALL apply the same type rules to every value in `expect`, so that a `money` goal is an integer in minor units and a `date` value is a real calendar day.
5. WHEN a value is `null`, THE Golden_Runner SHALL accept it only inside `expect.goals` or `expect.line_items`, where it means the value is unknown, and SHALL report `BAD_VALUE` for a `null` in `facts`.
6. THE Golden_Runner SHALL run no Scenario that has an error under this requirement, and SHALL report the rest of the Scenarios as usual.

### Requirement 4: The Expectation

**User Story:** As a knowledge engineer, I want to say what a verdict must be, down to each deduction and the rule behind it, so that a scenario pins the behaviour I care about.

#### Acceptance Criteria

1. THE Golden_Loader SHALL require, in every Expectation that has no `ask`, `expect.goals`, a mapping from goal names to values, where a value is a fact value or `null`. THE Golden_Runner SHALL then require the mapping to hold exactly one entry for each goal of the knowledge base, so that a scenario cannot leave a goal unchecked, and SHALL report `SCHEMA_INVALID` on the field `expect.goals`, naming the missing and the extra goals, when it does not.
2. WHERE `expect.line_items` is present, THE Golden_Loader SHALL require a mapping from the fact name of a line item to its expected value or `null`, and THE Golden_Runner SHALL require it to match the Verdict's line items exactly: the same fact names, no more and no fewer.
3. WHERE `expect.needed` is present in an `audit` Scenario, THE Golden_Loader SHALL require a list of fact names, and THE Golden_Runner SHALL require it to equal the facts of the Verdict's `needed` questions, in order. WHERE it is absent, THE Golden_Runner SHALL require the Verdict's `needed` to be empty.
4. WHERE `expect.ask` is present in a `consult` Scenario, THE Golden_Loader SHALL require a fact name, and it SHALL mean that the Engine's `next` must return a Question for that fact. THE Golden_Loader SHALL then require `ask` to be the only field of `expect`, because an undecided consultation has no verdict to compare.
5. WHERE `expect.fires` is present, THE Golden_Loader SHALL require a list of rule ids, and THE Golden_Runner SHALL require each to be a Fired_Rule of that Scenario. It SHALL not require that no other rule fired.
6. IF `expect.fires` holds an id that is not a rule of the Knowledge_Base, THEN THE Golden_Runner SHALL report `UNKNOWN_RULE`.
7. IF `expect.needed` is given in a `consult` Scenario, or `expect.ask` in an `audit` Scenario, or `expect.ask` beside any other `expect` field, THEN THE Golden_Loader SHALL report `SCHEMA_INVALID` naming the field and the Mode.
8. THE Golden_Runner SHALL compare values by strict equality of the Engine's public values: money as integers, dates as the ISO string, enums as strings, `undefined` as `null`.

### Requirement 5: Running a Scenario

**User Story:** As a knowledge engineer, I want a scenario to run the engine the way an app does, so that a pass means the app would show the same verdict.

#### Acceptance Criteria

1. WHEN a `consult` Scenario runs, THE Golden_Runner SHALL call `start` on the compiled Knowledge_Base, then `answer` once for each entry of `facts` in the order written, then `next` once, and SHALL compare the Outcome with the Expectation.
2. WHEN an `audit` Scenario runs, THE Golden_Runner SHALL call `audit` with the Scenario's `facts` and SHALL compare the Verdict with the Expectation.
3. WHEN a Scenario has a Verdict Outcome, THE Golden_Runner SHALL call `explain` for every goal and every line-item fact, on the Session the run built or, in `audit` Mode, on a Session whose `answers` are the Scenario's `facts`, and SHALL record the Fired_Rules.
4. WHEN a Scenario fails, THE Golden_Runner SHALL report `SCENARIO_FAILED` naming the Scenario, and for each difference the field (`outcome`, `ask`, `goals.<name>`, `line_items.<name>`, `needed` or `fires`), the expected value and the observed value, so that the message alone says what changed. The field `outcome` SHALL be used when a verdict was expected and a question was observed, or the reverse.
5. IF the Engine throws an Engine_Error while a Scenario runs, THEN THE Golden_Runner SHALL report `ENGINE_ERROR` naming the Scenario and the Engine's error code and message, and SHALL carry on with the next Scenario.
6. THE Golden_Runner SHALL run each Scenario on its own Session, so that no Scenario's result depends on another Scenario or on the order of Scenarios.
7. THE Golden_Runner SHALL be deterministic: running the same Golden_Set against the same Knowledge_Base twice SHALL return deep-equal results.
8. THE Golden_Runner SHALL contain no network call, no clock read, no random value and no file access.

### Requirement 6: Matching a file to its knowledge base

**User Story:** As a knowledge engineer, I want a golden file to name the knowledge base it tests, so that a rename or a second knowledge base cannot make it run against the wrong one.

#### Acceptance Criteria

1. WHEN `dc golden` reads a Golden_File, THE Dc_Command SHALL find the KB_File of the same `<app>` whose compiled `id` equals the file's `kb`.
2. IF no KB_File of that app has that `id`, THEN THE Dc_Command SHALL report `KB_NOT_FOUND` on the Golden_File and SHALL run none of its Scenarios.
3. IF more than one KB_File of that app has that `id`, THEN THE Dc_Command SHALL report `KB_AMBIGUOUS` and SHALL run none of its Scenarios.
4. IF the matching KB_File has an Error_Diagnostic under `dc validate`, THEN THE Dc_Command SHALL report `KB_INVALID` on the Golden_File, saying to run `dc validate`, and SHALL run none of its Scenarios.
5. THE Dc_Command SHALL compile the knowledge base in memory with the kb-tools Compiler, so that the Scenarios run against exactly what `dc build` would write, and SHALL not read `apps/<app>/kb/dist/`.

### Requirement 7: Rule coverage

**User Story:** As a knowledge engineer, I want to be told which rules no scenario exercises, so that Gate G2's "every rule fires in at least one scenario" is checked and not assumed.

#### Acceptance Criteria

1. WHEN `dc golden` has run every Golden_File of an app, which is the case for a run with no path argument or with an `apps/<app>` directory and not for a run with explicit Golden_File paths, THE Dc_Command SHALL report `RULE_NOT_COVERED` for each rule of each knowledge base that has a Golden_File and is not a Covered_Rule, with `file` the KB_File path and `id` the rule id, in the order the rules appear in the KB_File.
2. THE Dc_Command SHALL compute coverage only from Scenarios that ran and passed, so that a failed Scenario covers nothing.
3. WHEN a knowledge base has fewer than Minimum_Scenarios Scenarios in total, in a run that computes coverage, THE Dc_Command SHALL report `TOO_FEW_SCENARIOS` with severity `warning` and `file` the KB_File path, naming the count and Minimum_Scenarios, and SHALL not count it toward a failing exit status.
4. WHEN a knowledge base has no Golden_File, THE Dc_Command SHALL report nothing about it, so that an app without scenarios yet does not fail `dc golden`.
5. THE Dc_Command SHALL count in its summary the rules of the knowledge bases whose coverage was computed, and the number of them covered.

### Requirement 8: The `dc golden` command

**User Story:** As a knowledge engineer and as a CI job, I want one command that runs every scenario, so that hooks, agents and CI run the same gate.

#### Acceptance Criteria

1. WHEN the user runs `dc golden` with no path argument, THE Dc_Command SHALL run every Golden_File under `apps/*/golden/` relative to the repository root.
2. WHERE the user passes one or more Golden_File paths or `apps/<app>` directories, THE Dc_Command SHALL run only those files, and for a directory SHALL run every Golden_File of that app and compute coverage for that app. WHERE the user passes a Golden_File path, THE Dc_Command SHALL run that file and compute no coverage for its app, unless the same run also passes the app's directory.
3. WHEN every Scenario passes and no Error_Diagnostic exists, THE Dc_Command SHALL exit with status 0, even when a Warning_Diagnostic exists.
4. IF one or more Error_Diagnostics exist, including a `READ_ERROR`, a `SCENARIO_FAILED` or a `RULE_NOT_COVERED`, THEN THE Dc_Command SHALL exit with status 1.
5. IF the subcommand is malformed, an argument is unknown, or an explicitly passed path matches no Golden_File, THEN THE Dc_Command SHALL print a usage message to standard error and exit with status 2.
6. WHEN the user runs `dc golden` with no path argument and no Golden_File is found, THE Dc_Command SHALL print the summary line `0 files, 0 scenarios run, 0 passed, 0 of 0 rules covered, 0 errors, 0 warnings`, and exit with status 0.
7. THE Dc_Command SHALL contain no network call and SHALL write nothing.
8. THE `dc` usage text SHALL list `golden` beside `validate` and `build`.

### Requirement 9: Output format

**User Story:** As a reader of the output, I want failures that say what to fix, in an order that does not change between runs.

#### Acceptance Criteria

1. THE Dc_Command SHALL print each Golden_Diagnostic on its own line in the form `<file>: <severity> <code> [<id>] <message>`, as `dc validate` does, where `[<id>]` is the Scenario id or rule id and appears only when there is one.
2. THE Dc_Command SHALL print a passing Scenario as nothing, so that the output of a clean run is the summary line alone.
3. THE Dc_Command SHALL print the Golden_Diagnostics in an order that depends only on the content of the files: by file path, then by the order of the Scenarios in the file, then by code, with `RULE_NOT_COVERED` after the Scenario diagnostics of its app and in rule order.
4. THE Dc_Command SHALL end the run with one summary line of the fixed form `<F> files, <S> scenarios run, <P> passed, <C> of <R> rules covered, <E> errors, <W> warnings`.
5. THE Dc_Command SHALL print a Scenario failure on one line, with the differences joined by `; ` in the fixed order `outcome`, `ask`, `goals`, `line_items`, `needed`, `fires`, each goal and line item in the order the knowledge base lists it.
6. THE Dc_Command SHALL print no color, timestamp, duration or absolute path.

### Requirement 10: Totality

**User Story:** As a maintainer, I want the golden tooling to be as total as the validator, so that no input file can crash the gate.

#### Acceptance Criteria

1. FOR ALL strings, THE Golden_Loader SHALL return a result and SHALL not throw.
2. FOR ALL arbitrary raw values, including wrong types, null, arrays in place of mappings, very long strings, deep nesting, a BigInt, a symbol or a function, THE Golden_Loader SHALL return at least one Error_Diagnostic or a valid Golden_Set and SHALL not throw.
3. FOR ALL Golden_Sets and all valid Knowledge_Bases, THE Golden_Runner SHALL return one result for each Scenario and SHALL not throw, whatever the Engine does.
4. FOR ALL Golden_Sets, THE Dc_Command's text for a diagnostic SHALL not throw when a value to be shown cannot be written as JSON.

### Requirement 11: Correctness properties

**User Story:** As a maintainer, I want the golden tooling proven by properties as well as by examples, so that it is right for inputs nobody wrote.

#### Acceptance Criteria

1. FOR ALL valid Knowledge_Bases and all type-valid assignments to their Askable_Facts, THE scenario that records the Engine's own result for that assignment SHALL pass (record-and-replay property), in both Modes.
2. FOR ALL passing Scenarios and all changes of one value in `expect.goals` to a different type-valid value, THE Golden_Runner SHALL report `SCENARIO_FAILED` naming that goal (mutation property).
3. FOR ALL permutations of the Scenarios in a Golden_Set, THE Golden_Runner SHALL return the same pass or fail for each Scenario, and the same Covered_Rules (order independence).
4. FOR ALL permutations of the entries of `facts` in a `consult` Scenario, THE Golden_Runner SHALL return the same result (the Engine's order independence, seen through the runner).
5. FOR ALL Golden_Sets, every rule id that `RULE_NOT_COVERED` names SHALL be a rule of the Knowledge_Base that appears in no passing Scenario's Fired_Rules, and every other rule SHALL appear in at least one.
6. FOR ALL Golden_Sets, `dc validate` run on the app SHALL return the same diagnostics whether or not the Golden_Files are present.

### Requirement 12: Library API for the other lane

**User Story:** As a Claude Code engineer, I want to read the golden files from Playwright with the same types the command uses, so that the end-to-end tests and `dc golden` cannot disagree about a scenario.

#### Acceptance Criteria

1. THE KB_Tools package SHALL export the Golden_Loader and the Golden_Runner as functions that take text, a file name and, for the runner, a Knowledge_Base, and return a result, so that tests and Playwright can call them without the command line.
2. THE KB_Tools package SHALL export the types `GoldenSet`, `Scenario`, `Expectation` and `ScenarioResult`, and the Golden_Codes, from its entry point.
3. THE Golden_Loader result SHALL separate success (a Golden_Set) from failure (the diagnostics) and SHALL return no partial Golden_Set on failure.
4. THE Golden_Loader and the Golden_Runner SHALL import no Node API, so that they run in the browser and in Playwright's Node process alike. Reading files stays in the Dc_Command.

### Requirement 13: Documentation, the agent and the handoff

**User Story:** As a knowledge engineer, I want the format written down where the agent already looks, and the agent told where scenarios go.

#### Acceptance Criteria

1. THE `docs/kb-format.md` file SHALL gain a section "Golden scenarios" that gives the file shape, the Scenario fields, the Expectation fields, the value rules, one worked example and the table of Golden_Codes. It SHALL not move the golden grammar into a new Markdown file, because Markdown outside the listed exceptions is not versioned.
2. THE `.kiro/agents/knowledge-engineer.json` prompt SHALL tell the agent to write the scenarios in `apps/<app>/golden/`, to run `pnpm dc golden` until every scenario passes, and that every rule must fire in at least one.
3. THE `pnpm dc golden` command SHALL work through the existing root `dc` script with no change to root configuration. IF the root script needs a change, THEN this spec SHALL name it as a handoff note to the Claude Code lane and SHALL not make it.
4. THE KB_Tools README section, or the `dc` usage text, SHALL describe `golden` in one line.

---

## Decisions

The human settled the five questions that the first draft left open. Each requirement already states the decision.

1. **An uncovered rule is an error.** `RULE_NOT_COVERED` is an error, so Gate G2's "every rule fires in at least one scenario" is checked by the tool (Requirement 7, criterion 1; Requirement 8, criterion 4).
2. **Fewer than 12 scenarios is a warning only.** `TOO_FEW_SCENARIOS` does not fail the run, because 12 is a content rule and not a property of the tool (Requirement 7, criterion 3).
3. **Every goal must be listed in `expect.goals`.** A scenario cannot leave a goal unchecked (Requirement 4, criterion 1).
4. **There is no `--json` output.** Playwright uses the exported loader and runner (Requirement 12).
5. **There is no separate `collected` block.** Collected facts go in `facts`, like any other non-derived fact (Requirement 3, criterion 2, and the definition of Askable_Fact).
