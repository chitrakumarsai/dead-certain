# Implementation Plan: landing-page

## Overview

This plan builds the landing page in `apps/site` in TypeScript strict mode. The order is: build wiring and the data check, the hero model test-first, the Hero with its X-ray, the steps, the two apps and the scaffold command, the shell, metadata and 404 page, then the end-to-end suite, budgets and evidence.

**This spec is implemented by Claude Code, not Kiro.** Kiro wrote the spec and creates no file under `apps/` or `e2e`. Every task below is addressed to Claude Code. Do the tasks one at a time, in order. Do not start a task while another is in progress.

**Prerequisites.** `apps/claim-check/kb/policy.yaml` and its golden scenario `G-01` exist (Phase 2). The kit's components exist (`ui-kit`). Nothing is needed from the Kiro lane. If `pnpm dc build apps/claim-check` fails, stop and report.

## Working rules for every task

- Run every command under Node 22 (`.nvmrc`). Before the first command in a session, run `nvm use` (or an equivalent) and confirm `node -v` prints `v22.x`.
- Never use watch mode or any long-running process. Run tests with `pnpm vitest run <path>`, `pnpm test:props`, `pnpm e2e` or `pnpm check`. For screenshots use `vite build` plus `vite preview` in a background process you stop afterwards.
- **Dependencies.** Task 1 adds `@dead-certain/engine` and `@dead-certain/kb-tools` (both `workspace:*`) to the site. No other package is added. Pin existing versions to what the site already uses. If a task seems to need another package, stop and ask the human.
- **Lanes.** Stay in `apps/site`, `e2e` and the root configuration you need. Do not touch `.kiro/**`, `packages/**`, `apps/claim-check`, `apps/pre-flight` or any `kb`, `rulebook` or `golden` folder. Do not edit `packages/engine/src/types.ts`.
- **No imports from the apps' source.** Nothing under `apps/site/src/landing` imports from `apps/claim-check/src` or `apps/pre-flight/src`. Copy the small functions the design names, and keep the copies pinned by tests. The one file read from an app is `apps/claim-check/kb/dist/policy.json`.
- **Names.** Only `hero/config.ts` names a fact or a goal.
- **Design system.** Load `.kiro/steering/design-system.md` and section 8 of `docs/BUILD_PLAN.md`. Use the kit's components and tokens. Define no colour, font or spacing value of your own.
- **Refusals (never build these).** No global dark mode. No uppercase labels or `text-transform: uppercase`. No `box-shadow` other than `none`. No gradient. No scroll-triggered entrance animation. No arrow or chevron glyph in a button label. No `localStorage`, `sessionStorage`, cookie, analytics or third-party request. No pumpkins, bats or blood. No motion except the X-ray develop.
- **Copy.** Sentence case, active voice, plain words, no apology, no exclamation marks. Use the exact strings quoted in the requirements. A control keeps one name through a flow.
- **Tests.** Pure logic in Vitest with no DOM. The page in Playwright against the built site. Every property test file ends in `.props.test.ts`, uses fast-check `4.10.2`, runs each property at least 100 times, and starts each with `// Feature: landing-page, Property N: <title>`.
- **Task_Evidence (every task ends with it).** Before you ask for review, attach to the pull request: (1) screenshots at **390, 768 and 1280 px** of what the task built (do not commit them; for a task with no visible output, attach the page at the three widths); (2) a clean browser console read, zero errors and zero warnings; (3) a zero-violation axe result for each state touched; (4) `pnpm check` output, passing. Test-first tasks add the failing and the passing runs.
- **Marking tasks.** You do not tick boxes in this file. Kiro marks a task complete after reviewing it against the spec.
- **Commits.** Keep tool attribution on commits. Branch `cc/phase5-landing-page`.

## Tasks

