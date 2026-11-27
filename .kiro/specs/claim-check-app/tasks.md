# Implementation Plan: claim-check-app

## Overview

This plan builds Claim Check (`apps/claim-check`) in TypeScript strict mode: the start screen, the consultation flow, the verdict, the X-ray proof view, the rulebook page, the replay link with its stale-link notice, the 404 page, and a Playwright test of every golden scenario. The order is: scaffold, knowledge-base loading, pure logic, screens from the start of the journey to the end, the rulebook and 404, then the golden and cross-cutting e2e tests.

**This spec is implemented by Claude Code, not Kiro.** Kiro wrote the spec and creates no file under `apps/` or `e2e`. Every task below is addressed to Claude Code. Do the tasks one at a time, in order. Do not start a task while another is in progress.

**Prerequisites from the Kiro lane (Phase 2).** `apps/claim-check/kb/*.yaml`, `apps/claim-check/rulebook/` and `apps/claim-check/golden/*.yaml` do not exist yet. Task 2 needs the compiled knowledge base. Tasks 14 and 15 need the golden scenarios. If a prerequisite is missing, stop at that task and tell the human. Never write a knowledge base, rulebook or golden file yourself, and never invent goal names.

## Working rules for every task

- Run every command under Node 22 (`.nvmrc`). Before the first command in a session, run `nvm use` (or an equivalent) and confirm `node -v` prints `v22.x`.
- Never use watch mode or any long-running process. Run tests with `pnpm vitest run <path>`, `pnpm test:props`, `pnpm e2e` or `pnpm check`. For screenshots use `vite build` plus `vite preview` in a background process you stop afterwards, or ask the human to start a server.
- **Dependencies.** Task 1 picks exact versions with `context7`, copying the versions `apps/site` already pins for React, Vite, Tailwind and the Vite plugins. Pin every dependency to an exact version: no `^`, no `~`. If a task needs a package outside React, Vite, Tailwind CSS, Radix primitives, Motion and the workspace packages, **stop and ask the human before adding it**. A router, a state library, a YAML parser, jsdom and Testing Library are all refused. The golden e2e reads YAML through `@dead-certain/kb-tools`.
- **Lanes.** Stay in `apps/claim-check` (except `kb`, `rulebook`, `golden`), `e2e` and the root configuration you need. Do not touch `.kiro/**`, `packages/ui`, `packages/engine` or `packages/kb-tools`. Do not edit `packages/engine/src/types.ts`. If a task seems to need a change there, stop and seek consent from both lanes. Where the contract or the kit lacks a value, take it as an app-side prop or helper, as the design says.
- **Engine imports.** The app may import values from `@dead-certain/engine` (`start`, `next`, `answer`, `explain`, `whatIf`, `encode`, `decode`, `print`, `EngineError`). It never calls `audit`.
- **Names.** Only `src/config.ts` names a fact or a goal. Every other module reads the knowledge base.
- **Refusals (never build these).** No uppercase labels or `text-transform: uppercase`. No caption above a heading. No arrow or chevron glyph in a button label. No `box-shadow`, gradient or `prefers-color-scheme: dark` unless the value comes from a token in `tokens.css` and the use is on the list in `.kiro/steering/design-system.md` (inset highlight, wax glow, paper halo; hero radial glow, hero headline fill, graph-paper grid, film grain, scan line; `prefers-color-scheme` in `tokens.css` only). No entrance animation on scroll, except the landing page's one fade and 16 px rise per section. No Tailwind `uppercase`, `ring` or `shadow` utilities. No `dangerouslySetInnerHTML`. No `localStorage` except the theme choice (`dc-theme`) in `packages/ui/src/theme/storage.ts`; no cookies, analytics or network request. No emoji. No exclamation marks. No apologies. No pumpkins, bats or blood. No `hairline` on text or control borders. No `wax` as text on paper or the light theme. No new dependency. (Replaced 2026-11-23. Tasks 1 to 16 as built followed the earlier refusals.)
- **Copy.** Sentence case, active voice, plain words, no apology. Use the exact strings quoted in the requirements. A control keeps one name through a flow.
- **Tests.** Pure logic is tested in Vitest with no DOM. Screens are tested in Playwright against the built app. Every property test file ends in `.props.test.ts`, uses fast-check `4.10.2`, runs each property at least 100 times, and starts each property with a comment `// Feature: claim-check-app, Property N: <title>`.
- **Task_Evidence (every task ends with it).** Before you tick a task, produce all four, and attach them to the pull request:
  1. Screenshots at **390, 768 and 1280 px** of what the task built. Do not commit them. For a task with no visible output, attach the unchanged start screen at the three widths.
  2. A clean browser console read: zero `error` and zero `warning` messages.
  3. A zero-violation axe-core result for each screen the task touched.
  4. `pnpm check` output, passing.
