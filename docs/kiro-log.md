# Kiro log

Dated notes on what Kiro did in this build. The submission write-up is written from this file, so record only what happened, and say so where another tool or a person did the work.

For each entry note: which Kiro surface (IDE or CLI), which feature (spec, property test, hook, steering, agent, MCP), what happened, and anything it caught.

## 2026-11-12

### Setup (CLI 3.2.1, signed in with `kiro-cli login`, no API keys)

- Kiro wrote the six steering files in `.kiro/steering/` and the `knowledge-engineer` agent in `.kiro/agents/`.
- `.kiro/settings/mcp.json` was created by hand from a terminal command, not by Kiro.
- First attempt to load the agent failed with `agent "knowledge-engineer" not found, using "default"`, because the file did not exist yet. It loads now.

### Spec: `rule-language` (CLI, `/spec new`, Feature, Requirements-First)

- Requirements: 10 requirements in EARS, with round trip, total parser and three-valued logic as properties.
- Analyze Requirements asked 4 clarifying questions. Answers chosen: the generator must be shown to produce well-typed expressions; the printer raises on an unrecognised node; unknown error codes coerce to a documented fallback; the `Expr` type lands before the files that use it.
- Changes made during human review of the requirements:
  - Division by zero contradicted itself (unknown in one place, an error in another). Now always a `DIVISION_BY_ZERO` error.
  - Enum literals were bare identifiers, the same as fact names. Kiro first proposed `#"value"`, which YAML would read as a comment. Now single-quoted.
  - Added the YAML rule for expressions that begin with a quoted literal.
- Design: a decision the spec forced early was the compiled shape of an expression. `Expr` went from `unknown` to a five-variant tagged union in the contract file `packages/engine/src/types.ts`, approved by the human.
- Changes made during review of the design: `Expr` is defined in the contract file instead of an implementation file (the first version would not have compiled); extensionless imports; an explicit table of which type the parser gives each literal.
- Tasks: 27, run with required and optional tasks. Execution stalled once on a usage limit (HTTP 429) and resumed with "try again".

### What the property tests caught

- Round trip: the printer emitted chained comparisons such as `a == b < c`, which the parser rejects. The example tests had not caught it. The printer now parenthesises them.
- The printer's parenthesisation was also wrong for children of the same precedence.

### What the review after execution caught

Kiro listed six places where the code and the requirements disagreed. Four were fixed:

- A stray character such as `$` reported `INVALID_DATE`. Now `UNEXPECTED_TOKEN`.
- An unterminated `'abc` parsed as a valid enum, and an empty `''` was accepted. Both are now parse errors.
- `days_between` on non-dates returned `NaN`. Now a `TYPE_MISMATCH` error, guarded by a new property test that `evaluate` never returns `NaN` or `Infinity`. That test led to a new `NUMERIC_OVERFLOW` error code.
- Ordering comparisons now work on two dates.

Two were accepted as they are: `UNKNOWN_ERROR` is unreachable from parsed input, and there is no money literal.

### Result

`pnpm check` passes with 194 tests in 10 files. `pnpm test:props` passes with 11 property tests in 4 files.

### Spec: `inference-engine` (CLI, `/spec new`, Feature, Requirements-First)

- Requirements: 23 requirements in EARS. The seven demanded properties each have their own requirement, plus one that no internal symbol reaches a public value, and a 10 ms benchmark.
- Analyze Requirements asked 3 clarifying questions. Answers chosen: a question's clause is checked only when a question is returned; an unknown fact name and a wrongly typed answer are rejected by every function, not only `answer`.
- Kiro left five open questions. Human decisions:
  - Label: optional `label` added to `FactDef` in the contract, with a name derived from the fact as the fallback. Approved by both lanes.
  - Inapplicable derived facts stay `undefined`. The `kb-tools` validator will warn when a deduction has no fallback rule.
  - No contract change for "collected" facts. The Pre-Flight interface relabels them.
  - Money: a rule that gives a non-integer to a money fact throws `NON_INTEGER_MONEY`, so authors must round explicitly.
  - What-if: threshold probing added for number, money and date answers, capped at 6 candidates per fact. The first draft covered only yes/no and multiple-choice answers.
