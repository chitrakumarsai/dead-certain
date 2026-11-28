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

### `kb-golden`: departures approved, tasks written (2026-11-15)

- The human approved all five design departures. Kiro marked them "Approved" in `design.md` (the status column replaces "Open?") and amended the requirements to match, so spec and design agree: the goal-set check is in the Golden_Runner's fit check (4.1), `outcome` joins the failure fields (5.4, 9.5), coverage and the too-few warning belong to whole-app runs and name the KB file (7.1, 7.3, 8.2), and the summary line has one fixed form (7.5, 8.6, 9.4).
- Pulled `kiro/2-golden-spec`: the human's commit `023c439` is there, and `.kiro/settings/mcp.json` has `"disabled": true` for `dead-certain` (`context7` is still enabled). Kiro's earlier note that the edit was missing was right at that time; the commit arrived after.
- Tasks written in `.kiro/specs/kb-golden/tasks.md`: 10 sections, 23 sub-tasks, one task per wave. The order is types and `shown` export, YAML loader check, value checks, loader, checker, runner (with the record-and-replay, mutation and order properties), coverage, the `dc golden` command, exports and the dist smoke test, documentation and the agent prompt, then the checkpoint. All ten correctness properties are assigned to a task, each with a `// Feature: kb-golden, Property N` rule.
- Two edits need the human's confirmation when their tasks run: the "Golden scenarios" section of the shared `docs/kb-format.md` (9.1), and the prompt in `.kiro/agents/knowledge-engineer.json` (9.3), which a permission rule may block as it did `mcp.json`.
- Handoff notes for Claude Code: Playwright reads the exported loader and runner; add `dc golden` to CI after the first golden files exist; no root script change is expected.
- Stopped before running any task, as the human asked.

### `kb-golden`: tasks 1.1 to 8.2 run (2026-11-15)

- The human approved the tasks and asked for all of them to be run one at a time, stopping for two confirmations: the `docs/kb-format.md` edit (9.1) and the agent prompt (9.3). Kiro ran 1.1 to 8.2, which is every task up to the first confirmation, and stopped before 9.1.
- Built in `packages/kb-tools/src`: `golden/` (types, value checks, the strict Zod schema and loader, the checker with `duplicateIds`, `runScenario` and `runGolden`, `coverage`, the public index), `cli/golden.ts` (the `dc golden` command), the `golden` command in `args.ts`, `discover.ts`, `run.ts` and `format.ts`, and test support in `testkit/` (a fixture knowledge base with 11 rules, twelve recorded scenarios that cover all of them, `recordScenario`, `goldenSetArb`, `goldenYaml`). `pnpm check` passes 1,363 tests in 127 files. `pnpm dc golden` works through the unchanged root script, and `--json` exits 2.
- All ten properties have tests. The value-agreement property (Property 9) caught a real mismatch on its first run: the engine accepts years 0001 to 9999, and the first draft of `isCalendarDate` accepted `0000-01-01`. It is fixed, with a unit case for it.
- Departures from the written plan, none changing behaviour the human approved:
  - Tasks 5.5 and 5.6 ran in the order 5.6, 5.5, because Property 3 runs `runGolden` (noted in `tasks.md`).
  - A `null` in `facts` is let through by the loader so that `checkGolden` can report it as `BAD_VALUE` (Requirement 3.5); `Scenario.facts` is therefore typed `Record<string, GoldenValue>`, where the design's snippet says "no null values". The engine rejects a `null` answer as `INVALID_ANSWER` if an unchecked scenario reaches `runScenario`. `design.md` is untouched, so its snippet is now slightly behind; the human can have it amended.
  - `loadText` and `loadTextLocated` take an optional third argument, the subject of the empty-file message, defaulting to the knowledge-base wording, so a golden file reads "A golden file is a YAML mapping". Every existing test passes unchanged.
  - A line-item key that has no `role` is reported as `UNKNOWN_FACT` with its own message, since the design's table lists no code for it.
  - An explicit golden file path that does not exist is a usage error (exit 2), as Requirement 8.5 says, where `dc validate` reports a missing explicit file as `READ_ERROR`.
- Stopped for confirmation of task 9.1: the new "Golden scenarios" section of the shared `docs/kb-format.md`.

### `kb-golden`: tasks 9.1 and 9.2 run, design amended, two questions answered (2026-11-15)

- The human approved the `docs/kb-format.md` edit. Task 9.1 added the "Golden scenarios" section at the end of the document: location and why it is outside `kb/`, the file and scenario fields, the two forms of `expect`, value rules per fact type, how consult and audit scenarios run, what "fires" and coverage mean, a worked example (a knowledge base and a four-scenario golden file), the summary line, the table of the 15 golden codes with notes. The section has its own heading, so the existing catalogue test, which reads only the "Diagnostic codes" section, is unaffected.
- Task 9.2 added `src/golden/catalogue.test.ts`: the table lists exactly the 15 codes with the right severities; the example's knowledge base compiles; its golden file loads, fits, passes all four scenarios, covers the three rules and gives the one warning; `dc golden` prints exactly the two lines the section says; and twelve of the example messages in the table are checked word for word against what the code prints. `pnpm check` passes.
- `design.md` amended so spec and code agree: `Scenario.facts` is `Record<string, GoldenValue>` with `null` allowed and reported as `BAD_VALUE` by `checkGolden`; dates are valid in years 0001 to 9999; the loader note says the nested-`facts` check is a test and describes the optional subject parameter of `loadText`; the line-item row names its own message; `discoverGolden` returns `wholeApps`.
- Questions the human asked:
  1. **Which agent is this session?** Kiro's default agent in the Kiro CLI, in "vibe" mode with the model set to Auto (from the session's `session.json`: `agentMode: vibe`, `modelId: auto`). It is not the custom `knowledge-engineer` agent. No custom agent is selected in this session.
  2. **Is `kb-golden` registered with the spec tool?** No. This session has no spec tool: `session.json` shows `specWorkflow: quick`, `specPlanEnabled: false`, `workflowsEnabled: false`, and no spec-creation function is available. Kiro wrote `requirements.md`, `design.md` and `tasks.md` as plain files, so the folder has no `.config.kiro`, which the spec tool generates with a spec id. The same holds for `kb-props-timeout` and `kb-validate-never-throws`. The older specs (`rule-language`, `inference-engine`, `kb-tools`, `ui-kit`, `kb-role-type-mismatch`) have one. Kiro did not write a `.config.kiro` by hand, since that would invent the tool's own record. Effect: the files work, but the IDE's Specs panel may not list the three specs or track their task status. To register them, open each folder in the Kiro IDE and let it create the spec, or have the human run the spec workflow there; that is the human's call.
- Stopped for confirmation of task 9.3: the prompt in `.kiro/agents/knowledge-engineer.json`.

### `kb-golden` complete: task 9.3 and the final checkpoint (2026-11-15)

- The human approved task 9.3 with the proposed sentence. The write to `.kiro/agents/knowledge-engineer.json` was not blocked by a permission rule. The prompt now ends: "Then write golden scenarios in apps/<app>/golden/, in the format of the "Golden scenarios" section of docs/kb-format.md, with at least 12 scenarios and every rule firing in at least one. Run pnpm dc golden until every scenario passes." Nothing else in the file changed, and it is still valid JSON with the same keys.
- Final checkpoint (task 10), under Node 22.14.0: `pnpm check` passes 1,374 tests in 128 files, `pnpm test:props` passes 152 property tests in 51 files, `pnpm dc validate` and `pnpm dc golden` each exit 0. `dc golden` prints `0 files, 0 scenarios run, 0 passed, 0 of 0 rules covered, 0 errors, 0 warnings`, since no app has golden files yet. All 33 boxes in `kb-golden/tasks.md` are ticked.
- What the spec delivered: the golden format in `apps/<app>/golden/*.yaml` and the "Golden scenarios" section of `docs/kb-format.md`; the pure loader, checker and runner, exported from `@dead-certain/kb-tools`; `pnpm dc golden` with exact messages, rule coverage as an error and the 12-scenario count as a warning; ten correctness properties; and the agent prompt. The value-agreement property caught one real bug (year 0000).
- Handoff notes for Claude Code, at the end of `kb-golden/tasks.md`: (1) the root `dc` script needs no change; (2) Playwright tests for every golden scenario import `loadGolden`, `checkGolden`, `duplicateIds` and `runScenario`, or read the YAML, and the results serialise; (3) add `pnpm run --if-present dc golden` after `dc validate` in CI once the first golden files exist; (4) commit `apps/*/golden/*.yaml`, since the Markdown-ignore rule does not touch YAML.
- The work stays on `kiro/2-golden-spec` and merges at gate G2. Still open for the human: registering the three hand-written specs with the IDE's spec tool, and the rulebooks (Phase 2).

### `claim-check-app` and `pre-flight-app` specs written (2026-11-16)

- Both specs were written Design-First in this session: `requirements.md`, then `design.md`, then `tasks.md`, each approved in turn on the human's instruction. No task was run. Both are for the Claude Code lane.
- Read first: section 7 and 8 of `docs/BUILD_PLAN.md`, `design-system.md`, `engine/src/types.ts`, the `packages/ui` props, and the golden section of `docs/kb-format.md`.
- What the reading caught:
  1. `apps/claim-check` and `apps/pre-flight` do not exist, and neither does `templates/`. Task 1 of each spec scaffolds the app by hand. Tasks that need `kb/` or `golden/` stop if Phase 2 has not delivered them.
  2. The first draft of `claim-check-app` used path routes and a `404.html`. Section 7 puts routes in the URL hash. The spec was corrected before approval: routes and the replay token share the fragment (`#/?r=<token>`).
  3. The engine never returns `source: "collected"`, since a flat fact record carries no origin. `pre-flight-app` relabels sources in the app (`relabelSources`) and has a property test for it.
  4. The contract has no groups, severities or evidence. They are app-side data in `checklists.ts` and the collector, checked against the knowledge base at start-up.
  5. `docs/kb-format.md` does not say where `pnpm dc build` writes JSON. `claim-check-app` task 2 finds it.