- **Marking tasks.** You do not tick boxes in this file. Kiro marks a task complete after reviewing it against the spec. Report what you did and attach the evidence.
- **Commits.** Keep tool attribution on commits. Branch `cc/phase3-claim-check`.

## Tasks

- [x] 1. Scaffold the app
  - Create `apps/claim-check` with `package.json` (`@dead-certain/claim-check`, exact pinned versions, scripts `dev`, `build`, `preview`), `vite.config.ts` (React, Tailwind plugin, `base: "/dead-certain/claim-check/"`), `tsconfig.json` extending the root, `index.html`, `src/main.tsx` and `src/styles.css` importing the kit's `tokens.css` and `styles.css`. Mirror `apps/site` for structure and versions.
  - Render `AppShell` with app name "Claim Check", the two nav entries and a placeholder child.
  - Add the app to the Playwright config as a second web server or a combined preview, so `pnpm e2e` serves it. Add one smoke test in `e2e/claim-check-shell.spec.ts` that opens the app and finds the nav and the footer.
  - `pnpm -r ls --depth 0` lists the package. `pnpm build` builds it.
  - _Requirements: 1.1, 1.2, 1.6, 12.4, 14.1, 14.3_
  - _Cross-lane:_ the Playwright config and root files are in your lane.

- [x] 2. Load the compiled knowledge base
  - Prerequisite: `apps/claim-check/kb/*.yaml` exists. If it does not, stop and tell the human.
  - Run `pnpm dc build`, find where the JSON is written, and record the path and the three goal names in `src/config.ts` (`amountGoal`, `stateGoal`, `claimedFact`). Confirm the names with the human if the knowledge base does not match the assumed ones in open question 1.
  - Write `src/kb.ts`: import the JSON, check its shape against `KnowledgeBase` with a hand-written guard (no validation library), and export `kb`, `format` (`{ currency: kb.currency }`), `labelFor`, `defFor`, `clauseFor`, `ruleExpression` (using `print`).
  - Write `src/screens/LoadFailure.tsx` and show it when the guard fails.
  - Vitest: the guard accepts the real knowledge base, rejects an object with a missing `goals`, and `labelFor` falls back to `humanize`.
  - _Requirements: 1.3, 1.7, 1.8_

- [x] 3. Replay and fragment module
  - [x] 3.1 Write `src/session/replay.ts`: `readFragment`, `writeFragment` (with `history.replaceState`) and `decodeFragment`, with the error mapping in the design.
    - Vitest: valid `#/?r=<token>` returns a session; `#/` returns null; a token for another knowledge base returns `KB_MISMATCH`; garbage returns `MALFORMED_TOKEN`; a non-`EngineError` throw returns `MALFORMED_TOKEN` and carries no message.
    - _Requirements: 10.1, 10.2, 10.3, 11.1, 11.2, 11.3_
  - [x]* 3.2 Property tests.
    - Property 3: replay round trip.
    - Property 4: a damaged fragment never produces a verdict.
    - _Requirements: 10.3, 10.4, 11.1 to 11.4_

- [x] 4. Question path, relevance and progress
  - [x] 4.1 Write `src/session/path.ts` (`questionPath`), `src/session/relevance.ts` (`relevantFacts`, `skippedNotes`) and `src/session/progress.ts`.
    - Vitest against the real knowledge base: a known set of answers gives the expected path; changing an answer that decides the outcome produces the expected skipped note text, "Not needed now that <label> is <value>."
    - _Requirements: 3.4, 3.12, 3.14, 4.1, 4.5, 4.6_
  - [x]* 4.2 Property tests.
    - Property 1: the question path does not depend on answer order.
    - Property 2: the path ends and asks nothing twice.
    - Property 6: relevance is stable.
    - Property 7: changing an answer and changing it back restores the view.
    - Property 9: progress never lies the unsafe way.
    - Generate answers by running consultations with fast-check values that match each fact's type and options.
    - _Requirements: 3.4, 3.12, 3.14, 4.1 to 4.7, 5.5_

