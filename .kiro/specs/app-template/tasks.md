# Implementation Plan: app-template

## Overview

This plan builds `pnpm new-app <name>` and `templates/app` in TypeScript strict mode. The order is: markers and root configuration, the pure planner test-first (names, substitution, markers, ports), the applier and the entry point, the Template (package files, session code, screens, smoke spec), a real scaffold in a throwaway worktree, the CI job, then the README section.

**This spec is implemented by Claude Code, not Kiro.** Kiro wrote the spec and creates no file under `scripts`, `templates`, `e2e`, `.github` or the root. Every task below is addressed to Claude Code. Do the tasks one at a time, in order. Do not start a task while another is in progress.

**Prerequisite from the Kiro lane.** The Starter_KB (`kb/starter.yaml`, `rulebook/starter.md`, `golden/scenarios.yaml`, requirement 4) is written by Kiro on `kiro/5-template-kb` and merged before task 4.1. Tasks 1 to 3 do not need it. Until it merges, task 4 builds against a throwaway knowledge base kept under `scripts/fixtures/` that is deleted when the real one lands. Do not commit a Starter_KB of your own. The human decided that Kiro writes it, once, and that the domain is "Library fine".

## Working rules for every task

- Run every command under Node 22 (`.nvmrc`). Before the first command in a session, run `nvm use` (or an equivalent) and confirm `node -v` prints `v22.x`.
- Never use watch mode or any long-running process. Run tests with `pnpm vitest run <path>`, `pnpm test:props`, `pnpm e2e` or `pnpm check`. For screenshots use `vite build` plus `vite preview` in a background process you stop afterwards.
- **Dependencies.** None are added, except `fast-check` `4.10.2` as a root dev dependency, accepted at the gate G5 review (`scripts/` cannot resolve the app's copy). The Template pins what `apps/claim-check/package.json` pins. If a task seems to need a package, stop and ask the human.
- **Lanes.** Stay in `scripts`, `templates`, `e2e`, `.github/workflows/ci.yml`, `README.md` and the root configuration listed in task 1. Do not touch `.kiro/**`, `packages/**`, `apps/claim-check`, `apps/pre-flight`, `apps/site` or any `kb`, `rulebook` or `golden` folder. If a task cannot be done without that, stop and report.
- **Node names.** The repo has no `@types/node`. `scripts/new-app.ts` and `scripts/new-app/apply.ts` import `node:*` with `// @ts-expect-error TS2591` and declare the names they use, as `apps/claim-check/src/lanes.test.ts` does. The pure modules import no Node module.
- **No second plan.** Do not add task lists elsewhere.
- **Test-first (planner tasks).** For each: write the test, run it and keep the failing output, write the code, run it and keep the passing output.
- **Properties.** Every property test file ends in `.props.test.ts`, uses fast-check `4.10.2`, runs each property at least 100 times, and starts each property with `// Feature: app-template, Property N: <title>`.
- **Refusals (never build these in the Template).** The same as the apps: no global dark mode, no uppercase labels or `text-transform: uppercase`, no `box-shadow` other than `none`, no gradient, no scroll-triggered entrance animation, no arrow or chevron glyph in a button label, no `localStorage`, `sessionStorage`, cookie, analytics or network call, no third-party font, script or style, no pumpkins, bats or blood.
- **Copy.** Sentence case, active voice, plain words, no apology, no exclamation marks. A control keeps one name through a flow.
- **Task_Evidence (every task ends with it).** Before you ask for review, attach to the pull request: (1) `pnpm check` output, passing; (2) for planner tasks, the failing and the passing test runs; (3) for Template and screen tasks, screenshots at 390, 768 and 1280 px of what the task built (do not commit them), a clean browser console (zero errors and warnings) and a zero-violation axe result for each screen touched. For a task with no visible output, attach `pnpm check` only.
- **Marking tasks.** You do not tick boxes in this file. Kiro marks a task complete after reviewing it against the spec.
- **Commits.** Keep tool attribution on commits. Branch `cc/phase5-app-template`.

## Tasks

- [x] 1. Groundwork: markers, scripts folder and root configuration
  - Add the four Markers to `playwright.config.ts` (`// new-app:urls` after the last URL constant, `// new-app:servers` as the last line inside the `webServer` array) and to `.github/workflows/ci.yml` (`# new-app:dc-build` after the last `pnpm dc build` line, `# new-app:copy` after the last `cp -R` line). Each appears once. Change nothing else in either file.
  - Root `package.json`: add the script `"new-app": "node --experimental-strip-types scripts/new-app.ts"`. Root `vitest.config.ts`: add `scripts/**/*.test.ts` to `include`. Root `tsconfig.json`: add `scripts` to `include` and set `allowImportingTsExtensions` to true.
  - Create `scripts/new-app.ts` as a stub that prints the usage and exits 2.
  - Run `pnpm check`, `pnpm build` and `pnpm e2e` (all four projects): the Reference_Apps behave as before.
  - _Requirements: 1.1, 6.5, 11.2, 11.5_

- [x] 2. The planner, test-first
  - [x] 2.1 Names and arguments
    - `scripts/new-app/name.ts`: `validateName(name, taken)`, `RESERVED`, `titleOf`, `constOf`. `scripts/new-app/args.ts`: `parseArgs(argv)`.
    - Tests: the accepted and refused names of requirement 2.1 and 2.2 (include `a`, `a-`, `-a`, `a--b`, `A`, `a_b`, 31 characters, `kit`, `404`, an emoji, a path, a name with a space and the empty string); usage errors for no name, two names and `--force`.
    - [x]* Property 1: names are decided totally and consistently.
    - _Requirements: 1.5, 2.1, 2.2, 2.8, 3.7_
  - [x] 2.2 Substitution and the Plan
    - `scripts/new-app/substitute.ts` and `plan.ts`: `planFor(inputs, name)` returns a `Plan` or a `Refusal`, as the design's Plan section defines. Map `templates/app/e2e/smoke.spec.ts` to `e2e/<name>-smoke.spec.ts`. Refuse a path outside `apps/<name>/` and `e2e/`, an unknown `__APP_` token, and any collision.
    - Tests against the real `templates/app` files once task 4 has made them (use a small fixture Template until then): no `__APP_` remains, paths are as expected, a name in `existingApps` is refused, a shared file that already holds the constant is refused.
    - [x]* Property 2: substitution is complete and local. [x]* Property 3: the Plan is deterministic and refuses a collision.
    - _Requirements: 2.3, 2.5, 2.7, 3.2, 3.3, 3.6, 3.8, 8.1, 8.2_
  - [x] 2.3 Markers and ports
    - `scripts/new-app/markers.ts`: `insertAtMarker(text, marker, lines)` and `nextPort(text)`, over the real `playwright.config.ts` and `ci.yml` text.
    - Tests: the real files produce the expected four insertions and port 4176; zero or two Markers are refused; indentation is kept; CRLF text is kept as CRLF.
    - [x]* Property 4: a marker edit changes one thing. [x]* Property 5: ports are unique and increasing.
    - _Requirements: 2.4, 6.1 to 6.4_
  - [x] 2.4 Printing
    - `scripts/new-app/print.ts`: `formatPlan(plan)` (for `--dry-run`) and `nextSteps(plan)` (requirement 1.6). Plain text, sentence case.
    - Test: the printed steps hold the three commands and the address `http://localhost:<port>/dead-certain/<name>/`.
    - _Requirements: 1.4, 1.6_

- [x] 3. Apply and the entry point
  - [x] 3.1 `apply.ts` with rollback
    - `apply(plan, fs)` over an injected `Fs`. Record created directories and files. On failure remove them in reverse order and restore each shared file from `before`.
    - Tests: the success path writes every file; for every position n, a write that fails at n leaves the file system as it began (a loop over n, using an in-memory `Fs`).
    - [x]* Property 6: a failed apply leaves nothing behind.
    - _Requirements: 2.6_
  - [x] 3.2 `new-app.ts`
    - Find the root by the nearest `pnpm-workspace.yaml`. Read the Template files, the two shared files, the folder names under `apps/` and the workspace package names. Call `planFor`. Print and exit as the design's Error Handling table says: exit 2 for usage, 1 for a refusal or failure, 0 otherwise. No child process.
    - Tests (run the script in a temporary copy of the repo's top-level files): a real run creates the app, edits the two shared files and prints the steps; `--dry-run` creates nothing and prints the Plan; a taken name exits 1 with nothing changed; running from `apps/claim-check` finds the root.
    - [x]* Property 7: dry run changes nothing.
    - _Requirements: 1.2 to 1.8, 2.5, 8.1, 8.2_

- [x] 4. The Template
  - [x] 4.1 Package files and the Starter_KB
    - Create `templates/app/` with `package.json`, `vite.config.ts`, `index.html` and `src/styles.css` as Claim Check's, with Placeholders (requirement 3.4 and the design's table). Add `kb/open-questions.md`.
    - Copy the Kiro lane's `kb/starter.yaml`, `rulebook/starter.md` and `golden/scenarios.yaml` into `templates/app/` only when `kiro/5-template-kb` has merged. Do not edit them.
    - Write `scripts/drift.test.ts`: versions equal, names equal, exact pins (requirement 7.1 to 7.3), and the allowed-differences check on `vite.config.ts`, `index.html` and `styles.css` (requirement 7.4).
    - [x]* Property 9: the Template follows Claim Check.
    - _Requirements: 3.1, 3.4, 3.5, 4.1 to 4.5, 7.1 to 7.4_
  - [x] 4.2 Session code
    - Copy `session/path.ts`, `replay.ts` and `store.ts` from Claim Check and take out what is Claim Check's: the skipped notes, the what-if and the money checks. Keep `path.ts` and `replay.ts` as they are where possible. Copy their tests. `route.ts`, `useTitle.ts` (title suffix `__APP_TITLE__`), `kb.ts`, `kbShape.ts` (with the `verdictGoal` check) and `json.d.ts` come over the same way.
    - `config.ts` names `verdictGoal` and nothing else, and no other file names a fact (requirement 5.3). Add a test that scans `src/` for the Starter_KB's fact names outside `config.ts`.
    - [x]* Property 8: the Generated_App's session round-trips (fast-check over the Starter_KB's answers).
    - _Requirements: 5.2, 5.3, 5.7, 5.8_
  - [x] 4.3 Screens
    - `Start`, `Consult`, `Verdict`, `Xray`, `LoadFailure`, `NotFound`, `Stale` and `main.tsx`, as the design describes them, on the kit only. No ledger, no proportion bar, no what-if, no rulebook page.
    - `Verdict` shows `VerdictHeadline` when `verdictStateFrom` maps the goal's value and a plain level-1 heading otherwise. `Xray` uses `XrayStage`, `ProofTree` and `ClauseQuote`.
    - Build the Template into a throwaway worktree with task 5's steps to take the screenshots. The Task_Evidence shows the start screen, a question, the verdict, the open X-ray, the load-failure notice and the stale-link notice at 390, 768 and 1280 px.
    - _Requirements: 5.1, 5.4 to 5.6, 5.8 to 5.12_
  - [x] 4.4 Lane guard and the smoke spec
    - `src/lanes.test.ts` (the guard of requirement 8.3). `e2e/smoke.spec.ts`: open the app at its preview URL, answer each starter question through the interface, reach the verdict, open "See why", find the clause, run axe, as requirement 6.6 says. Write the URL as a string literal, `"http://localhost:__APP_PORT__/dead-certain/__APP_NAME__/"`, so the file is valid TypeScript before substitution.
    - Add `scripts/template.test.ts`: run `planFor` over the real Template for the name `probe-app`, write it to a temporary directory and run Biome over the result. A lint error fails the test.
    - _Requirements: 3.4, 6.6, 8.3_