- Open questions for the human, listed in each requirements file: goal and fact names (both specs, until Phase 2), the two other snapshot repositories and the recording run (`pre-flight-app`), the deciding-sentence marker in a clause, and a replay link for Pre-Flight reports (left out).
- Not done: the specs are not registered with the IDE's spec tool, since this session has none (`kb-golden` had the same gap).

### Decisions the two specs forced (2026-11-16)

- Specs created this session: `.kiro/specs/claim-check-app` and `.kiro/specs/pre-flight-app`, each with requirements, design and tasks (commit `005e12c`). No task was run.
- `claim-check-app`:
  1. Routes and the replay token share the URL fragment (`#/?r=<token>`, rulebook at `#/rulebook`), as BUILD_PLAN section 7 says. No `404.html`.
  2. Question order comes from replaying the answers through `next`, so Back and the rail do not depend on the order the user answered in.
  3. Answers the engine no longer needs stay in the session and the token. The rail hides them and shows a skipped note, so changing an answer back restores them.
  4. "Up to M more" is an upper bound counted by the app, since the engine exposes no count.
  5. A fact or goal is named only in `src/config.ts`. Goal names are assumed until Phase 2 delivers the knowledge base.
- `pre-flight-app`:
  1. The engine reports every non-derived fact as "answered", so the app relabels proof sources to "Collected" (`relabelSources`).
  2. Check groups, severity and evidence are app-side (`checklists.ts`, collector), validated against the knowledge base at start-up. The contract was not touched.
  3. Live and bundled data meet at one `RepoSnapshot` shape, so a sample runs the same code as a live audit.
  4. The collector makes exactly four sequential requests, never retries, and never falls back to a snapshot on its own.
  5. No replay link for reports, because they depend on live GitHub data. The human may reverse this.
  6. No gitignore library: a narrow matcher that returns "unsupported" and lets the fact become a question, so nothing is guessed.
- Both specs hand tasks to Claude Code only. Neither touches `packages/ui` or `packages/engine/src/types.ts`.

### `pre-flight-app` amended after the human's answers (2026-11-16)

- Answers from the human: Claude Code may run the recording script; Pre-Flight reports get no replay link; the knowledge base has a single goal with the values exactly `ready` and `not_ready`, not one goal per checklist. The two other snapshot repositories are still open.
- Amended in `requirements.md`, `design.md` and `tasks.md`:
  1. New glossary term Goal. The Summary state is `verdictStateFrom` of that one goal, and is the same for every checklist (requirement 5.2, Property 8). Checklists lose their `goal` field. `src/checklists.ts` exports `GOAL`, and start-up validation requires exactly one goal.
  2. A checklist is now a view: it lists a subset of checks and counts failures in that subset. The app computes no verdict for a subset. Requirements 5.3 and 5.4 add two sentences for when the view and the goal disagree ("Not ready in owner/name. The failed checks are outside <title>."). Requirement 1.10 allows a check in more than one checklist, and requires it in at least one.
  3. Recording: task 2 and task 18.1 no longer wait for a human to run the script. Task 2 still stops for the two repository choices.
  4. Replay link: open question 5 is now a recorded decision, not a question.
- A decision the answer forced, flagged for the human: with one goal, the checklist picker has nothing to decide on its own. New open question 4 offers the way out. If one checklist is enough, drop the picker, requirement 2.7 and the two sentences.
- Still open: the two snapshot repositories (task 2), fact and check names, severity and groups (task 7, until Phase 2 delivers the knowledge base).

### Rulebook drafts for both apps (2026-11-16)

- Drafted by Kiro's default agent at the human's request, in the human's own words: `apps/claim-check/rulebook/policy.md` (about 1,000 words) and `apps/pre-flight/rulebook/checklist.md` (about 650 words). Both are fictional and copy no insurer's policy or organiser's rules. No knowledge base was written. The stale-rule hook ran after each save and found no `kb/` to sync.
- `policy.md`: the six fixed clauses (1.2, 2.2, 3.1, 4.2, 5.3, 6.1) keep their numbers, titles and meanings. Added definitions (1.1), the order of calculation with rounding (1.3), cover (2.1), claims already paid (2.3), room and other charges (4.1), two exclusions (5.1, 5.2), claim filing (7.1, 7.2) and Annexure 1.
  - Decisions the draft forced: a full denial is a deduction equal to the whole bill, so the ledger always adds up; the cap on the sum insured is a deduction; the sum insured is one of three amounts; amounts round to the whole rupee, half a rupee up. No claim-filing deadline, since it would need a rule.
  - Clauses 1.1, 2.1, 7.1 and 7.2 change no amount, so no rule will cite them and the rulebook page will show "Not used in any decision".
- `checklist.md`: nine checks, R-01 to R-09. The four fixed ones keep their clauses (1.1 R-01, 1.2 R-02, 2.2 R-05, 4.1 R-09). Eight are collected from GitHub and one, R-09, is asked. Each clause names its source and severity (blocker or warning).
- Human decisions recorded:
  1. Clause 5.1 stays as written: a failed warning also makes the repository not ready. "Ready" means all nine checks pass, which the "All K checks passed" summary sentence assumes. Severity only decides how the summary counts a failure.
  2. R-03 (not archived) and R-08 (two app folders under `apps/`, each with a `package.json`) stay. R-08 matches the hackathon's two-app-folder rule.
- For the knowledge-engineer: tree-based and README-based facts need an `ask`, since the tool asks when GitHub cannot supply them. Severity and groups are not in the contract, so they go in `apps/pre-flight/src/checklists.ts`, read from these clauses.

### Claim Check knowledge base and golden scenarios (2026-11-18)

- Ran the `knowledge-engineer` brief on `apps/claim-check/rulebook/policy.md`. Wrote `apps/claim-check/kb/policy.yaml` (26 rules, 8 deduction line items, 12 asked facts), `apps/claim-check/kb/open-questions.md` and `apps/claim-check/golden/scenarios.yaml` (16 scenarios).
- Goals: `payable` (money) and `outcome` (enum `paid`, `reduced`, `denied`). The bill is the money fact `claimed`. Money is in paise, and every worked-out amount is written `round(x / 100) * 100`, which is clause 1.3's whole-rupee, half-up rule.
- `pnpm dc validate`: clean on the first run. `pnpm dc golden`: 16 of 16 pass, 26 of 26 rules covered. The scenarios include the worked examples of clauses 1.3 (payable ₹1,32,000) and 4.2 (₹33,000 deducted), the 29 and 30 day waiting boundary, ages 60 and 61, and a half-rupee case in the other-charges ratio.
- Decisions the policy forced, listed in `open-questions.md` for the human: an illness that starts before the policy start (rules deny it), which clause is named when two of 3.1, 5.1 and 5.2 apply (the first listed), dental "caused by an accident" read as the admission cause, any sum insured accepted by the rules, and negative other charges when Annexure 1 items exceed the bill.
- Clause 2.2 has a pass-through rule (`SUM-01`) so each clause that sets an amount has a rule. Clauses 1.1, 2.1, 7.1 and 7.2 have none.

### Pre-Flight knowledge base and golden scenarios (2026-11-18)

- Ran the `knowledge-engineer` brief on `apps/pre-flight/rulebook/checklist.md`. Wrote `apps/pre-flight/kb/checklist.yaml` (10 rules), `apps/pre-flight/kb/open-questions.md` (11 questions) and `apps/pre-flight/golden/scenarios.yaml` (14 scenarios).
- One goal, `readiness` (enum `ready`, `not_ready`). Rules `R-01` to `R-09` each set one check fact (`role: check`, with a short label) and cite their clause. `READY-01` cites 5.1 and uses `if(<nine checks joined by and>, 'ready', 'not_ready')`. Because `and` is false when any side is false, one failed check gives `not_ready` while other checks are still unknown.
- Collected facts are plain non-derived facts. The validator requires `ask` on every non-derived fact, so metadata facts have one too, as do the tree, `.gitignore` and README facts. Heading and `.gitignore` matching, and the choice of README file, are left to the app (open questions 3, 4, 6, 7).
- Decisions the checklist forced: R-08 is read as "every directory under `apps` has a `package.json`, and there are at least two" (two numbers, `apps_dir_count` and `apps_with_package_json`). R-05 fails when `.kiro` has no file in the tree. The video length is in seconds. Severity is not encoded, since it does not change the goal.
- `pnpm dc validate`: clean on the first run. `pnpm dc golden`: all scenarios pass, every rule covered (36 of 36 across both apps).

### Claim Check open questions answered (2026-11-18)

- The human answered all nine questions in `apps/claim-check/kb/open-questions.md`. Questions 2, 3, 4, 7, 8 and 9 keep what the rules did. The file now marks every question answered, with the decision beside it.
- Q1: added one sentence to clause 3.1 in `rulebook/policy.md` and in the clause text of `policy.yaml`: an illness that starts before the policy start date is not covered. No rule changed.
- Q5: `sum_insured` is now an enum (`rs_300000`, `rs_500000`, `rs_1000000`). `SUM-01` maps it to the money fact `year_cover`, and `ROOM-03` reads `year_cover`. The 15 golden scenarios that gave `sum_insured` in paise now give the enum option.
- Q6: added one sentence to clause 1.3 (policy and clause text): no worked-out amount is less than zero. Floored with `max(..., 0)` in `ROOM-02`, `COPAY-02`, `SUM-03` and `PAY-02`. New scenario `G-17` (room charges above the bill) fails without the floor, since the other-charges deduction would be negative.
- `pnpm dc validate`: clean. `pnpm dc golden`: 31 of 31 pass across both apps, 36 of 36 rules covered. `pnpm biome check apps/claim-check`: clean.
- Flagged: Claim Check's rulebook is in the knowledge-engineer lane, but the app's input for the sum insured (a three-option choice) now follows the enum, which `apps/claim-check/src` (Claude Code lane) must adopt.