- [x] 5. Session store
  - Write `src/session/store.ts`: the reducer over `ViewState` and the actions in the design, and `useSession`, which writes the fragment after every session change and listens to `hashchange`.
  - The reducer is pure. Vitest: `start` clears failure; `answer` replaces the session and sets `arrivedByAnswer` only when the result is a verdict; `edit` sets `editing`; `back` goes to the previous fact of the path; `restart` clears answers and skipped notes; `open` then an `answer` that removes the target closes the proof.
  - _Requirements: 3.7, 3.12, 3.13, 4.4, 5.2, 5.3, 6.8, 8.12, 10.1, 10.7_

- [x] 6. Start screen
  - Write `src/screens/Start.tsx` and mount the router in `main.tsx` with the three routes. The check page chooses its screen from `step(view)`.
  - Exact copy from requirement 2. "Start the check" is a primary Button; "Read the sample policy" links to the rulebook route. Focus moves to the first question's heading on start.
  - Playwright `e2e/claim-check-start.spec.ts`: heading, paragraph, both controls and both lines present; Enter on the button starts; focus lands on the question heading; no uppercase text, no arrow glyph; axe clean at three widths.
  - _Requirements: 2.1 to 2.8, 1.9_

- [x] 7. Consultation flow
  - Write `src/screens/Consult.tsx`: `QuestionCard` built from `next(session)` and the fact's `FactDef`, with the clause from `clauseFor`, the progress prop from task 4, `onBack`, `externalError` and `unit` from the definition. Submitting calls the reducer's `answer`.
  - Put the polite live region announcement on every new question. Focus the new heading.
  - Playwright `e2e/claim-check-consult.spec.ts`: each control type appears for a fact of that type (one test per type the knowledge base uses); empty and invalid input give the kit's message and no step; Enter submits; number keys pick an option; Escape closes the disclosure; Back shows the previous answer; "Why this question?" shows the clause; the progress line reads correctly; the engine's `INVALID_ANSWER` path shows the message and leaves the question in place.
  - _Requirements: 3.1 to 3.14_

- [x] 8. Answers rail and recompute
  - Write the rail: `AnswersRail` with entries from `relevantFacts` in path order, `onChange` dispatching `edit`, `skipped` from the store, `current` set to the open question. Pass it to `AppShell`.
  - Live-region sentence on every change, for example "Room rent changed. The verdict updated."
  - Playwright `e2e/claim-check-rail.spec.ts`: the rail is a margin at 1280 px and a disclosure at 390 px; activating an answer shows its question filled in; submitting a changed answer recomputes with no confirmation; a change that removes a question shows the skipped note and the removed answer leaves the rail; changing back restores both; `aria-current` is set.
  - _Requirements: 4.1 to 4.9_

- [x] 9. Verdict screen and early stop
  - [x] 9.1 Write `src/verdict/parts.ts` and `src/verdict/statement.ts`: `partsFrom`, `ledgerFrom`, and the headline state and statement.
    - Vitest: parts sum to the claimed amount; an unknown line is left out of parts; a zero line is left out; the denied statement reads "₹0 of ₹… will be paid" with the knowledge base's currency; formatting uses `formatMoney`.
    - _Requirements: 6.1 to 6.6, 6.9_
  - [x]* 9.2 Property test.
    - Property 5: the ledger adds up.
    - _Requirements: 6.3, 6.4, 6.5_
  - [x] 9.3 Write `src/screens/Verdict.tsx`: `VerdictHeadline`, `ProportionBar`, `Ledger`, `WhatIfList` (only when alternatives exist), the three buttons, and the "That is enough to decide" line driven by `arrivedByAnswer`.
    - Add the print rule that hides the rail and the actions and fits the page.
    - Playwright `e2e/claim-check-verdict.spec.ts`: a paid, a reduced and a denied case each show the right state icon and word; the statement and ledger match the engine's amounts; what-if is shown with its signed change and omitted when empty; "Start over" returns to the start screen and clears the fragment; "That is enough to decide" appears after an answer and not on a replay link; no question follows a verdict; a printed-media check fits one page.
    - _Requirements: 5.1 to 5.5, 6.1 to 6.11, 7.1 to 7.4_