- [x] 5. A real scaffold, by hand
  - In a throwaway `git worktree` of the branch, run the README commands as written for `probe-app`: `pnpm install`, `pnpm new-app probe-app`, `pnpm install`. Then `pnpm dc validate`, `pnpm dc golden`, `pnpm check`, `pnpm build`, and `pnpm e2e` for the `probe-app` smoke spec in all four projects. Start the dev server in the background, load the page, stop it.
  - Attach the output and the screenshots. Remove the worktree. Do not commit the scaffold.
  - Report how long the commands took, and anything that needed a step the README does not have.
  - _Requirements: 1.3, 4.4, 5.9 to 5.11, 6.6_

- [x] 6. The Scaffold_Job
  - [x] 6.1 `scripts/readme-block.ts`
    - `extractBlock(readme)` returns the lines of the first `sh` block under "Add a third app", and the CLI form `readme-block.ts <name>` prints them with `my-app` replaced. It exits 1 when the heading or block is missing.
    - Tests: the real README; a README with the block moved; a README with no heading; a block with Windows line endings.
    - _Requirements: 9.2, 10.2_
  - [x] 6.2 The job
    - Add the `scaffold` job to `ci.yml` as the design shows, with a runner-only `.npmrc` that sets `frozen-lockfile=false` (pnpm 10 ignores `PNPM_CONFIG_FROZEN_LOCKFILE` under `CI=true`) and its comment, `pnpm dc build` before `pnpm check`, the changes step (decided: path filters), and no upload or commit. `check` is unchanged.
    - Push the branch and show the job's green run in the pull request. Show also a red run: break the README block locally in a throwaway commit and show the job fail, then revert it. Since CI runs only on pull requests, the red run is a pushed throwaway commit and its revert.
    - _Requirements: 9.1 to 9.5_