- [ ] 1. Build wiring and the data check
  - In `apps/site/package.json` set `build` to `pnpm -w run dc build apps/claim-check && vite build` and add `@dead-certain/engine` (dependencies) and `@dead-certain/kb-tools` (devDependencies), both `workspace:*`. Run `pnpm install` and commit the lockfile change.
  - Create `src/landing/config.ts` (imports the compiled JSON as `unknown`, with a `json.d.ts` declaration) and `src/landing/kbShape.ts` (copy of the apps' shape check). Add a unit test with a good and several broken inputs.
  - Replace `index.html` with the new entry (title, description, Open Graph text tags, the three font preloads as the apps' pages have them, `<noscript>`, `#root`, the module script). Delete `src/placeholder.css`. Add `src/landing/styles.css` and a `main.tsx` that mounts `AppShell` with the four nav entries and the default footer, and an empty `<main>`.
  - Keep `/kit/` building as before. Run `pnpm build` and `pnpm e2e` for the `kit-*` specs (all four projects).
  - _Requirements: 1.1 to 1.4, 1.6, 1.9, 1.10, 6.1, 6.2, 9.7_

- [ ] 2. The hero model, test-first
  - [ ] 2.1 Config and golden pin
    - `hero/config.ts` with the `G-01` facts and the goal and fact names. Write `hero/hero.golden.test.ts` first: read `apps/claim-check/golden/scenarios.yaml` with kb-tools' golden loader, check `HERO_FACTS` equals `G-01`'s facts, and check `audit` on the compiled KB equals its `expect` block (goals and all eight line items). Run it red, then green.
    - _Requirements: 2.5, 8.1, 8.2_
  - [ ] 2.2 `heroModel`
    - `hero/model.ts` and `hero/because.ts`: copy `ledgerFrom`, `partsFrom`, `statementFor`, `withPrintedBecause` and `printValue` from `apps/claim-check/src` (verdict/parts.ts, verdict/statement.ts, xray/because.ts, session/relevance.ts), with the Claim Check names replaced by `hero/config.ts`. Add `heroModel(kb)` returning a model or a `HeroFailure`, never throwing, with the ledger check.
    - Tests: the model for `HERO_FACTS` (statement "₹1,32,000 of ₹2,10,000 will be paid", state `reduced`, four non-zero rows); a renamed fact gives `engine_error`; a wrong goal type gives `kb_mismatch`; a ledger that does not add up gives `ledger_mismatch`; the benchmark under 10 ms.
    - [ ]* Property 1: the hero relays the engine. [ ]* Property 2: the ledger adds up or the page refuses. [ ]* Property 5: proof sentences print money as money.
    - _Requirements: 2.3, 2.4, 8.1, 8.2, 8.6, 9.3_
  - [ ] 2.3 Lane scan
    - `landing/lane.test.ts`: fail on an import from `apps/claim-check/src` or `apps/pre-flight/src`, on `fetch`, `XMLHttpRequest`, `localStorage`, `sessionStorage` and `document.cookie` anywhere under `apps/site/src/landing`.
    - _Requirements: 1.5, 1.7, 8.4_

- [ ] 3. The Hero and its X-ray
  - [ ] 3.1 The verdict sheet
    - `Hero.tsx`: the `<h1>` "LLMs guess. The dead are certain.", the paragraph (at most 40 words), and the Verdict_Sheet in a `Sheet` with `VerdictHeadline` (`headingLevel={2}`), `ProportionBar`, `Ledger`, the honesty line, "See why", "Check your own claim" (a native anchor styled as the kit's secondary button) and the `Disclosure` "Answers used for this claim". Show `SampleFailed` for a `HeroFailure`.
    - Wire it into `main.tsx`. No X-ray yet.
    - _Requirements: 2.1 to 2.4, 2.6 to 2.10, 7.4, 8.5_
  - [ ] 3.2 The X-ray
    - Wrap the sheet in `XrayStage` with the titles "Why" and "Why: <label>". Add `hero/Film.tsx` (the proof body) as the design describes. "See why" and each ledger row set the target and pass the opener.
    - Check by hand and in a test: Escape returns focus to the control that opened it; the film is a bottom sheet below 1280 px and side by side from 1280 px; with reduced motion there is no scan line; no "Change this answer" control appears.
    - [ ]* Property 3: every ledger row has a proof that agrees.
    - _Requirements: 3.1 to 3.7, 7.5, 7.6, 7.8_

- [ ] 4. The three steps
  - `steps.ts` and `Steps.tsx` as the design describes. Choose `STEP_RULE`: a rule in the proof of `room_rent_deduction` whose printed expression is at most 90 characters. Record the id in `hero/config.ts`. Add a test that fails when the rule is not in that proof, is missing, or is longer than 90 characters.
  - The first step shows the cited clause in a `ClauseQuote` and the link to `claim-check/#/rulebook?clause=<id>`. The second shows the rule. The third has the anchor that opens the verdict's proof.
  - Test the missing-rule and missing-clause fall-backs.
  - [ ]* Property 4: quoted text is the knowledge base's text.
  - _Requirements: 4.1 to 4.7, 8.3_

- [ ] 5. The two apps and the scaffold command
  - `Apps.tsx` and `Scaffold.tsx` as the design describes, with links built from `import.meta.env.BASE_URL`. "Copy command" copies `pnpm new-app my-app`, announces "Copied", and falls back to selecting the text.
  - The link to the README section goes to the repository's README (open question 7 decides the exact address). Add the source link to the nav.
  - [ ]* Property 6: links are built from the base.
  - _Requirements: 5.1 to 5.6_

- [ ] 6. The 404 page and print styles
  - Add `404.html`, `404.tsx` and `NotFound.tsx` and the `notfound` input in `vite.config.ts`. One level-1 heading, one dry sentence, a link home, absolute asset paths.
  - Add print rules to `styles.css`: print the Verdict_Sheet and the Steps, hide the nav and the controls.
  - Check the built `dist/404.html` loads its assets from `/dead-certain/` paths.
  - _Requirements: 6.3 to 6.5, 7.9_

- [ ] 7. End-to-end, budgets and privacy
  - Replace `e2e/site.spec.ts` with the cases in the design's "End-to-end cases", at all four projects. Add the axe checks (page, X-ray open, 404), the privacy test (requests and storage), the failure-path test (compiled JSON replaced by a route) and the budget test (gzipped JavaScript under 200 kB without the develop chunk, layout shift under 0.05) as `e2e/site-*.spec.ts` files next to it.
  - Run the full `pnpm e2e`. The existing kit specs pass unchanged.
  - _Requirements: 8.5, 9.1, 9.2, 9.4 to 9.7_

- [ ] 8. Final checkpoint
  - Run `pnpm check`, `pnpm test:props`, `pnpm build`, `pnpm dc validate`, `pnpm dc golden` and `pnpm e2e`. All must pass.
  - Attach the Task_Evidence for the whole page: the hero closed and open, a row's proof, the steps, the cards and the scaffold block, the 404 page, the failure notice and the print preview, at 390, 768 and 1280 px, and the reduced-motion X-ray.
  - Confirm `git diff --stat main...HEAD` shows changes only in `apps/site`, `e2e`, `pnpm-lock.yaml` and nothing else.
  - Open the pull request for gate G5. Kiro reviews it against this spec. State what you could not finish. After the merge, the human loads the live URL in a private window and presses "See why" (requirement 10.2).
  - _Requirements: all_

## Notes

- Tasks marked `*` are property tests. Run them with the task before them, not later.
- Questions that block a task: open question 3 (the sample claim) blocks task 2.1. Open question 7 sets the link in task 5. Questions 1, 4, 5 and 6 change scope: answer them before task 3 so no work is redone.
- The pull request's checks run the apps' builds too, since the site's `dist` takes copies of them in CI. A change to Claim Check's facts breaks the golden pin in task 2.1 on purpose.
- The Kiro lane's gate review checks every requirement against the evidence, and amends this spec if it accepts a deviation.