### Pre-Flight app spec: one checklist, no picker (2026-11-18)

- Amended `.kiro/specs/pre-flight-app` with the human's answer to open question 4: one checklist, no picker. Question 3 (the two snapshot repositories) stays open.
- `requirements.md`: removed the picker requirement 2.7, so 2.8 to 2.12 are now 2.7 to 2.11. Removed the `checklist=<id>` route parameter from requirements 1.1, 2.8 and 2.10. Removed the two sentences for a view and goal that disagree from 5.3 and 5.4, and the "same for every Checklist" clause from 5.2. Redefined Checklist as the one list, and simplified the start-up check in 1.10. Question 4 is marked answered.
- `design.md`: dropped the route parameter, the `id` and `description` fields, `CHECKLISTS` (now `CHECKLIST`), the `title` argument of `summarize`, the disagreement cases, and the "same for every checklist" clause of property 8. The decision row now reads "One goal, one checklist".
- `tasks.md`: removed the picker from task 11 and its test, the disagreement-sentence tests from task 8.1, and question 4 from the blockers of task 7. The requirements reference of task 11 is now 2.1 to 2.11.
- No code changed. Cross-references to requirements 2.3 to 2.6 and 5.2 to 5.6 are unaffected.

### Claim Check labels and sum insured options (2026-11-18)

- Added a `label` to the 12 facts the policyholder answers in `apps/claim-check/kb/policy.yaml` (for example `claimed`: "Hospital bill", `treated_outside_india`: "Treated outside India", `annexure_items`: "Annexure 1 items").
- Renamed the `sum_insured` options `rs_300000`, `rs_500000`, `rs_1000000` to `three_lakh`, `five_lakh`, `ten_lakh`, so the interface shows "Three lakh", "Five lakh" and "Ten lakh". Updated `SUM-01`, the 16 golden scenarios that use them, and the answer to open question 5. No other rule, clause or amount changed.
- `pnpm dc validate`: clean. `pnpm dc golden`: 31 of 31 pass, 36 of 36 rules covered. `pnpm biome check apps/claim-check`: clean.
- Flagged: any code in `apps/claim-check/src` (Claude Code lane) that uses the old option names must follow the rename.

### Gate G3 review: claim-check-app, pull request #8 (2026-11-18)

- Reviewed `apps/claim-check/src` and `e2e/claim-check-*` (merged as `486a651`) against `.kiro/specs/claim-check-app`. Reran `pnpm dc build apps/claim-check` and `pnpm vitest run apps/claim-check` (57 passed, 1 skipped: the CI-only lane guard). Did not rerun the Playwright suite; the pull request reports 1,246 passed.
- Accepted all 13 deviations and amended the spec to match: glossary `Relevant_Answer` (1), 11.5 (2), 3.15 new (4), 7.2 (6), 1.9 (7), 9.2 (9), 9.9 new (10), 13.11 new (11), 14.6 new (12), 15.6 (13). Deviations 3 and 8 are test-level and went into the design's Testing Strategy; deviation 5 went into the design's X-ray section. No deviation was rejected.
- Requirements not covered by a deviation: the nav's "Claim Check" link keeps the replay token (now in 1.2); the golden test reads the page URL instead of clicking "Copy link" (15.7 amended, the button has its own test); the what-if list has no action in the kit (7.4 reworded); the CI-only lane guard `lanes.test.ts` (14.7 new). No requirement is unmet.
- Marked tasks 1 to 16 and their subtasks complete in `tasks.md`. No task reopened.
- Engine notes: neither is an engine bug, so no Bugfix spec was opened. The raw `because` values are what inference-engine requirement 9.6 specifies (`String(value)`), and the engine has no currency or locale. PAY-01 appears twice because the verdict's proof is the `outcome` tree, and `total_deductions` sits both under `payable` and directly under the outcome rule; inference-engine requirement 9.12 asks for an equal subtree at each occurrence.
- Flagged for the human: deviation 4's above-bill refusal puts a domain judgment in the app. If the policy should forbid deductions above the bill, a `kb` rule should say so. Not changed here.

### Gate G4 review, tasks 1 to 4: pre-flight-app, pull request #10 (2026-11-18)

- Reviewed `apps/pre-flight` (tasks 1 to 4, commits `85d1b60` to `eb30e25`), `e2e/preflight-shell.spec.ts`, the root `tsconfig.json`, `package.json`, `playwright.config.ts` and `ci.yml` against `.kiro/specs/pre-flight-app`. In a clean worktree of the branch: `pnpm check` passed (1,537 tests, 1 skipped), `pnpm dc build apps/pre-flight` was clean, and `e2e/preflight-shell.spec.ts` passed in all four projects. Probed `parseTarget`, `classify`, `parseTree` and `parseFile` by hand on 25 inputs, including look-alike hosts, a port, credentials, a 403 without rate-limit signs and a clipped multi-byte file.
- Accepted all 9 deviations and amended the spec: open question 3 answered with the human's two repositories (requirements decisions list, question 3, design snapshot choice, task 2); requirements 2.3, 2.6, 3.11, 3.18; design target parsing, response shape and `classify` signature, field checks, `record.ts` row and recording paragraph, Property 11 split in two steps; tasks 1, 2, 4.2, 5.2 and the notes.
- Unmet and not covered by a deviation: requirement 12.7 asks for the date on the recorded responses, and the files hold URL, status, headers and body only. Added `recordedAt` to the design and reopened task 2. Tasks 1, 3 (3.1, 3.2) and 4 (4.1, 4.2) marked complete. Tasks 5 to 21 untouched.
- Flagged: the pull request has no comments, so the Task_Evidence (screenshots at 390, 768 and 1280 px, console, axe, failing and passing runs) is not attached. Needed before task 5 is reviewed. Not verifiable from the branch: the red runs of the test-first tasks.
- Flagged: requirement 9.3 asks the three snapshots to include an inline question. Whether the chosen set does is open, and task 18.1 now checks it.
- No code changed. Fixed the dates of the four entries before this one: they said 2026-11-19 to 2026-11-22 but were all written on 2026-11-18.

### Gate G4 review, tasks 2, 5 and 6: pre-flight-app, pull request #10 (2026-11-18)

- Reviewed commits `db43bf3`, `041da88` and `b17fc8f` on `cc/phase4-pre-flight` against `.kiro/specs/pre-flight-app`. In a clean worktree: `pnpm vitest run apps/pre-flight` passed (136 tests), Biome and `tsc` were clean. The full `pnpm check` there stopped only on Claim Check suites that need `pnpm dc build` output (`kb/dist`), which the worktree did not have. Probed the `gitignore_ignores_kiro` and `readme_has_run_heading` extractors by hand on 9 inputs.
- Task 2: every recorded and synthetic file now has `recordedAt`, and the re-recording changed only the date, rate-limit headers and this repository's `pushed_at` and issue count. Requirement 12.7 is met. Task 2 marked complete.
- Task 5: accepted all 4 deviations (double timeout, tree 404 as empty tree with a `done` step, `not_found` events for absent files, exceptions as `unreadable`). Added requirements 3.8, 3.12 and new 3.20, design "Timeout" and "Step results", and task 5.1. Tasks 5, 5.1 and 5.2 marked complete. Gap: no unit test covers a tree 404 or a `fetch` that ignores the abort signal.
- Task 6: accepted (a), (b) and (d). Rejected (c) in part: `headings()` counts a line inside a fenced code block, so a README with a shell comment `# Install` in a code block passes `readme_has_run_heading`, and `Usage` over `***` counts as an underlined heading. Both confirmed by probe. Added requirements 3.21 to 3.23, design "The real table" and the `Extractor` shape, and task 6.3's fix text. Tasks 6.1, 6.2 and 6.4 marked complete; 6 and 6.3 stay open.
- Flagged: the pull request has no Task_Evidence for task 6. Tasks 7 to 21 untouched. No code changed.

### Gate G4 review, tasks 6.3 and 7 to 21: pre-flight-app, pull request #12 (2026-11-19)

- Reviewed `cc/phase4-pre-flight` at `5d8fbd5` against `.kiro/specs/pre-flight-app`. In a clean worktree: `pnpm vitest run` passed (1,623, 1 skipped), `pnpm dc golden` passed (31 scenarios, 36 of 36 rules). `pnpm check` fails on Biome formatting in `e2e/preflight-keyboard.spec.ts`; CI's `check` job fails for the same reason. Did not rerun `pnpm e2e` or `pnpm build`.
- Findings for Claude Code: the format error; `Report.tsx` group ids contain spaces ("group-Kiro usage"), which breaks `aria-labelledby`; `headings()` still accepts `~` and `^` underlines, so `Usage` over a `~~~` fence reads as a heading (3.22 allows `=` and `-` only); a failed sample load leaves a blank sheet.
- Accepted deviations 1 to 15 (8 and 9 with notes). Amended: 9.1 and 9.3, the design's snapshot module rows and "Bundled snapshots" section, and tasks 16.2 and 18. Requirement 7.4's "Worked out" wording is kept; task 16.2 records that no check shows the badge.
- Flagged for the human: approve the `e2e/fixtures/preflight-*` files after the re-record; a not-ready report shows R-09 as "Needs your answer" with no control, which the spec did not foresee.
- Tasks were not marked complete at first: the gate waited on the fixes above.
- Re-checked after Claude Code's fixes (`6125770`, `a125437`): `pnpm check` exits 0 at `a125437`; the format error, the slug ids, the `=`/`-` underline rule with its test and the sample-load error with its test meet items 1 to 4. Marked tasks 6, 6.3 and 7 to 21 and their subtasks complete in `tasks.md`.
- Amended requirement 5 with criteria 16 and 17 for Claude Code's `54785e0` (the not-asked line under the Summary and in the export, and the line that opens "Needs your answer"), on the human's word. This closes the spec gap flagged above. The three Markdown fixtures changed by one line each and need the human's approval again.
- No code changed.