- [x] 7. The README section
  - Write the section "Add a third app" (requirements 10.1 to 10.8) above "Claim Check". Leave the time figure out (10.6).
  - Run `scripts/readme-block.ts probe-app` and confirm it prints the three commands.
  - _Requirements: 10.1 to 10.8_

- [x] 8. Final checkpoint
  - Run `pnpm check`, `pnpm test:props`, `pnpm build`, `pnpm dc validate`, `pnpm dc golden` and `pnpm e2e`. All must pass, with the Reference_Apps unchanged.
  - Attach the Task_Evidence for the whole work: the scaffold run of task 5, the Scaffold_Job's green and red runs, and the Generated_App's screens at 390, 768 and 1280 px.
  - Confirm `git diff --stat main...HEAD` shows changes only in `scripts`, `templates`, `e2e`, `.github/workflows/ci.yml`, `README.md`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts` and `pnpm-lock.yaml`.
  - Open the pull request for gate G5. Kiro reviews it against this spec. State what you could not finish.
  - _Requirements: all_

- [ ] 9. A new app's search metadata entry (Claude Code lane, from the review of PR #39; after `seo` task 7)
  - Add the marker `// new-app:pages` inside `PAGES` in `packages/ui/src/site.ts`, and derive `PageKey` as `keyof typeof PAGES` (adjust `APPS` and `SOURCES` to match). Extend the planner, test-first, to insert the entry of requirement 13.3 and to refuse when the marker is missing or doubled. Add the `seo:check` step to the Scaffold_Job. Do not edit `.kiro/steering/new-app.md`, which is Kiro's: say in the pull request what it must list.
  - Tests: the planner inserts one entry with the marker's indentation and changes nothing else (extend Property 4); rollback restores `site.ts`; the Scaffold_Job's probe app passes `seo:check`.
  - Close with Task_Evidence.
  - _Requirements: 13.1 to 13.6_