- Design: Kiro listed ten places where the design departs from the requirements text. Nine approved. One changed in review: `explain` must never fail where `next` succeeded, so a fact in an untaken branch that would raise an error appears in the proof with no value. Kiro found and fixed a contradiction its own first edit introduced.
- A decision the spec forced early: a replay link carries a fingerprint of the rules, so a link for older rules gives a clear `KB_MISMATCH` error instead of a different verdict.
- Tasks: 56, run one at a time with required and optional tasks. Kiro wrote handoff notes for the Claude Code lane instead of editing root config itself.

### What the property tests caught (`inference-engine`)

- No wasted questions (task 5.4): fast-check generated a knowledge base where `next` asks for a fact that cannot change any goal, because a guard further up the chain can never be true. The engine was behaving as designed: the guarantee is exact only when no rule is dead. The fault was in the test's generator, which let such knowledge bases through. Kiro stopped the run and asked instead of loosening the test. Decision: tighten the generator, keep the requirement as written.
- The same failure showed that fast-check's shrinking could exhaust memory and kill the test worker, so a failing property crashed the run instead of reporting. Fix requested: bounded generator sizes and a per-test timeout.
- Lesson for Phase 2: a rule whose condition can never be true is an authoring mistake, and rule review should look for it.
- Test-kit findings Kiro reported: a `.filter` on the knowledge-base generator hangs and runs out of memory, so the tests build valid knowledge bases directly; fast-check's clone symbol appears on generated values, so the "no internal symbol leaks" test checks JSON copies.

### Result (`inference-engine`)