### Phase 5 specs written: `mcp-server`, `app-template`, `landing-page` (2026-11-20)

- Surface: CLI. Feature: specs, Design-First. Each spec has `requirements.md`, `design.md` and `tasks.md` in `.kiro/specs/`. No task was run, and nothing outside `.kiro/**` and this log changed. Branch `kiro/5-specs`.
- Read first: `docs/BUILD_PLAN.md` sections 6 to 10 and 12, `AGENTS.md`, the `pre-flight-app` and `kb-tools` specs for style, `packages/engine/src/types.ts`, the kb-tools public API, `apps/claim-check` and `apps/pre-flight` (package files, Vite config, `index.html`, `src/`), `playwright.config.ts`, `ci.yml`, `apps/site` and the kit's exports.
- Departure from the plan: section 6 lists `mcp-server` as Requirements-First and section 9 says "create and execute". The human asked for Design-First and no execution, so it was written Design-First and not run.
- `mcp-server` (Kiro lane, 10 requirements, 8 properties, tasks 1 to 9). Four read-only tools (`list_kbs`, `consult`, `explain`, `validate`). What the reading caught:
  1. `packages/mcp` does not exist, but `.kiro/settings/mcp.json` already names its `start` command, disabled.
  2. kb-tools exports `compileText` and `validateText` but not its Node host, so the server has its own 20-line read-only host and compiles the YAML on every call. It never reads `kb/dist`, since Kiro uses it while rules are being edited.
  3. The engine's imports have no extensions, so Node cannot run the sources. The server is bundled with Vite as kb-tools is, and `start` rebuilds it quietly when the source is newer. Standard output must carry only protocol messages.
  4. A KB is named by a `<app>/<stem>` reference taken from the discovered list, never by a path, so a traversal cannot occur by construction.
  5. The "Confirm Kiro can call `consult` and `explain`" line of Phase 5 needs a Kiro session that starts after `mcp.json` changes. The tasks split task 7 across two sessions.
- `app-template` (Claude Code lane, 12 requirements, 9 properties, tasks 1 to 8). `pnpm new-app <name>` copies `templates/app` to `apps/<name>`, and inserts five lines into `playwright.config.ts` and `ci.yml` at marker comments. What the reading caught:
  1. `scripts/` and `templates/` do not exist, and the `new-app` script is not in `package.json`.
  2. `.kiro/steering/new-app.md` is out of date: it says `deploy.yml` (the workflow is `ci.yml`), puts golden scenarios in `kb/golden.yaml` (they are in `golden/scenarios.yaml`) and leaves out the Playwright wiring. Not changed in this session. Requirement 12.3 has Kiro rewrite it after the gate.
  3. `pnpm dc build apps/<name>` needs a knowledge-base file, so a scaffold with none cannot build. The template ships a starter rulebook, knowledge base and golden scenario. They are rules, so the spec gives them to Kiro and asks the human to allow it, since `AGENTS.md` gives `templates` to Claude Code.
  4. Under `CI=true` pnpm refuses a lockfile change, and a new workspace package changes it. The CI job that follows the README turns the frozen lockfile off for its own installs, and the README tells the person to commit the lockfile.
  5. The README block cannot include the dev server, which never ends, so it holds the three commands that end and the dev command sits in a second block.
  6. `kit` and `assets` are not under `apps/` but are folders in the deployed site, so they are reserved names.
  7. A script of several modules run with Node's type stripping needs `.ts` extensions in its imports, which `tsc` accepts only with `allowImportingTsExtensions`. The root Vitest config also skips `scripts/`. Both are Claude Code's root files and task 1 changes them.
- `landing-page` (Claude Code lane, 10 requirements, 6 properties, tasks 1 to 8). The hero runs the engine's `audit` in the browser on the compiled Claim Check knowledge base with the facts of golden scenario `G-01` (₹1,32,000 of ₹2,10,000, four deductions), and opens its proof with `XrayStage`. What the reading caught:
  1. `VerdictHeadline` renders a heading, so the hero passes level 2 to keep the tagline as the page's one `<h1>`.
  2. The engine fills rule sentences with raw minor units, so the film copies Claim Check's re-printing function. The page copies about 150 lines of Claim Check's verdict code and a test forbids importing from `apps/claim-check/src`. A golden pin fails the build if `G-01` and the page drift.
  3. `ROOM-05`'s printed expression is over 100 characters, too long for a phone, so the steps quote a shorter rule from the same proof (the task picks it and a test enforces the 90-character limit).
  4. The site's `build` does not compile the knowledge base today, and Playwright builds the site on its own. The build script now runs `dc build apps/claim-check` first, as the apps do.
- Open questions for the human are at the end of each `requirements.md`: 6 for `mcp-server`, 7 for `app-template`, 8 for `landing-page`. The ones that block work: SDK type needs (`@types/node`), who writes the template's starter knowledge base and about what, whether to use markers or discovery for the shared files, and whether the hero is fixed or editable.
- Not done: the specs are not registered with the IDE's spec tool (this session has none), so no `tasks.meta.json` was written. The `new-app.md` steering was left as it is. The `tech.md` pin for `@modelcontextprotocol/sdk` waits for the execution session.
- The human answered every Phase 5 open question (2026-11-20). Recorded as "Decided by the human" in the three `requirements.md` files, with no question left open. `mcp-server`: all six took the recommendation. `app-template`: Kiro writes the three starter files once, the domain is "Library fine", and markers, a plain verdict, no rulebook page, no time target and path filters are all in. `landing-page`: fixed hero, copied verdict code, `G-01`, no preview image, the 404 page now, no Lighthouse in CI, and one sentence on the tools with a link to `.kiro`. That last answer added requirement 4.8 and a line in task 4. The task notes that named open questions now say they are answered. Next for Kiro: the `kiro/5-template-kb` pull request with the starter files, which `app-template` task 4.1 waits for.

## 2026-11-20