## Notes

- Gate G5 review (Kiro, 2026-11-22): tasks 1 to 8 are ticked. Two parts of the Task_Evidence are not on the pull request: the 18 screenshots were shared with the human outside it, and the Scaffold_Job's two runs were cancelled as workflows by a later push, though each `scaffold` job finished (green on `bf911a7`, red on `0ce19b6`, green again on `3b0b75b`). Task 2.3 was built before 2.2, which is accepted.
- Follow-up for the Claude Code lane, not blocking: `planFor` refuses a valid name that is a prefix of an existing app (`claim`, `pre`), because it looks for `apps/<name>` as plain text in the shared files. Match the whole path segment.

- Tasks marked `*` are property tests. Run them with the task before them, not later.
- All seven open questions are answered (see the requirements). The only wait is the Kiro-lane pull request `kiro/5-template-kb`, which task 4.1 needs.
- Phase 5 also has the human's own task: scaffold a third app from the README alone, time it, and record the screen. The time goes into the README by hand (requirement 10.6).
- The human's run in Phase 5 is the real test of "from the README alone". Task 5 and the Scaffold_Job make it likely to pass. They do not replace it.
- The Kiro lane's gate review checks every requirement against the evidence, rewrites `.kiro/steering/new-app.md` (requirement 12.3) and amends this spec if it accepts a deviation.