- All 56 tasks complete. Verified by Claude Code under Node 22.14.0: `pnpm check` passes with 427 tests in 37 files, `pnpm test:props` passes with 62 property tests in 15 files, `pnpm e2e` passes.
- Benchmark (Kiro's figures): one consultation step has a median of about 0.13 ms on a 69-fact, 108-rule knowledge base, against a 10 ms limit.
- The only contract change is the optional `FactDef.label`. The engine has no runtime dependencies and no Node imports outside tests. SHA-256 and base64url are written in the engine and tested against Node's own.
- Kiro left the browser-build check and root config to the Claude Code lane, and recorded four notes for the `kb-tools` validator in `docs/kb-format.md`.
- Left as is: requirements 3.10 and 13.7 order validation errors differently. The engine follows 13.7, as approved in the design.

## 2026-11-13

### Spec: `kb-tools` (CLI, `/spec new`, Feature, Requirements-First)

- Requirements: 19 requirements in EARS, covering the loader, the Zod schema, the static checks, the expression type check, the compiler and the `dc` command.
- Changes made during human review of the requirements:
  - `dc validate` with no knowledge bases exits 0. The first draft exited 2, which would have failed CI until Phase 2.
  - Money rounding: sums, differences and whole-number multiples of money count as whole amounts. The first draft would have rejected `claimed - deductions` without a `round`.
  - The "validated knowledge base never makes the engine throw" property runs over all valid answers. The first draft used an empty fact set, which proves little.
- Analyze Requirements asked 7 clarifying questions. Answers chosen: a type error is hidden only when the operand that causes it already has an error; the dead-guard check recurses through `and` chains; one shared Vitest at the root. The analysis call aborted once on a network error, with the answers already saved.
- Design: Kiro found that Node cannot run the engine's TypeScript source directly, and proposed a hand-written build using an experimental Node function, run on every install. Changed in review to a Vite bundle rebuilt on each run, with `vite` approved as a dev dependency. Also changed: a new `READ_ERROR` code for unreadable files, where the draft reused `YAML_SYNTAX`.
- Tasks: 71, run one at a time with required and optional tasks. Kiro tested the unconfirmed Vite settings in the first task.

### What the tests caught (`kb-tools`)

- Compiler (task 11.2): `analyse()` returned a model even when the second phase of checks found errors, so an invalid knowledge base compiled as valid. Fixed.
- Reference checks (task 5.4): the fault generator broke a goal's only rule, which correctly produced two diagnostics where the property expected one. Kiro stopped and asked. Decision: fix the generator, keep the validator.
- Kiro asked for confirmation before editing the shared `docs/kb-format.md`, as the spec required.
- Found in the engine, outside this spec: `evaluate` reads inherited properties when given a plain object, so a fact named `constructor` would read wrongly. The engine's own calls use prototype-free objects, so the apps are not affected.

### Result (`kb-tools`)

- All 71 tasks complete. Verified by Claude Code under Node 22.14.0: `pnpm check` passes with 823 tests in 79 files, `pnpm test:props` passes with 111 property tests in 37 files, `pnpm build` and `pnpm e2e` pass.
- Claude Code ran the built `dc` on a toy knowledge base: it validated and compiled a correct one, and reported the three mistakes then planted in it (an unrounded money rule, a missing clause, an enum value not in the options) with exit status 1.
- Kiro edited nothing outside its lane. Root `dc` script, gitignore and lockfile review are handed to Claude Code.

### Other tools

- Claude Code scaffolded the workspace, CI and the placeholder site, wrote the first version of the contract types, and reviewed the Kiro spec output at each phase.

### Spec: `ui-kit` (CLI, written by Kiro, implemented by Claude Code)

- Requirements: 31 requirements, 563 lines. Design: 1,248 lines with 17 correctness properties, each tied to the requirements it validates. Tasks: 49, in the delivery order the requirements set, with three optional items last.
- Kiro tried its per-requirement detailing pass on Requirement 10 and chose not to apply it: it splits and renumbers criteria, which would break the requirement references the 17 properties carry. Agreed in review.
- Analyze Requirements was skipped for this spec. It had aborted on a network error during `kb-tools` and costs credits.
- Changes made during human review of the tasks: the date test runs once, with no re-run under other time zones and no child process (the design specifies a unit test plus a source scan); `formatDate` moved into the first formatting task so `formatValue` compiles; one garbled bullet in the import-boundary task rewritten.
- Kiro committed the spec (`73c34e5`) without running any task, as the plan requires.

### Fix: engine timing tests

- `consultation-step.perf.test.ts` failed once with a maximum of 68.5 ms against a 50 ms cap, right after a browser test run. Kiro kept the 10 ms median limit and replaced the hard maximum with a 99th-percentile check. It also gave the kb-tools 5,000-fact cycle test an explicit 60-second timeout. `pnpm check` passed three times in a row (`911a622`).
- From here on, Kiro ends each commit message with "Built with Kiro CLI". Earlier commits are left as they are.

### Other tools (`ui-kit`)

- Claude Code is implementing the `ui-kit` tasks in `packages/ui` and the `/kit` gallery. Sections 1 to 5 are done on `cc/1-ui-kit`, in draft pull request #4, with CI green.

### Hooks

- The Kiro CLI first declined to write hook files by hand, as `AGENTS.md` forbids, and asked for the IDE's hook feature. In a later CLI session it created all four with its own hook tool: Validate knowledge base and Engine properties (`PostFileSave` with path regexes), Stale rule check (an agent prompt on rulebook saves), and Gate check (on `Stop`). Committed as `439a282` and merged into the G1 branch.
- The Gate check hook failed on its first run because the shell defaulted to Node 18, and Vitest needs Node 22. Kiro traced it, reinstalled under Node 22 with the lockfile frozen, and the gate passed. The lasting fix is `nvm alias default 22`.
- Kiro works in its own folder, a git worktree at `../dead-certain-kiro` on `kiro/1-engine-specs`, so it never switches the branch Claude Code is working on.

### PR #4 review follow-ups (Nov 14)

- Kiro reviewed each Claude Code task on PR #4 against the ui-kit spec and pushed back where the code and spec disagreed: CheckRow forced Yes/No on any fact, WhatIfList lowercased every value, and a proof tree branch could be closed with no visible cue. Claude Code fixed the code; Kiro amended the spec to match what was built.
- A Bugfix spec, `kb-role-type-mismatch`, added `ROLE_TYPE_MISMATCH` to `dc validate`: a `role: check` fact must be boolean and a `role: deduction` fact must be money. The exploration test failed on the old code in all 10 cases and passed after the fix. The change broke 24 existing tests whose generator built wrongly typed role facts; Kiro added a task mid-run to fix the generator, with no assertions changed.
- Kiro reconciled the inference-engine and rule-language specs so both record the `types.ts` consent (PR #4, comment 6865345893), and pinned fast-check 4.10.2 in `tech.md`.
- A partial dependency install in Kiro's worktree made `pnpm check` fail with 713 type errors outside kb-tools. A clean reinstall under Node 22 fixed it.

### Review of ui-kit tasks 9.1 and 9.2 (2026-11-14)

- Kiro reviewed `ef5b650` (fixture audit, `claimFormat`) and `a61baff` (static screens 1 to 3) against the `ui-kit` spec, plus `693e939`, which adds the review and log duties to `AGENTS.md`. Review posted on PR #4.
- Verified locally under Node 22.14.0: `vitest run` passes 1,153 tests in 104 files, and the Playwright runs of `kit.spec.ts`, `kit-app-shell.spec.ts` and `kit-screens.spec.ts` pass 120 tests across the four projects.
- Accepted two deviations and amended the spec to match the code: each screen is its own page, `kit/screen.html?screen=<name>`, shown in the gallery in an inert iframe, and a preview frame turns `focus()` into a no-op so it cannot pull the gallery's focus. The `design.md` layout and static-screens section, requirement 25.2 and tasks 9.2 and 9.3 now say so.
- Raised on the PR: no screenshot evidence for either task is attached yet.
- Two of three `pnpm check` runs failed in the kb-tools property tests with 5,000 ms timeouts, while the machine's load average was about 14 on 8 cores. The same tests pass alone and in three later full runs. No fix made, since it did not reproduce on a quiet machine. A Bugfix spec follows if it recurs.
- Task checkboxes in `ui-kit/tasks.md` are still unticked for every completed task. Kiro left them for the evidence to be attached first.

### Decision: the deciding clause shows once in the proof (2026-11-14)

- Requirement 18.20 had each node that cites `decidingClause` quote the clause, so three rules citing clause 4.2 gave three quotes. The build plan's X-ray wireframe shows the clause once, after the tree.
- Kiro chose once. A repeated quote buries the proof, and a quote inside a collapsed branch is hidden when it matters most. A tree may hold only treeitems and groups, so the single quote sits beside the `role="tree"` element, not in it.
- Amended requirement 18.20, the `ProofTree` section of `design.md` and task 8.1 (with a Playwright check for exactly one quote, outside the tree, still visible when branches close). The code in `ProofTree.tsx` is Claude Code's lane and is not changed; the change is requested on PR #4.

### Review of ui-kit task 9.3 (2026-11-14)

- Kiro reviewed `e331d30` (static screens 4 to 6: X-ray open, Pre-Flight report, stale link) against requirement 25. Review posted on PR #4. Under Node 22.14.0, `vitest run` passes 1,153 tests in 104 files, and the Playwright runs of `kit.spec.ts` and `kit-screens.spec.ts` pass 124 tests across the four projects.
- Accepted the scan-line clip, a fix for a real overflow bug (the page was 1,384 px wide at 1280). Amended `design.md` to record the clip and to list `preflightScreens.tsx`.
- Asked Claude Code for two changes: show the inline question only on the check whose fact it asks about, and replace the fixed 700 ms wait in the overflow test with a wait on the scan line. Evidence screenshots for 9.1 to 9.3 are still missing, so the checkboxes stay unticked.
- Open question for the human: should the deciding ClauseQuote appear once (the topmost node citing it) or under every node, as 18.20 says today? On the X-ray screen, clause 4.2 prints three times.
- `git merge --ff-only origin/cc/1-ui-kit` failed because the branch held Kiro's own review commit. Kiro used a normal merge.

### Review of ui-kit task 8.1 rework, 9.3 follow-ups and screenshot evidence (2026-11-14)

- Kiro reviewed `5a87085` (deciding clause once, Pre-Flight question on its own check, overflow test waits for the scan line) and `18fec55` (CI "screenshots" artifact). Review posted on PR #4.
- Evidence came from the "screenshots" artifact of CI run 43581590262, green on `18fec55`: 26 images at each of 390, 768 and 1280 px. Kiro read the X-ray screen at 390 and 1280 px and the Pre-Flight screen at 768 px. Locally, `pnpm check` passes 1,153 tests, and the Playwright runs of the screens, proof tree, X-ray stage and evidence specs pass 115 tests with 5 skipped (the evidence specs skip the reduced-motion project).
- Accepted all four changes. The deciding clause now matches amended 18.20: one quote after the tree, outside `role="tree"`, visible with every branch closed, on a proof where three rules cite 4.2. Added requirement 25.6 and design question Q15 for the app-supplied map from a check to the input fact its question asks for.
- Ticked tasks 8.1, 9.1, 9.2 and 9.3 in `ui-kit/tasks.md`: code reviewed, tests green, evidence attached. Earlier tasks stay unticked until Kiro has reviewed each against its evidence.
- Open: the Pre-Flight map has one entry for the fixture. The Pre-Flight app spec must derive the real map from its knowledge base.

### Review of ui-kit task 9.4, and the `kb-props-timeout` Bugfix spec (2026-11-14)

- Kiro reviewed `518dd6d` (`e2e/kit-matrix.spec.ts`, the specimen matrix as data) against task 9.4 and requirement 24. CI run 43582996925 is green on `be9acf9`. Locally the matrix spec passes 12 tests across the four projects, and `pnpm check` passes 1,153 tests. Evidence is the run's "screenshots" artifact, 26 images at each width. Review posted on PR #4.
- Accepted 9.4 and ticked it. Amended `design.md` so the matrix's specimen ids are the ones in `kit-matrix.spec.ts`. Asked Claude Code to add `film-sheet` to the film check, and noted that the "one-line note" check only requires non-empty text. Neither blocks.
- Bugfix spec `kb-props-timeout` (`bugfix.md`, `design.md`, `tasks.md`): `compile-json.props.test.ts` timed out once at 7.5 s against the 5 s default under the parallel suite. Kiro reproduced it with 40 busy loops: the first test took 5.2 s and timed out in one run, and passed at 4.96 s in another. Run alone it takes 0.65 s.
- Fix: an explicit 60 s limit on both tests in that file, the same as `cycles.test.ts` and `dist-smoke.test.ts`. Kiro rejected shrinking the generator because it weakens Property 5. Under the same load, five runs took 4.9 to 5.4 s and all passed, where three would have failed at 5 s. `pnpm check` passes.
- Not fixed, in Claude Code's lane: 23 other kb-tools `*.props.test.ts` files carry the same 5 s limit, and 13 of them timed out in the earlier loaded runs. One `testTimeout` line in the root `vitest.config.ts` would cover them. Recommended on PR #4.
- This session had no spec-creation tool, so Kiro wrote the three spec files directly in the format of `kb-role-type-mismatch`. It left out `.config.kiro` and `tasks.meta.json`, which are Kiro-generated metadata and are not Kiro's to invent.

### Bugfix spec `kb-validate-never-throws`, and review of ui-kit task 9.5 (2026-11-14)

- Bugfix: `validateRaw` threw `Do not know how to serialize a BigInt` on `{"facts":{"":{"type":0n}}}`, from `shown()` in `schema.ts`. Property 1 found it with seed -646317260 (run 102 of 200). Kiro first added the seed replay to `total.props.test.ts`, and it failed on the old code with that counterexample. `shown` now prints a BigInt as digits plus `n`, and prints `[value that cannot be shown]` when `JSON.stringify` throws (nested BigInt, cycle, throwing getter or `toJSON`). Strings, JSON-writable values, and `?` for `undefined`, symbols and functions are unchanged. Four unit tests in `schema.test.ts` cover the counterexample, the unwritable values, symbol and function, and unchanged output. Two of them fail on the old code. `pnpm check` passes 1,158 tests. Rejected a catch-all around `describeIssue`, which would hide the bug class.
- Review: `e025301` (root 60 s `testTimeout`), `a705bc9` (gallery sets `data-kit-ready`, the e2e fixture waits for it) and `6d251dd` (task 9.5, `kit-sweep.spec.ts`). CI run 43597196793 is green on `6d251dd`. Locally, the sweep, kit, ledger and app-shell specs pass 195 tests (21 skipped by design), and `pnpm check` passes. Evidence: the run's "screenshots" artifact, 26 images per width. Kiro read the Ledger section and the verdict screen at 390 px. Review posted on PR #4.
- Accepted all three, ticked 9.5, and amended the spec to match: `data-kit-ready` and the 44 px gallery links, `data-hit-area` on Ledger rows, the focused skip link size, and 9.5's wording (200% zoom as a 640 px viewport, accessible name instead of `aria-labelledby` or `<label>`, axe left in the per-component specs). The `kb-props-timeout` design now records that Claude Code made the root change.
- Kiro found no bug in the sweep. One caveat remains: it skips `inert` and `aria-hidden` ancestors, so an interactive element wrongly hidden that way would escape it.

### Review of ui-kit task 9.6, and verification of every required task (2026-11-14)

- Kiro reviewed `7b98605` (the size budget, with the X-ray develop in its own on-demand chunk). Accepted the owner's choice and amended the spec: requirement 20.10 and a new 20.13, the `Kit_Bundle` definition, 28.11 and 29.9, the design (motion rationing, develop, budgets, performance notes) and tasks 4.8, 8.3, 9.6 and the Motion working rule. Measured: main bundle 40.6 kB of 50 kB gzipped, develop chunk 37.5 kB. An app that shows the stage downloads both (about 78 kB) because the chunk loads when `XrayStage` mounts, not on first open. The chunk has no cap of its own; suggested to Claude Code, not required.
- Verified the unticked required tasks (1.1 to 7.7, 8.2 to 8.5, 9.6) against their code, their tests and the "screenshots" artifact of CI run 43621706431, green on `7b98605`: 26 images at each width. Locally, `pnpm check` passes 1,158 tests, `pnpm e2e` passes 850 tests (26 skipped by design) and `pnpm build` emits `kit/`, `kit/screen.html` and `kit/shell.html`. Kiro read the X-ray screen at 768 px and the X-ray stage section at 1280 px. Checked for every task that the files it names exist, that each of its tests and Playwright checks has a counterpart in the suite, that each of the 18 components has its `expectTypeOf` line, and that Properties 1 to 9, 11 to 13 and 18 have tests.
- Ticked 40 sub-tasks and the parents 2 to 7 and 9. Not ticked, with what is missing: 1.1, because the PR description does not record the chosen versions and the `context7` source that the task requires; 8.4, because no Playwright check asserts that the rail stacks above the content below 1024 px. Kiro confirmed by a throwaway probe that the behaviour holds (rail above the content at 390 and 768 px, beside it at 1280 px), so only the test is missing. Section 11 is untouched, and so are 8 (it holds 8.4), 10 and 1.
- Smaller points, not blocking: the Property 18 test lacks its `// Feature: ui-kit, Property 18` comment; Properties 10 and 14 to 17 are covered by Playwright and unit checks without that comment, which the task text asks only of fast-check files; no test names `headingRef` directly, though the X-ray stage tests use it to focus the heading.

### Re-check of ui-kit tasks 1.1 and 8.4, and the task 10 checkpoint (2026-11-14)

- Task 8.4: `4f6ae9f` adds a check to `kit-app-shell.spec.ts` that the rail slot (now marked `data-rail-slot`) ends above `main` and shares its left edge below 1024 px, and ends left of `main` on the same row from 1024 px. It passes in all four projects, and it covers the case Kiro's earlier probe showed to be true. Ticked 8.4 and parent 8. The same commit added the missing Property 18 comment.
- Task 1.1: the PR #4 description now has the pinned-version table. Kiro compared its 21 rows with the `package.json` files of the root, `packages/ui` and `apps/site`: no mismatch, no `^` or `~`. Commit `823a9f3` does hold the lockfile change (+1,017 lines). The `context7` library ids are Claude Code's record and Kiro cannot check them. Ticked 1.1 and parent 1.
- Task 10: all four conditions hold. CI run 43623062587 is green on `4f6ae9f`, with `pnpm check`, `dc validate`, `pnpm e2e` and `pnpm build` each succeeding. Locally, `pnpm check` passes 1,160 tests in 105 files. Sections 1 to 9 are fully ticked. The PR lists the pinned versions. `types.ts` differs from `main` through only two Kiro-lane commits, `3b386f4` and `3c440d4`. Ticked 10.
- Left open: section 11, the optional items, as agreed. The PR description's develop chunk size, 37.4 kB, is the measured 37.5 kB rounded down.

### Gate G1 closed (2026-11-14)

- Kiro pulled `main` (`375d950`) onto a new branch, `kiro/gate-g1-close`, since `kiro/1-review-fixes` is fully merged. PR #4 merged as `ab0a6ed` and PR #5 as `375d950`. CI on `ab0a6ed` failed in `pnpm e2e` (the skip-link race), and PR #5 fixed it: CI on `375d950` is green, its deploy job succeeded, and `https://chitrakumarsai.github.io/dead-certain/kit/` answers 200. Locally on `main`, `pnpm check` passes 1,160 tests in 105 files.
- The "Update tasks" hook does not exist. `.kiro/hooks` holds four hooks (Validate knowledge base, Engine properties, Stale rule check, Gate check), and none of them is called that. Kiro did not create one. "Update tasks" is the name of an action in the Kiro IDE's spec editor, so it can only be run there.
- Checked what Phase 2 needs and found four gaps, reported to the human:
  1. There is no golden-scenario format and no runner. `docs/kb-format.md` and `kb-tools` have none, yet the plan has the agent write `apps/claim-check/kb/golden.yaml` and Gate G2 asks that every scenario pass. `dc` takes every `apps/*/kb/*.yaml` as a knowledge base, so a `golden.yaml` placed there would be validated as one and fail.
  2. `.kiro/settings/mcp.json` starts `@dead-certain/mcp`, which does not exist until Phase 5. The `knowledge-engineer` agent has `includeMcpJson: true`, so it will try to start that server.
  3. Markdown stays out of git by the owner's instruction (`.gitignore`, `*.md`, with exceptions for `README.md`, `AGENTS.md`, `CLAUDE.md`, `.kiro/**` and `.claude/**`). So `docs/BUILD_PLAN.md` and this log are not in git. `docs/kiro-log.md` is a symlink in Kiro's worktree to the untracked file in the main checkout, which means no log entry written so far was ever committed or pushed. Fresh clones and CI have neither file.
  4. The rulebooks are the first task and need the human: the sample policy and the Pre-Flight checklist.

### Phase 2 starts: the `kb-golden` spec, requirements phase (2026-11-15)

- PR #6 versioned this log, so Kiro deleted the `docs/kiro-log.md` symlink in its worktree (its content matched the tracked file line for line), pulled `main` (`3f2715b`) onto `kiro/2-golden-spec`, and deleted the empty `kiro/gate-g1-close` branch. From now on each entry is committed with the session's work.
- Human's decisions on the gate G1 report: golden scenarios approved, MCP server to be disabled, rulebooks to wait for the human's content.
- Spec `kb-golden` (Requirements-First), requirements written in `.kiro/specs/kb-golden/requirements.md`: 13 requirements and five questions for the human. Scenarios live in `apps/<app>/golden/*.yaml`, outside `kb/`, so `dc validate` and `dc build` never read them. Each file names its knowledge base by `kb` id. A scenario is a consult run (`start`, `answer`, `next`) or an audit run, and its `expect` block must list every goal, so none goes unchecked. `dc golden` compiles the knowledge base in memory, runs every scenario on its own session, and reports a rule that no passing scenario fires as `RULE_NOT_COVERED`. The loader and runner are pure and exported, so Playwright can read the same files. Properties: record-and-replay, mutation, order independence, and coverage consistency.
- Stopped after the requirements phase, as the human asked. Design and tasks wait for review.
- **Blocked: the MCP change.** A permission rule (`kiro-scope`) denies Kiro's write to `.kiro/settings/mcp.json`, and the human did not reject it. Kiro did not work around it with a shell edit. The `dead-certain` server is still enabled and still points at the missing `@dead-certain/mcp`. The human needs to set `"disabled": true` on it, or lift the rule for that file.
- `docs/kb-format.md` is the only tracked Markdown in `docs/` that holds a grammar, so the golden format goes there as a new section (Requirement 13) and not in a new `.md` file, which `.gitignore` would exclude.

### `kb-golden`: decisions recorded, design written (2026-11-15)

- The human answered the five questions on the requirements: an uncovered rule is an error; fewer than 12 scenarios is a warning only; every goal must be listed in `expect.goals`; no `--json`; no separate `collected` block. Kiro removed the questions from `requirements.md` and recorded them as a Decisions section. The requirements text already matched all five answers.
- The human said they disabled the `dead-certain` MCP server by hand on `kiro/2-golden-spec`. `git pull` found nothing new on that branch, `origin/kiro/2-golden-spec` holds only Kiro's own commit, and `.kiro/settings/mcp.json` in both worktrees still reads `"disabled": false`. The edit is therefore not on the remote. Kiro did not make it, because the `kiro-scope` rule still denies the write.
- Design written in `.kiro/specs/kb-golden/design.md` (402 lines): pure core (`loadGolden`, `checkGolden`, `runScenario`, `runGolden`, `coverage`, `duplicateIds`) and a thin `dc golden` shell, a strict Zod grammar, a scenario run built only on the engine's public API with one fresh session each, exact messages for every code, and ten correctness properties (record and replay, mutation, order independence for scenarios and for facts, exact coverage, validate unaffected, totality, determinism, date and value agreement with the engine, stable output).
- Five departures from the requirements text are marked "Open? Yes" for the human: the goal-set check moves from loader to checker, coverage is computed only on whole-app runs, one fixed summary line replaces three partial ones, an `outcome` difference is added for question-versus-verdict mismatches, and coverage diagnostics point at the knowledge-base file. Decisions 1 to 10 hold the rest.
- Checked while designing: kb-tools' source scan already covers a new `golden/` directory (no Node API, no `Date`, no network), and `pnpm dc` appends its arguments, so `dc golden` needs no root change.
- Stopped after the design phase, as the human asked. Tasks wait for review.