- [x] 10. Replay link and stale-link notice
  - Wire "Copy link to this verdict": copy `location.href`, show it as text in the Machine voice, announce "Link copied". When the clipboard refuses, show the selectable text with "Copy this link by hand."
  - Write `src/screens/Stale.tsx` over `StaleLinkNotice`, with `rulebookHref` for `KB_MISMATCH`, focus on its heading, and "Start the check" clearing the fragment.
  - Playwright `e2e/claim-check-replay.spec.ts`: the fragment follows each answer and empties on start over; the same link opens the same verdict and ledger in a new page; editing the fragment while open re-decodes; a link made for another knowledge base shows the `KB_MISMATCH` notice; a cut token shows `MALFORMED_TOKEN`; a token with a changed version byte shows `UNSUPPORTED_VERSION` (build the three tokens in the test from a real token); no verdict or question shows behind a notice; denied clipboard shows the fallback.
  - _Requirements: 10.1 to 10.8, 11.1 to 11.7_

- [x] 11. Checkpoint: the consultation journey
  - Run `pnpm check`, `pnpm test:props` and `pnpm e2e` for the Claim Check specs. Record the results. Ask the human whether anything is unclear before the X-ray work.

- [x] 12. X-ray proof view
  - [x] 12.1 Write `src/screens/Xray.tsx` over `XrayStage`: target from the store, title "Why" or "Why: <label>", `FilmBody` with `ProofTree` keyed by target, `ruleExpression`, `clauseFor`, `decidingClause`, `onChangeAnswer` (close then edit) and the deciding `ClauseRef`.
    - Open it from "See why" (verdict) and from each ledger row (line), with `explain(session, goal or fact)`.
    - _Requirements: 8.1 to 8.7, 8.11, 8.12_
  - [x] 12.2 Playwright `e2e/claim-check-xray.spec.ts`.
    - "See why" opens "Why"; a ledger row opens "Why: <label>"; each rule shows its sentence first and its expression behind "Show the rule"; source badges read "You answered", "Collected" or "Worked out"; the deciding clause carries the wax variant; "Change this answer" closes the panel and shows the question filled in.
    - At 1280 px paper and film sit side by side; at 390 px the film is a sheet.
    - Keyboard: arrows move, Enter expands, Escape closes and focus returns to the opener.
    - Develop: with motion allowed the scan line crosses once in about 500 ms; in the `reduced-motion` project there is no scan line and the film fades in over about 120 ms. Assert from the animation's timing on the real page, not from a screenshot.
    - Changing an answer that removes the open line closes the panel.
    - _Requirements: 8.1 to 8.13_

- [x] 13. Rulebook page and 404
  - [x] 13.1 Write `src/rulebook/coverage.ts` and `src/screens/Rulebook.tsx`.
    - `coverage(kb)` gives `byClause`, `byRule` and `missing`. The page lists clauses in natural id order with their rules or "Not used in any decision", a second list of every rule with its clause, and "Cites a missing clause" for broken cites. `?clause=<id>` focuses that clause.
    - Vitest: coverage on the real knowledge base and on a small knowledge base with an uncited clause and a rule with a missing cite. Natural sort puts `4.10` after `4.9`.
    - _Requirements: 9.1 to 9.8_
  - [x]* 13.2 Property test.
    - Property 8: coverage is complete both ways.
    - _Requirements: 9.2 to 9.5_
  - [x] 13.3 Write `src/screens/NotFound.tsx`.
    - "Page not found", one dry line, links to the check and the rulebook, focus on the heading, document title "Page not found. Claim Check", no exclamation mark.
    - _Requirements: 12.1 to 12.5_
  - [x] 13.4 Playwright `e2e/claim-check-pages.spec.ts`.
    - Every clause appears with its citing rules; an uncited clause (use a build with one if the real knowledge base has none, or skip with a visible note) says "Not used in any decision"; every rule appears with its clause; `?clause=` focuses the clause. An unknown route (for example `#/nowhere`) shows the 404 page with working links. Axe clean at three widths on both pages.
    - _Requirements: 9.1 to 9.8, 12.1 to 12.5, 13.1_