- Starter knowledge base for `app-template` (requirement 4), on `kiro/5-template-kb`. The human allowed Kiro to write `templates/app/kb/starter.yaml`, `templates/app/rulebook/starter.md` and `templates/app/golden/scenarios.yaml` once. No hook or spec ran. This was a direct task against requirement 4 and the design's "The Starter_KB".
  - Domain: library fine. Three questions (days late, member type, waiver card), four derived facts, two `deduction` line items (cut by the cap, cancelled by the waiver), 12 rules citing four numbered clauses, one goal `outcome` with `no_fine`, `fine_due` and `waived`. Placeholders: `__APP_NAME__` as the knowledge-base id and the golden `kb`, `__APP_TITLE__` in the rulebook heading.
  - Checked with a temporary copy as `apps/zz-starter` (names substituted, then deleted): `dc validate` 0 errors and 0 warnings, `dc build` wrote `kb/dist/starter.json`, `dc golden` passed 4 of 4 scenarios and covered 12 of 12 rules. `biome check templates` is clean.
  - Notes for Claude Code:
    1. The design proposed `paid` and `waived`. `paid` is a word `verdictStateFrom` knows ("Paid in full"), so the plain path would not run. The goal values are `no_fine`, `fine_due` and `waived`, none in the kit's table. `config.ts` should say `verdictGoal: "outcome"`, as the design has it.
    2. `pnpm dc golden` prints the warning `TOO_FEW_SCENARIOS` (4 scenarios, the build plan asks for 12). Requirement 4.4 asks for no warning only from `validate`, and requirement 4.2 sets the minimum at 3, so this stays.
    3. The money is in cents with `currency: USD`. The amounts are printed in `because` sentences as raw cents, as the engine fills them.
    4. The spec files were read from `kiro/5-specs`, which is not merged into this branch's base yet.
  - `templates/app/rulebook/starter.md` was never committed, because `.gitignore` hid it. Main now tracks Markdown under `templates/app/` (PR #16). Kiro checked the file against the knowledge base (four clauses, the same rates and caps, `__APP_TITLE__` in the heading) and committed it without a force-add.

- `mcp-server` tasks 1 to 7.1 (CLI, branch `kiro/5-mcp-server`). Executed from `.kiro/specs/mcp-server/tasks.md`, handlers test-first (failing output kept, then passing). No hook ran. The branch started level with `main`, so it was fast-forwarded to `kiro/5-specs` to get the spec.
  - Built `packages/mcp`: package and Vite bundle, `bin/start.mjs` (rebuilds quietly when the source is newer), host, workspace discovery, `kbs.ts`, the four tools, `server.ts`, `main.ts`. SDK `@modelcontextprotocol/sdk` 1.32.2 (latest stable). `tsc --noEmit` passed with Node names declared locally, so `@types/node` was not added. The only package added besides the SDK is `zod` 4.6.7, which the spec lists.
  - Tests: 40 unit tests for the host, workspace, KB lookup and the four tools, a source scan, a stdio smoke test over `node bin/start.mjs` (all four tools, clean exit 0 on closed stdin, workspace unchanged), and the eight property tests (150, 120, 120, 150, 300, 300, 200 and 100 runs). Each property was shown able to fail by breaking the code under test (dropping a question's `clause`, trimming a ref, reversing diagnostics) and then restoring it. `pnpm check`, `pnpm test:props` and `pnpm dc validate` pass. The exact command in `mcp.json` was run from the repo root and answered `initialize`.
  - What the work caught:
    1. The smoke test failed at first: `dist/server.mjs` imported `yaml`, which is kb-tools' dependency and not resolvable from `packages/mcp`. Fixed by bundling `yaml` into the server (`ssr.noExternal`) instead of listing it as external, so no dependency was added. This differs from the spec's task 1.1, which lists `yaml` under `ssr.external`; requirement 7.4 would also have allowed declaring it.
    2. SDK 1.32.2 answers invalid arguments with a Tool_Result (`isError: true`, text `MCP error -32602: Input validation error ...`), not a JSON-RPC error. No handler runs, which is what requirement 6.1 needs. The tests pin the actual behavior.
    3. Requirement 6.3 wants `LIMIT_EXCEEDED` for over-long values, but the design puts `.max()` in the zod schemas, which would give an invalid-params message instead. The schemas check types only, and the handlers check the limits. Requirement and design could be reconciled by amending the design's schema line.
    4. A float for a money fact gives `INVALID_ANSWER` from the engine (as requirement 3.10 says), not `NON_INTEGER_MONEY`.
    5. `apps/pre-flight/kb/dist` was missing in this checkout, so two Pre-Flight tests failed before any of this work. `pnpm dc build` generated it (gitignored).
  - The property tests import `packages/kb-tools/src/testkit` by relative path for knowledge-base and answer generators, since neither testkit is exported. Nothing in `packages/engine` or `packages/kb-tools` changed.
  - Task 7.1: `"disabled": false` for `dead-certain` in `.kiro/settings/mcp.json`, in its own commit. The session stops here. Tasks 7.2 and 7.3 need a new Kiro session from the repo root, which loads the server. Tasks 8 and 9 follow.

## 2026-11-21

- `mcp-server` tasks 7.2, 7.3, 8 and 9 (Kiro CLI, branch `kiro/5-mcp-server`). The new session loaded `dead-certain` from `.kiro/settings/mcp.json` and listed all four tools. No hook ran.
  - Calls through the server: `list_kbs` returned `claim-check/policy` (36 facts, 12 askable, 26 rules, 11 clauses) and `pre-flight/checklist`, both ok. `consult` with no answers asked `claimed` (clause 1.2). With `cause` and `claimed` it asked `policy_start_date` (clause 3.1). With the full `G-01` answers it returned a verdict.
  - The verdict matches `G-01`'s `expect` block: `payable` 13200000, `outcome` `reduced`, and all eight line items (0, 0, 0, 1200000, 500000, 2800000, 3300000, 0) with rules `ANNEX-01`, `ROOM-05`, `ROOM-07`, `COPAY-03`. `explain` on `payable` and `outcome` showed `PAY-02` and `OUT-03`, so the six rules in `fires` all appear. Every leaf was `answered`. `explain` on `room_rent_deduction` gave 500000 by `ROOM-05`, clause 4.2. `validate` on `pre-flight/checklist`: 0 errors, 0 warnings. No difference found.
  - What it showed: `explain` on a goal is large. `payable` came back at about 81,000 characters and `outcome` at about 158,000. Both are under the server's 200,000 cap but over the 30,000 the Kiro CLI shows inline, so it kept a preview and saved the rest to a file. The proof repeats shared subtrees. `room_rent_deduction` is small. Not changed; a smaller default would be a design change.
  - Task 8: README "MCP server" section, and `tech.md` pins `@modelcontextprotocol/sdk` at 1.32.2.
  - Branch note: commit `7ff9bb8` (the library-fine Starter_KB, from another session) is on this branch and was left alone, as the human asked. Its `templates/` files show in `git diff main...HEAD`, outside the list in task 9.

## 2026-11-22

- Gate G5 review of PR #19 (`cc/phase5-app-template`, Claude Code lane) against `.kiro/specs/app-template`, on `kiro/5-app-template-review`. No hook ran. Kiro read the diff (66 files, all in `scripts`, `templates`, `ci.yml`, `README.md` and root config), checked out the head in a worktree and ran `pnpm check` (1,802 passed, 1 skipped), `pnpm dc validate` (0 errors, 0 warnings), `pnpm dc golden` (31 of 31 scenarios, 36 of 36 rules), `tsc`, Biome, `pnpm build`, `pnpm test:props` and `pnpm e2e --project=1280` (422 passed, 2 skipped). Two timing tests failed once under parallel load (the engine's 99th-percentile step limit, and one test in `pnpm test:props`) and passed alone, and `pnpm build` failed once on a `dc.mjs` rebuild race between the two apps. None is in this diff.
  - Deviations accepted, spec amended: root `fast-check` `4.10.2`; the runner-only `.npmrc` for the frozen lockfile (requirement 9.1, which named an environment variable pnpm 10 ignores); `pnpm dc build` before `pnpm check` in the job (9.3); name validation in `readme-block.ts` (9.2); three font preloads; `progress.ts` and `CopyLink.tsx` in the design's table; the red run as a pushed commit and its revert (checked: the `scaffold` job failed on `0ce19b6` with "README.md has no sh block under the heading", green on `3b0b75b`). Task 2.3 before 2.2 is only an order and needed no change. The `PATH` refusal for an unknown placeholder was already in the design's error table, so it conforms.
  - Not accepted as complete without a note: the 18 screenshots are not on the pull request (shared with the human outside it). The two CI runs show as cancelled at workflow level because a later push superseded them, though each `scaffold` job finished.
  - Caught by the review: `planFor` refuses the valid names `claim` and `pre`, because the collision check looks for `apps/<name>` as plain text and matches `apps/claim-check`. It fails safe. Recorded in `tasks.md` as a follow-up for Claude Code, not blocking.
  - Starter_KB findings (Kiro lane) confirmed from `starter.yaml`: `OUT-03` decides `fine_due` from `days_late` and `waiver_card`, so the engine never asks `member_type` and the cap line reads "Not known". The golden scenarios give every fact, so they do not catch it. Not changed in this session; it needs its own Bugfix spec. `TOO_FEW_SCENARIOS` from `dc golden` is accepted in requirement 4.4.
  - Changed: `requirements.md` (9.1 to 9.3, 11.3, 4.4, an amendment list), `design.md` (preloads, two table rows, the job's YAML, two decisions), `tasks.md` (all 27 boxes ticked, dependency rule and task 6.2 amended, review notes), and `.kiro/steering/new-app.md` rewritten from the real command (requirement 12.3): the layout with `golden/`, `ci.yml`, the four markers, `config.ts`, the reserved names and the lockfile step. The old file named `deploy.yml` and `kb/golden.yaml`.

- Gate G5 review of PR #20 (`cc/phase5-landing-page`, Claude Code lane) against `.kiro/specs/landing-page`, on `kiro/5-landing-page-review` (stacked on `kiro/5-app-template-review`, so merge that one first). No hook ran. Kiro read the diff (41 files, all in `apps/site`, `e2e` and `pnpm-lock.yaml`) and ran the head in a worktree: `pnpm check` (1,756 passed, 1 skipped), `test:props` (190), `dc validate` (0 errors, 0 warnings), `dc golden` (31 of 31, 36 of 36), `pnpm build` three times, and the site specs at 1280 (17 passed, 1 skipped).
  - Verdict: changes requested, two of them. The pull request's `check` job is red. `pnpm build` failed with `dist/dc.mjs is missing`: the site's new build script calls `dc`, which rebuilds kb-tools, so three builds now rebuild it at once and delete `dc.mjs` under each other. It did not reproduce in three local builds, so it is timing. The spec itself asked for that script (requirement 1.3), so the spec is amended to forbid the rebuild. Second, the shell reads "Dead Certain  Dead Certain": requirement 6.1 asked for the app name "Dead Certain", and the shell prints its brand first. The spec now asks for an empty `appName`.
  - Accepted, spec amended: `fast-check` in the site (human-approved, a section 7 package); `STEP_RULE` `ROOM-03` (the design already said `ROOM-05` was a placeholder: its expression prints at 112 characters, `ROOM-03` at 36 and it cites clause 4.2); the explain session built as `{ kb, answers }` after `audit` (`Session` is that plain object, and replaying `answer` took 12 ms against the 10 ms budget); `stepsData.ts` for `steps.ts` (macOS case-insensitive collision with `Steps.tsx`); tests compiling the YAML with `compileText`; the `#add-a-third-app` link (decided in open question 7, and PR #19 adds the heading, so merge #19 first); the `SampleFailed` h2 (one h1 per page); one shared kit stylesheet (the double import made the kit's refusals test fail, and the fix is in `7fc0729`).
  - Kit findings (`packages/ui`, Claude Code's lane, no change here): `VerdictHeadline` takes focus on mount and the Hero hands it back once (accepted, with its `shortcut:` comment, and written into requirement 3.6); the side film's "Why" heading does not take Escape at 1280 px, as in Claim Check (accepted and written into requirement 3.4). A `focusOnMount` option and Escape on the film heading are follow-ups for the `ui-kit` spec. Not opened in this session.
  - Open items: tasks 1 and 8 stay unticked until the two changes land and CI is green. Tasks 2 to 7 are ticked. The screenshots are not on the pull request (shared with the human). Requirement 10.2 (the live site in a private window) waits for both pull requests to merge and is the human's.

- Re-review of PR #20 at `4eefdcf` (Kiro CLI, branch `kiro/5-landing-page-review`, PR #22). No hook ran. CI run 45059628797: `check` and `scaffold` green, `deploy` skipped (it runs only on main). Locally, in a fresh worktree: `pnpm -r build` passed twice in a row after removing `packages/kb-tools/dist` and each app's `dist`, with no "dc.mjs is missing". All four `build` scripts (claim-check, pre-flight, site, Template) now run `node ../../packages/kb-tools/bin/dc.mjs build ...` directly, so only the root `pnpm dc` rebuilds kb-tools.
  - Screenshots from the CI artifact, all nine of `site-landing`, `site-landing-proof` and `site-404` at 390, 768 and 1280 px: the header shows "Dead Certain" once on the landing page and the 404 page at every width. The hero, steps, cards, scaffold block and the open proof read as the spec describes. I did not see the 1280 px open proof, the one that puts the sheet and the film side by side. The 768 px proof is the bottom sheet.
  - Accepted: the Template's `build` script. The app-template spec named the old `pnpm -w run dc build` form in its findings table and its Template table, so the spec is amended (the drift test compares dependencies only, so it does not care). The landing-page spec's requirement 1.3, design and task 1 name the new form. Both were my spec text, not a code fault.
  - Tasks 1 and 8 of `landing-page` are ticked, so all eight are done. Open for the human after #20 merges: requirement 10.2 (the live site in a private window, "See why") and the timed "Add a third app" run. Follow-ups for the kit: `focusOnMount` on `VerdictHeadline`, and Escape on the side film's heading.

## 2026-11-23

- Bugfix `starter-kb-asks-member-type` (Kiro CLI, branch `kiro/5-starter-kb-fix`, from main). The human allowed the Kiro lane to edit `templates/app/{kb,rulebook,golden}` once more (the `AGENTS.md` table gives `templates/` to Claude Code). No hook ran. Spec first: `bugfix.md`, `design.md` and `tasks.md` under `.kiro/specs/starter-kb-asks-member-type/`.
  - Reproduced on a scaffolded `probe-app` from main: for a late book the engine asked `days_late` and `waiver_card` only. `cap_deduction` came back null, and with a waiver card `waiver_deduction` was null too. `member_type` was never asked.
  - Fix: a second goal `amount_due` ("Fine to pay") with rules `AMT-01` (on time, 0) and `AMT-02` (fine after the cap less the waiver), both citing clause 4. `CAP-04` and `WAIV-01` got an `if(days_late <= 0, ...)` guard, so an on-time book needs only `days_late` and its lines read 0, not "Not known". `outcome` stays the verdict goal, the KB id is `__APP_NAME__`, and no code file changed. Clause 4 gained one sentence in both `starter.yaml` and `starter.md`.
  - Golden: `G-01` to `G-03` gain `amount_due`, `G-04` gives only `days_late: 0`, and the new `G-05` and `G-06` expect `ask: member_type` for a late book with and without a waiver card. These are the scenarios that would have caught the defect.
  - Checked on a fresh scaffold of the fixed template: `dc validate` 0 errors and 0 warnings, `dc build` ok, `dc golden` 6 of 6 scenarios and 14 of 14 rules (the accepted `TOO_FEW_SCENARIOS` warning only), `pnpm check` 1,857 passed. A probe through the engine asked `days_late`, `waiver_card`, `member_type` for a late book and only `days_late` for an on-time one. In the browser at 1280 px the verdict shows "Fine to pay $10" and "Cut by the cap: $5", with no "Not known".
  - Found, not fixed (Claude Code lane): the scaffold's smoke spec fails axe `color-contrast` (2 nodes) in the `reduced-motion` project after "See why" opens the proof, at `e2e/probe-app-smoke.spec.ts:36`. It fails the same on main's unfixed template, and the Scaffold_Job runs only the 1280 project, so CI does not see it.

- Steering and spec amendments for the darkroom and lightbox redesign (Kiro CLI, branch `kiro/6-darkroom-steering`, from main at `010734d`). No hook ran. The human approved `docs/redesign-proposal.md` on 2026-11-23 (JSON-LD Organization, no new dependencies). The proposal file is ignored by Git (`*.md` in `.gitignore`) and exists only in this checkout, so the steering file now carries every table the specs need.
  - `.kiro/steering/design-system.md`: dark and light token tables with every contrast ratio, `--control-border-dark`, the theme rule (`dc-theme`, one storage file), radius 4/8/12/999, the shadow, glow and duration tokens, the type scale, the motion table with reduced-motion replacements, the new components, the four refusals lifted with their limits, the refusals that stay, and the film-versus-card material rule.
  - `ui-kit`: requirements 32 to 37 (themes and tokens, narrowed refusals, contrast in both themes, motion, command trigger and menu, new components and `/kit` in both themes), struck-through criteria 2.5, 2.6 and 2.8 with pointers, Property 11 extended with every pair in section 1, Property 12 narrowed as section 5 says, and tasks 12 to 15 (tokens and theme toggle; AppShell and command menu; kit components and `/kit` in both themes; checkpoint) with waves 49 to 58.
  - `landing-page`: requirements 11 to 13 (themes, hero visuals, landing-only motion, SEO with `Organization` JSON-LD and committed OG PNGs, the `lane.test.ts` storage exception) and tasks 9 and 10. Open question 5 (no preview image) is superseded.
  - `claim-check-app` (requirements 16 to 18, tasks 17 to 22) and `pre-flight-app` (requirements 14 to 16, tasks 22 to 28): theme, shell, command menu and `Toast` wiring, each screen restyled in both themes, and the privacy test changed to allow the `dc-theme` write only. Each spec's working-rules refusal line and refusal criterion are replaced to match.
  - All new tasks are unticked and marked Claude Code lane. Nothing was implemented. Order across specs: ui-kit 12 to 14, landing page 9 and 10, Claim Check 17 to 22, Pre-Flight 22 to 28.
  - Found, for the human: the proposal gives no durations for blur-in, spotlight and shine, so the motion table says "set in the ui-kit design" and Kiro fixes them at the kit pull request review. The theme attribute name (`data-theme` assumed) is left to Claude Code, to be recorded in the pull request. The new kit tasks are numbered 12 to 15 but sit before the optional item 11 in `ui-kit/tasks.md`, so the optional items stay last. The type scale is in the steering file though section 4 does not list it, because section 2 sets it.

- Gate review of PR #26 (`cc/phase6-tokens`, ui-kit task 12) and PR #27 (`cc/phase6-redesign`, first visible pass, stacked on #26), on `kiro/6-darkroom-review` (Kiro CLI, from main at `bcaf3e9`). No hook ran. Each head was checked out in a worktree; reviews posted as comments on the pull requests.
  - #26: `pnpm check` 1,919 passed, 1 skipped; CI `check` green with 2,102 e2e passed and 133 skipped. Verdict: one change requested. The `scaffold` job is red because `templates/app/src/lanes.test.ts` (copied into the probe app) still forbids `packages/ui/`; the log of run 45134315237 shows 11 `packages/ui` files from `0d7768f`. The matching fix in `apps/claim-check/src/lanes.test.ts` is accepted. Ticked 12.1 to 12.4 and 12.
  - #27: `pnpm check` 1,919 passed, `pnpm build` passed, `pnpm e2e` on 1280, dark and 390: 1,280 passed, 61 skipped, 0 failed. Verdict: three changes requested. The theme toggle is absent in the phone header (below 768 px). A Pre-Flight tile claims CI and branch-protection checks that the checklist does not have. The contrast test still pins "bone at 60%" while the hero gradient now ends at `--text-tertiary`. Evidence is 1280 px only. No task ticked.
  - Accepted and written into the specs: the `light` system fallback and the boot script; the Tailwind-word scan on built CSS; the Button `wax` variant; `AppShell` centring at `--page-max`; `Sheet` halo; `XrayStage` centring; the four new tokens and two utilities; the light-theme blue hero glow; the landing hero, step cards, whole-card links and scaffold panel; both start screens; the refusal-spec allow-lists; the lane guards no longer listing `packages/ui` (claim-check 14.7, app-template 8.3). Requirements added: ui-kit 38, landing 14, claim-check-app 19, pre-flight-app 17; ui-kit task 13.3.
  - Not verified here: the phone-header gap was read from the code (`AppShell.tsx`), not seen in a browser; the 768 and reduced-motion projects were not run locally for #27 (CI runs them).

- Re-review of PR #26 (`d7c6a43`) and PR #27 (`a2dce41`), on `kiro/6-darkroom-review` (PR #28). No hook ran. Both approved.
  - #26: the Template's `src/lanes.test.ts` no longer lists `packages/ui/`. CI is green on all jobs, with `scaffold` taking 1m44s (a real run, where the red one failed at the probe app's guard) and `check` 19m52s. Nothing new to tick: 12.1 to 12.4 and 12 were ticked at the first review.
  - #27: `pnpm check` 1,920 passed and 1 skipped and `pnpm build` passed in a fresh worktree; the 390 and 768 projects ran the a11y, theme, shell, site and start specs, 100 passed, 0 failed. CI run 45147171714: `check` green with `pnpm e2e` 2,102 passed and 133 skipped, `scaffold` green. A throwaway Playwright spec at 320 px (not committed) found the theme button on the site, Claim Check and Pre-Flight: visible, at least 44 by 44 px, it switches the theme, no sideways scroll, and "Menu" still shows. The Pre-Flight tile now reads "Licence, the .kiro folder, the README and more" (all real checks). The contrast test checks `text-tertiary` on `bg-base` in both themes at 4.5 and the bone-at-60% assertion is gone.
  - Accepted and written into the specs: below 768 px the toggle's word is visually hidden, its icon stays and the accessible name still starts with the word (ui-kit 36.2); the phone header stacks the brand (ui-kit 38.10).
  - Not ticked: ui-kit 13.3 stays open. The kit has no Playwright check of the phone toggle of its own, and the `wax` Button has no coverage in `kit-button.spec.ts`. 13.1, 13.2 and every landing, Claim Check and Pre-Flight redesign task stay open (no command menu, `Kbd`, landing motion, SEO, verdict or report restyle).
  - Found: the main checkout was on `cc/phase6-redesign`, not on my branch, when this session started. I made one stray edit there, reverted it before any commit, and did this work in a separate worktree. Claude Code and Kiro should not share that checkout's branch.

- Review of PR #29 (`cc/phase6-shell`, head `97a2759`, ui-kit tasks 13.1 to 13.3), on `kiro/6-shell-review` in its own worktree. No hook ran. Verdict: approved to merge, with test gaps recorded as task 13.4.
  - Evidence: in a fresh worktree `pnpm check` 1,921 passed and 1 skipped, `pnpm build` passed, and the 390 and 1280 projects of `command-menu`, `theme` and `kit-button` gave 38 passed. CI run 45254334182: `check` green (`pnpm check` 1,922 passed; `pnpm e2e` 2,138 passed, 137 skipped) and `scaffold` green.
  - Probed by hand, not committed: at 390 px the "Go to" trigger in the Menu panel opens the dialog, Escape closes it and returns focus to the trigger, and the page does not scroll sideways at 320 px with the panel open. Ctrl+K does nothing while the panel is closed, because Radix unmounts it. In the open menu the input has a 2 px wax outline (seen in a 1280 px dark screenshot), so removing the Tailwind outline does not remove the ring.
  - Gaps found: `command-menu.spec.ts` skips below 768 px, so the phone placement has no test; Home, End and `onSelect` are untested; `MAX_COMMANDS` is only checked against a list of about four items; Escape returns focus to the trigger even when Ctrl+K opened the menu from elsewhere.
  - Accepted and written into ui-kit requirements 36.4, 36.5, 36.7 and 38.11 to 38.13: the trigger in the Menu panel on phones and the shortcut live only while it is open, a fade on open only, the count announced as the query changes, and landing commands left to landing 9.1.
  - Ticked: 13.3 (the phone-toggle check at 320 and 390 px, the wax Button specimens and coverage, the hero pair on both stops). Not ticked: 13.1 and 13.2, until the new task 13.4 covers the phone path and the missing key and cap tests. Landing 9.1 is untouched.

- Re-review of PR #29 at `c90ae20` for ui-kit task 13.4, on `kiro/6-shell-review` (PR #30), in its own worktree. No hook ran. It holds; 13.1, 13.2, 13.4 and 13 ticked (13.3 was ticked at the first review).
  - Evidence: CI run 45261659138 green (`check`, `scaffold`; `pnpm check` 1,923 passed; `pnpm e2e` 2,152 passed and 138 skipped). Locally in a fresh worktree `pnpm check` and `pnpm build` passed; `command-menu` on the 390, 1280 and dark projects passed 80 of 80 on a repeat of five. The new tests cover the phone path at 320 and 390 px (Menu, trigger in the panel, dialog, axe, Escape and focus back, no overflow), Home and End and an `onSelect` item on `kit/shell.html`, `visibleCommands` cutting 70 to the first 60, and the open-menu axe test in the dark and light projects.
  - Probed by hand, not committed: with focus in the page and Ctrl+K pressed, Escape returns focus to the header trigger, as requirement 36.4 now says.
  - Found, non-blocking: one first local run failed axe `color-contrast` on one node in the 390 px phone test under the 1280 project, and 104 repeats afterwards all passed. Axe likely ran while the dialog's 150 ms opacity fade was in progress. Asked for the tests to wait for opacity 1 before axe.
  - Tickable only as far as ui-kit goes: landing 9.1 (its own commands) and the `FeatureCard` and kit restyle in task 14 are untouched.

- Review of PR #31 (`cc/phase6-kit`, head `2b429b6`, ui-kit tasks 14.1 to 14.4) and the task 15 checkpoint, on `kiro/6-kit-review` in its own worktree. No hook ran. Verdict: changes requested, for one red CI test.
  - Checkpoint, run on the PR head: `pnpm check` 1,922 passed and 1 skipped; `pnpm test:props` passed; `pnpm e2e` 2,231 passed and 139 skipped; `packages/engine/src/types.ts` unchanged. CI run 45351811821: `scaffold` green, `check` red. `pnpm e2e` there had 3 failures, all "switching the theme moves nothing on the page" (1280, reduced-motion, dark), with a layout shift of 0.0000141 against an expected 0. It passed 15 of 15 on repeat locally, so the cause is not found.
  - The four listed choices are accepted. Icons at 16 px with a 2.25 stroke render 1.5 px (a deviation from "redrawn", requirement 37.3). Spotlight and shine use no gradient and stay inside 33.2. `ThemeToggle` follows `data-theme`. The rewritten tests assert the new rules, not weaker ones: a 1 px `--border-strong` Film edge, a grain `background-image`, bone strokes, 16 px icons.
  - Written into the specs: ui-kit requirements 37.3 and 38.14 to 38.17, the icon line in `design.md`, and the spotlight (`--dur-hover`) and shine (`--dur-page`) durations in the steering motion table, which had left them to this review.
  - Ticked: 14.1, 14.2, 14.3. Not ticked: 14.4, 14 and 15, until the layout-shift test is green in CI. 14.4 carries a note saying what to find.
  - Not verified here: the 28.11 bundle size (44.4 kB) is taken from the PR; the kit-size test passed in `pnpm check`. Screenshots at 390, 768 and 1280 px were not viewed.

- Re-review of PR #31 at `17e5de8` for ui-kit task 14.4 and the task 15 checkpoint, on `kiro/6-kit-review` (PR #32). No hook ran. It holds; 14.4, 14 and 15 ticked (14.1 to 14.3 were ticked at the first review).
  - Evidence: CI run 45361930424 green (`check`, `scaffold`). `pnpm check` ran 1,923 tests, all passed; `pnpm e2e` 2,231 passed and 139 skipped, read from the run log. The diff since `2b429b6` is two files: `ThemeToggle.tsx` and `theme.spec.ts`.
  - The cause of the layout shift was the toggle's width: "Dark" and "Light" differ by about 1.4 px, and the kit header right-aligns it. The fix puts both words in one grid cell, the other hidden, so the width holds. The accessible name comes from `aria-label`, so it is unchanged. `theme.spec.ts` now also asserts the toggle's box is the same after switching.
  - Written into ui-kit requirement 38.16. The note under 14.4 now records the fix.
  - Not verified: no new screenshots were taken or viewed; the toggle is about 1.4 px wider in one theme. I did not run the tests locally on `17e5de8`.

- Review of PR #33 (`cc/phase6-preflight-spacing`, one line in `apps/pre-flight/src/screens/Start.tsx`) and the new `seo` spec, on `kiro/7-seo-spec` in its own worktree. No hook ran.
  - PR #33: approved. The spacing scale has keys 0, 1, 2, 3, 4, 6, 8, 12, 16 and 24 only, so `pt-10` emitted no CSS and `pt-8` (32 px) is on the scale and matches the Claim Check start screen. CI is green (`check`, `scaffold`). I did not run it locally; the change is one class and the diff is the whole PR.
  - Decision on the three other classes: all go into specs. `md:pt-20` on the Claim Check and Pre-Flight start sections go into Claim Check task 18 and Pre-Flight task 23, as `md:pt-16` (64 px, the nearest step below 80), each checked against the 1280 px screenshot. `px-5` in `CommandMenu` (a kit file, which no app task owns) goes into new ui-kit task 16 as `px-4`, with a Vitest scan (requirement 39) that fails on any spacing class off the scale, since the cause is silent. Added ui-kit requirement 39.
  - New spec `.kiro/specs/seo/` (requirements 1 to 11, design with five properties, 15 tasks in four pull requests), from the owner's decisions of 2026-11-26: `Organization` author; the landing title keeps its full stop; prerender after landing 9.1 to 9.3 and both app redesigns (tasks 10 to 13, gated); static rulebook pages last and separate (tasks 14 and 15). Landing requirement 12 and task 9.4 are marked moved; 9.4 is ticked only so task 9 can close, and says so.
  - ui-kit prerequisite for prerender: requirement 40 and task 17 (the `ThemeToggle` server-render risk of section 5). The proposal's fix was to render both words and icons and pick by CSS. The spec keeps that, with two changes: the choice is a token-driven `visibility` (so no `prefers-color-scheme: dark` reaches the built CSS, kit requirement 33.3), and each variant carries its own accessible name as hidden text, because an `aria-label` cannot be switched by CSS. It reads the theme from `<html>` on press, so it supersedes 38.16's subscription and the shared-cell fix.
  - Found, for the human: (1) `docs/seo-proposal.md` is git-ignored (`.gitignore` line 30, `*.md`), so it is not in the repository. The spec repeats the decisions it needs. (2) `robots.txt` under `/dead-certain/` is inert on the project URL, since crawlers read it at the host root only; `noindex` rides on the meta. (3) `useMediaQuery` already has a server snapshot, so the proposal's concern about it needs no change. (4) The proposal's `Pre-Flight` description claimed "nine checks"; the spec drops all counts.
  - Not verified: the spec is not run against a build; nothing was implemented. The `og.json` text check cannot see a stale drawing, which the pull request review must look at.

- Review of PR #35 (`cc/phase6-spacing-scan`, head `880dfe0`, ui-kit task 16 and requirement 39), on `kiro/8-spacing-review` in its own worktree. No hook ran. Approved, with task 16 left unticked until CI `check` is green (it was still running).
  - Read: `spacing.test.ts` reads the scale from `theme.css`, asserts it is exactly 0, 1, 2, 3, 4, 6, 8, 12, 16 and 24, proves the scan on `pt-10`, `md:pt-20` and `px-5`, scans `packages/ui/src` and every `apps/*/src` (`.ts` and `.tsx`, tests excluded), and holds the two start screens' `md:pt-20` in a named allowlist that points to claim-check-app task 18 and pre-flight-app task 23. `CommandMenu` uses `px-4`. The PR's local evidence (not re-run here): `pnpm check` 1,925 passed, `pnpm e2e` 2,231 passed.
  - Decision 1, accepted: the X-ray scan line was 0 px wide because `w-0.5` and `h-0.5` are off the scale. It is now a 2 px `border-film` edge, which matches the design's "2 px `--film` scan line", and `claim-check-xray.spec.ts` asserts the 2 px. It is visible, because the line crosses the paper sheet. Written into ui-kit requirement 20.14.
  - Decision 2, dropped: no `scan-line` token ever existed, and the scan line is now a solid border, so it needs no gradient. Removed from the steering (the gradient-token line and the "No gradient washes" row), ui-kit requirements 33.2 and 38.5 and the design's list, which now name four allowed gradient uses. The `redesign-proposal.md` line saying the scan line "already uses one" is a record of the proposal and was left. New ui-kit task 18 removes `scan-line` from the pattern in `refusals.test.ts` (Claude Code lane).
  - Requirement 39.3 named the empty state "No results"; the real text is "Nothing matches. Try fewer letters." The requirement now quotes it.
  - Non-blocking gap: the scan checks `w`, `h`, `size`, padding, margin, gap, `space` and the inset utilities only. It does not check `min-w`, `min-h`, `max-h`, `translate`, `basis` or `leading`, and it reads `.ts` and `.tsx` only. Requirement 39.2 lists what it must cover, so this is within the spec.
  - Not verified: I did not run the tests locally, and I did not view the screenshots (they are not attached).

- Task 16 ticked on PR #36, after CI went green on PR #35 (`check`, `scaffold`) and PR #36. No hook ran. Merge order set by the human: #35, then #36, then Claude Code commits ui-kit task 18 and opens its pull request for review. Task 18 stays open.

- Review of PR #37 (`cc/phase6-gradient-allowlist`, head `928f90f`, ui-kit task 18), on `kiro/9-gradient-review` in its own worktree. No hook ran. Approved and task 18 ticked.
  - `GRADIENT_TOKENS` in `refusals.test.ts` drops `scan-line` and allows four tokens, matching ui-kit 33.2 and 38.5. The new case refuses `:root{--scan-line:linear-gradient(red,blue)}`; the PR reports it failing on the old allowlist (1 failed, 21 passed) and passing now (22 of 22). `git grep scan-line` on main found no other allowance, only `data-scan-line` element attributes. CI `check` and `scaffold` green.
  - Not verified here: the failing and passing runs and `pnpm check` are the PR figures; I did not run them locally.

- Review of PR #39 (`cc/phase7-seo`, head `77b73ff`, seo tasks 1 to 7), on `kiro/10-seo-review` in its own worktree. No hook ran. Approved; tasks 1 to 7 ticked after CI went green (`check`, `scaffold`).
  - Run here in a worktree of the PR head: the site, props, seo-vite, seo-check and refusals tests; `pnpm build`; then with both apps copied under the site, `pnpm seo:check` printed "7 pages, the sitemap and robots.txt pass". The built Claim Check page has the `PAGES` title, and its manifest has `display` "browser" and the token colour. I did not run `pnpm check` or `pnpm e2e` in full; the PR figures (1,952 passed; 2,256 e2e passed) and CI stand for those. The refusals test needs a built site, so it failed once when run before the build.
  - Decisions: (1) new apps: the plugin passes through and `seo:check` reports the page, accepted for the first pull request; the template and Claim Check keep their hand-written lines because of the drift test. New apps will get their entry from `pnpm new-app`: new app-template requirement 13 and task 9 add a fifth marker `new-app:pages` in `site.ts` and a noindex entry, derive `PageKey` from `PAGES`, and run `seo:check` in the Scaffold_Job. (2) `PageSeo.name`: accepted. (3) The refusals exception for `site.ts`: accepted, written into ui-kit 33.3; the test excludes the whole file, which is wider than the one attribute. (4) Kit titles: accepted, since they match requirement 3.1 and the kit is noindex. (5) System-only theme colour: already accepted in 4.4.
  - Carried to seo task 8: the `WebApplication` JSON-LD refers to the Organization by `@id` only and the Organization is defined on the home page. I could not confirm that a validator accepts that, so task 8 checks it by hand. Also noted: Claim Check reads its built title at module load; it works because the module runs after the HTML is parsed.
  - Not verified: Lighthouse and screenshots (none needed: no visible change), and the live site.

- Review of PR #41 (`cc/phase7-new-app-pages`, head `73ef86b`, app-template task 9 and requirement 13), on `kiro/11-newapp-review`, stacked on PR #40 (`kiro/10-seo-review`), which holds requirement 13 and is not merged yet. No hook ran. Approved; task 9 ticked after CI went green (`check`, `scaffold`).
  - Read: the `new-app:pages` marker and `PageKey` derived from `PAGES`; the planner entry (noindex, fixed description, marker indentation) with `MARKER` and `EXISTS` refusals, including `not-found`, whose key is the 404 page's; rollback over the `site.ts` edit; Property 4 over five markers; `pnpm seo:check` in the Scaffold_Job. `seo-check.ts` mounts each app's `dist` itself, so the probe is checked with no copy step.
  - Decisions: the uniqueness check on indexable pages only is accepted (seo 2.4). Steering `new-app.md` now lists three shared files, five markers, the `new-app:pages` row, the `EXISTS` refusal, how to make the app indexable, and `pnpm seo:check` in the gate. Added requirement 13.6 (`EXISTS`) and amended 8.1, 10.3, the design (counts, marker table, rollback).
  - Follow-up for Claude Code, not blocking: `README.md` line 13 still says "two shared files"; the drift test only covers the README block's commands, so it does not catch it.
  - Not verified here: the PR's `pnpm check`, e2e and the probe's own check and smoke test (CI ran them); I did not run the planner locally.

- Review of PR #43 (`cc/phase7-og`, head `8575b32`, seo tasks 8 and 9 and requirements 7.1 to 7.7), on `kiro/12-og-review`. No hook ran. Approved; tasks 8 and 9 ticked after CI went green (`check`, `scaffold`).
  - Looked at the three OG PNGs and the 512 px icon. All are 1200 by 630 (icons at their sizes), dark theme, under 200 kB (home 189 kB, Claim Check 56 kB, Pre-Flight 55 kB). The Claim Check ledger adds up: 2,10,000 less 12,000, 5,000, 28,000 and 33,000 is 1,32,000, and the home image's ₹78,000 of deductions is the same sum. The Pre-Flight rows come from `audit` over the compiled checklist. Alt texts equal `og.json` and `PAGES`, each under 125 characters.
  - Decisions, all accepted and written into the specs: JSON-LD author inlines `@type` and `name` (seo 6.2, closing the question from PR #39; not run through an outside validator); the home room is the grid only, owner choice of 2026-11-27, with grain on the film strip (7.2); the full four-deduction ledger, whose highlighted row is the kit's selected row and not a wax-muted chip (7.2); the warning row reads "Failed" because `CheckRow` has no warning state, so the image shows three passed and two failed (7.2); the "DC" icon (7.5); the site build compiling Pre-Flight's knowledge base (landing 1.3).
  - The README follow-up from PR #41 is in: three shared files.
  - The flaky X-ray scan-line timing test at 390 px failed once locally and passed in CI here; it is not this change.
  - Not verified: I did not run `pnpm og` or the tests locally, so byte-identical output is the PR's claim; I read the images, not the page they sit in on a live link preview.

- Review of PR #45 (`cc/phase8-claim-shell`, head `d346dfb`, claim-check-app task 17, requirements 16.1 to 16.5), on `kiro/13-claim-shell-review`. No hook ran. Approved and task 17 ticked. CI `check` was still running when I ticked, so the tick PR should wait for it.
  - Run in a worktree of the PR head, after `pnpm dc build` (a fresh worktree has no compiled knowledge bases, and the first run failed on that): `pnpm check` 1,966 passed and 1 skipped; `pnpm build` passed; `pnpm e2e` 2,277 passed. The failures it lists are the two console-gate tests that are meant to fail. The path in the request was `claim-check/tasks.md`; the spec is `claim-check-app`.
  - Read: `commands.ts` builds the items per step and caps at `MAX_COMMANDS`; the verdict button and the menu share one copy-link state; the toast, the live-region announcement and Dismiss returning focus to the copy button; the CommandMenu now runs the chosen item from `onCloseAutoFocus` after focusing the trigger, so an item that moves focus is not undone.
  - Decisions: the CommandMenu change is accepted and written into ui-kit 36.4 (13.2's behaviour is unchanged for Escape and Ctrl+K). Theme with no new code: accepted, the e2e checks the reload and that `dc-theme` is the only key. The shown link beside the toast: accepted, in claim-check-app 16.4 with the toast staying until dismissed or the step changes. Per-item tests at 768 px and up: accepted, with a follow-up in task 21 to run them at 390 px through the Menu panel.
  - Probed by hand, not committed: at 390 px after pressing the copy button the toast sits below it, does not cover the button (a hit test at the button's centre lands on the button), and the page does not scroll sideways. 320 px was not probed.
  - Not verified: the phone menu path of each item; the light theme of the toast; CI had not finished.

- Review of PR #47 (`cc/phase8-claim-screens`, head `ce0410f`, claim-check-app task 18, requirements 17.1, 17.2 and 17.4, plus a CI fix for `claim-check-commands.spec.ts`), on `kiro/14-claim-screens-review`. No hook ran. Approved and task 18 ticked.
  - Run in a worktree of the PR head after `pnpm dc build`: `pnpm check` 1,966 passed and 1 skipped; `pnpm build` passed; `pnpm e2e` 2,277 passed and 143 skipped. I did not run `pnpm test:props` separately; it is part of `pnpm check`. The CI fix waits for all six options before reading labels (3 plus one Change item per answer); I did not repeat it under load, the PR reports 5 of 5 in every project.
  - Probed by hand, not committed: the start section's padding-top is 64 px at 1280 and 48 px at 390. I looked at the 1280 start screen in the light theme: the headline, the calls to action and the three tiles are spaced evenly, with no gap problem. Only `projects` with `colorScheme` set are `dark`; the other four run Playwright's default light, so the PR's claim about both themes holds.
  - Decisions: no other restyle needed, accepted (requirement 17.1 now says a screen already on the kit needs only defect fixes). No new light-theme specs, accepted, with a note in task 21 to keep the colour-scheme split. The kit footer line before a verdict: kept, recorded in the design as a product sign-off on every screen. The unused `base` in `tokens.contrast.test.ts`: added to ui-kit task 17 as a one-line delete.
  - Not verified: dark-theme screenshots of the start and question screens (I viewed light at 1280 only); the question screen and rail at 390 and 768.