- [x] 14. Golden scenario tests
  - Prerequisite: `apps/claim-check/golden/*.yaml` holds at least 12 scenarios. If not, stop and tell the human.
  - Write `e2e/claim-check-golden.spec.ts` as the design describes. Read scenarios with the `@dead-certain/kb-tools` loader. Generate one `test()` per scenario with its id and title in the name. Drive the real interface only. Build every expected string with `formatMoney` from minor units.
  - Per scenario: answer by label through the matching control; assert the state word, statement, payable and claimed amounts, exactly the expected non-zero ledger rows, each `fires` rule id in the proof, the expected question for an `ask` scenario, and the replay link in a second page.
  - A `mode: audit` scenario is skipped with the reason "Claim Check runs consultation only". Fail the suite if no consult scenario exists, or if the golden folder is empty.
  - Fail with a message naming the fact when the app asks a fact the scenario does not give, or when two facts share an `ask` text.
  - Run `pnpm dc golden` first and confirm it passes before you debug an e2e failure, so you know whether the engine or the interface is wrong.
  - _Requirements: 15.1 to 15.9, 15.11_

- [x] 15. Cross-cutting e2e tests
  - [x] 15.1 Keyboard-only run: start screen to verdict, into the X-ray, out of it, and through a rail change, with no pointer. Visible focus ring on each stop. Write `e2e/claim-check-keyboard.spec.ts`.
    - _Requirements: 13.2, 15.10_
  - [x] 15.2 Accessibility sweep: axe at 390, 768 and 1280 on the start screen, a question of each type, the verdict, the open X-ray, the rulebook, a stale-link notice and the 404 page. Targets of at least 44 px. No horizontal scroll at 320 px and at 200% zoom. Write `e2e/claim-check-a11y.spec.ts`.
    - _Requirements: 13.1, 13.3, 13.4_
  - [x] 15.3 Copy and refusals: a scan of every screen for exclamation marks, uppercase labels, arrow glyphs in buttons, shadows, gradients and apologies. Write `e2e/claim-check-refusals.spec.ts`.
    - _Requirements: 13.5, 13.6, 6.10_
  - [x] 15.4 No network: fail the test on any request after load, and any storage write (since the redesign, any except `dc-theme`; see task 21). Write `e2e/claim-check-privacy.spec.ts`.
    - _Requirements: 1.4, 1.5, 10.8_
  - [x] 15.5 Budgets: a build test that gzips the app's JavaScript (excluding the develop chunk) and fails above 200 kB, and reports the chunk size; a Playwright layout-shift check below 0.05 on each screen; a Vitest benchmark that one `next` step over the built knowledge base takes under 10 ms. No Lighthouse unless the human approves it.
    - _Requirements: 13.7 to 13.10_
  - [x] 15.6 A guard test that fails if `git diff` against the base branch touches `packages/ui`, `packages/engine/src/types.ts` or any file under `apps/claim-check/{kb,rulebook,golden}` in a Claude Code pull request. Skip it outside CI.
    - _Requirements: 1.6, 14.3, 14.4, 14.5_

- [x] 16. Final checkpoint
  - Run `pnpm check`, `pnpm test:props`, `pnpm build`, `pnpm dc validate`, `pnpm dc golden` and `pnpm e2e`. All must pass.
  - Attach the Task_Evidence for the whole app: the start screen, a question, the verdict, the open X-ray and the rulebook at 390, 768 and 1280 px, and the reduced-motion X-ray.
  - Update `README.md` with a short Claim Check section: what it is, how to run it, and where the replay link lives. State anything you could not finish.
  - Open the pull request for gate G3. Kiro reviews it against this spec.
  - _Requirements: all_

## Redesign tasks (2026-11-23, Claude Code lane, not implemented)

Amended 2026-11-23 for the darkroom and lightbox redesign (`docs/redesign-proposal.md`, approved by the human on 2026-11-23: JSON-LD Organization, no new dependencies). Implemented by **Claude Code lane. Not implemented in the Kiro session that wrote this.** Depends on `ui-kit` tasks 12 to 14. Run after `ui-kit` tasks 12 to 14 and the landing page tasks 9 and 10, one at a time, in this order. Branch `cc/phase6-claim-check-redesign`. Each task ends with Task_Evidence in both themes (screenshots at 390, 768 and 1280 px, a clean console, zero axe violations, `pnpm check`). Do not touch `apps/claim-check/{kb,rulebook,golden}`.

- [x] 17. Theme, shell and command menu
  - Wire the kit's `ThemeToggle` and `CommandMenu` into `AppShell` with the items in requirement 16.3, and move "Link copied" to `Toast`. Import the new kit styles.
  - Playwright: the toggle persists, the menu opens with Ctrl+K and Cmd+K, each item runs, focus returns.
  - _Requirements: 16.1 to 16.5_
- [ ] 18. Start and question screens
  - Restyle `Start.tsx`, `Consult.tsx` and the answers rail in both themes. Replace `md:pt-20` on the start section (line 44 of `Start.tsx`), which is not a spacing token and emits no CSS, with `md:pt-16` (64 px), and check the desktop gap against the 1280 px screenshot (found at the review of PR #33; ui-kit requirement 39). Existing specs `claim-check-start`, `-consult` and `-rail` pass unchanged in the default theme and are repeated in the light theme.
  - _Requirements: 17.1, 17.2, 17.4_
- [ ] 19. Verdict and X-ray screens
  - Restyle `Verdict.tsx`, `Xray.tsx` and the replay link in both themes with the dark state colours and the film material. `claim-check-verdict`, `-xray` and `-replay` pass in both themes, including the reduced-motion develop.
  - _Requirements: 17.1, 17.2, 17.3, 17.4_
- [ ] 20. Rulebook, stale-link and 404 screens
  - Restyle `Rulebook.tsx`, `Stale.tsx` and `NotFound.tsx` in both themes. `claim-check-pages` passes in both themes.
  - _Requirements: 17.1, 17.3_
- [ ] 21. Cross-cutting tests in both themes
  - Run the a11y, keyboard and refusals specs in both themes. Change the privacy test to allow the `dc-theme` write and nothing else. Update the refusals scan to the narrowed list. Re-check the budgets.
  - From the review of PR #45: run the command-menu item tests of `claim-check-commands.spec.ts` at 390 px too, through the Menu panel (they skip below 768 px today), and check that the "Link copied" toast at 390 and 320 px covers neither the copy button nor the page's last line and causes no sideways scroll.
  - _Requirements: 18.1 to 18.4_
- [ ] 22. Checkpoint, Claim Check redesign
  - Run `pnpm check`, `pnpm test:props`, `pnpm build`, `pnpm dc validate`, `pnpm dc golden` and `pnpm e2e`. Attach the five screens in both themes at the three widths and the reduced-motion X-ray. Open the pull request. Kiro reviews it against this spec.

## Notes

- Review of PR #27 (Kiro, 2026-11-23): tasks 17 to 22 stay unticked. The start screen and the question card are restyled (accepted, requirement 19) and the theme toggle arrives through `AppShell`. Open: the command menu and `Toast` (task 17), the answers rail (18), the verdict and X-ray (19), the rulebook, stale-link and 404 screens (20), the privacy, a11y and refusals specs in both themes at all three widths (21), and Task_Evidence at 390, 768 and 1280 px (the pull request shows 1280 px only).

- Tasks marked `*` are property tests. Run them with the task before them, not later.
- Tasks 2, 14 and the three e2e tasks that need real scenarios depend on Phase 2. If Phase 2 is late, tasks 1, 3 to 5 and 6 can proceed against a small test knowledge base kept in `apps/claim-check/src/testing/`; remove it when task 2 lands.
- Questions that block a task: open questions 1 and 2 block task 2; open question 3 shapes task 12.1; open question 4 is settled in task 1 and confirmed in the pull request.
- The Kiro lane's gate G3 review checks every requirement above against the evidence, and amends this spec if it accepts a deviation.
