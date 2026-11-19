# Implementation Plan: pre-flight-app

## Overview

This plan builds Pre-Flight (`apps/pre-flight`) in TypeScript strict mode. The order is: scaffold, record the API responses, build the collector test-first (target parsing, parsing and classification, collection, fact derivation), load the knowledge base and checklists, build the report logic, then the screens from the start screen to the export, then the end-to-end tests.

**This spec is implemented by Claude Code, not Kiro.** Kiro wrote the spec and creates no file under `apps/` or `e2e`. Every task below is addressed to Claude Code. Do the tasks one at a time, in order. Do not start a task while another is in progress.

**Prerequisites from the Kiro lane (Phase 2).** `apps/pre-flight/kb/*.yaml`, `apps/pre-flight/rulebook/` and `apps/pre-flight/golden/*.yaml` do not exist yet. Tasks 3 to 6 can run without them against a small test knowledge base kept in `apps/pre-flight/collectors/testing/`. Tasks 7 onward need the real compiled knowledge base. If it is missing, stop and tell the human. Never write a knowledge base, rulebook or golden file yourself, and never invent check or goal names.

## Working rules for every task

- Run every command under Node 22 (`.nvmrc`). Before the first command in a session, run `nvm use` (or an equivalent) and confirm `node -v` prints `v22.x`.
- Never use watch mode or any long-running process. Run tests with `pnpm vitest run <path>`, `pnpm test:props`, `pnpm e2e` or `pnpm check`. For screenshots use `vite build` plus `vite preview` in a background process you stop afterwards, or ask the human to start a server.
- **No live API in tests.** Automated tests and e2e never call `api.github.com`. They use the recorded responses. Only the recording script (task 2) touches the network. The human has approved you running it.
- **Dependencies.** Task 1 copies the versions `apps/site` pins for React, Vite and Tailwind. Pin every dependency to an exact version: no `^`, no `~`. If a task needs a package outside React, Vite, Tailwind CSS, Radix primitives, Motion and the workspace packages, **stop and ask the human before adding it**. A gitignore library, an HTTP client, an Octokit package, a Markdown library, a router, a state library, jsdom and Testing Library are all refused. Use the platform `fetch`.
- **Lanes.** Stay in `apps/pre-flight` (except `kb`, `rulebook`, `golden`), `e2e`, `scripts` and the root configuration you need. Do not touch `.kiro/**`, `packages/ui`, `packages/engine` or `packages/kb-tools`. Do not edit `packages/engine/src/types.ts`. If a task seems to need a change there, stop and seek consent from both lanes. Where the contract or the kit lacks a value, take it as an app-side value, as the design says.
- **Engine imports.** The app may import values from `@dead-certain/engine` (`audit`, `explain`, `print`, `EngineError`). It never calls `next`, `answer`, `whatIf`, `encode` or `decode`.
- **Names.** Only `src/checklists.ts` and `collectors/extractors.ts` name a fact or a goal.
- **Untrusted data.** Every string from GitHub is untrusted. Render it as text. Never use `dangerouslySetInnerHTML`, never build a URL from it, never put it in Markdown without the escaping in the design.
- **Test-first (collector tasks).** For each collector task: write the test, run it and keep the failing output, write the code, run it and keep the passing output. Put both runs in the task's evidence. A test that never failed proves nothing.
- **Refusals (never build these).** No global dark mode. No uppercase labels or `text-transform: uppercase`. No `box-shadow` other than `none`. No gradient. No scroll-triggered entrance animation. No arrow or chevron glyph in a button label. No `localStorage`, `sessionStorage`, cookies or analytics. No `Authorization` header or token. No request to any host but `api.github.com`. No emoji. No exclamation mark. No humor. No hex value outside the kit's `tokens.css`. No motion library import in the app.
- **Copy.** Sentence case, active voice, plain words, no apology. Use the exact strings quoted in the requirements. A control keeps one name through a flow.
- **Tests.** Pure logic is tested in Vitest with no DOM. Screens are tested in Playwright against the built app. Every property test file ends in `.props.test.ts`, uses fast-check `4.10.2`, runs each property at least 100 times, and starts each property with a comment `// Feature: pre-flight-app, Property N: <title>`.
- **Task_Evidence (every task ends with it).** Before you ask for review, produce all four, and attach them to the pull request:
  1. Screenshots at **390, 768 and 1280 px** of what the task built. Do not commit them. For a task with no visible output, attach the unchanged start screen at the three widths.
  2. A clean browser console read: zero `error` and zero `warning` messages.
  3. A zero-violation axe-core result for each screen the task touched.
  4. `pnpm check` output, passing. Collector tasks add the failing and passing test runs.
- **Marking tasks.** You do not tick boxes in this file. Kiro marks a task complete after reviewing it against the spec. Report what you did and attach the evidence.
- **Commits.** Keep tool attribution on commits. Branch `cc/phase4-pre-flight`.

## Tasks

- [x] 1. Scaffold the app
  - Create `apps/pre-flight` with `package.json` (`@dead-certain/pre-flight`, exact pinned versions, scripts `dev`, `build`, `preview`), `vite.config.ts` (React, Tailwind plugin, `base: "/dead-certain/pre-flight/"`), `tsconfig.json` extending the root, `index.html`, `src/main.tsx` and `src/styles.css` importing the kit's `tokens.css` and `styles.css`, and the folders `collectors/`, `collectors/recorded/`, `collectors/snapshots/`. Mirror `apps/site` for structure and versions.
  - Render `AppShell` with app name "Pre-Flight", the one nav entry and a placeholder child that shows the start screen for any route. The hash router arrives with the run controller (task 10).
  - Add the app to the Playwright config as another web server or a combined preview. Add one smoke test `e2e/preflight-shell.spec.ts` that opens the app (at 390 px it opens the Menu first) and finds the nav and the footer. The root `tsconfig.json` includes `apps/*/collectors`, so `pnpm check` type-checks the collector.
  - `pnpm -r ls --depth 0` lists the package. `pnpm build` builds it.
  - _Requirements: 1.1 to 1.3, 1.7, 12.1, 12.3_

- [x] 2. Record the API responses
  - The human chose the two repositories (open question 3, answered 2026-11-18): `chitrakumarsai/dc-sample-not-ready` and `chitrakumarsai/dc-sample-warnings`, with this repository. The human has approved you running the recording script.
  - Write `collectors/record.ts`, run with `node` under Node 22 and type-stripping or through the repo's TypeScript runner (no new dependency). For each of the three targets it makes the four requests of the design, with no token and no cookies, and writes `{ url, status, headers, body, recordedAt }` per request, where `recordedAt` is the ISO time of the request. Task 2 writes `recorded/` only. Task 18 extends the script to write `snapshots/` to `collectors/recorded/<owner>__<name>/<step>.json`. Keep only the headers listed in the design. Fail if a body looks like it holds a credential.
  - Add the root script `record:snapshots` that runs it. Document it in the app's README section: who runs it, when to re-run it (when `.gitignore` or `.kiro` changes in this repo), and the request count (12).
  - Add synthetic fixtures, marked `"synthetic": true`, for the cases you cannot record safely: metadata 404, a rate-limit 403 with `x-ratelimit-remaining: 0` and a reset time, a 429 with `retry-after`, a truncated tree, an empty-repository 409, a `.gitignore` 404 and a README 404.
  - Vitest: every recorded file parses as JSON, has the five keys (`url`, `status`, `headers`, `body`, `recordedAt`), holds no `authorization` or `set-cookie` header, and each synthetic fixture is marked.
  - Reopened by Kiro's review of tasks 1 to 4 (requirement 12.7): the recorded files carry no date. Add `recordedAt` (ISO) to every recorded file and to `record.ts`, and to the recorded-files test. Re-run `pnpm record:snapshots` (12 requests, approved) rather than back-filling the date by hand. For a synthetic fixture, `recordedAt` is the date it was written. Kiro's re-review (2026-11-18): every recorded and synthetic file carries `recordedAt`; accepted.
  - _Requirements: 12.7, 3.19, 9.2_

- [x] 3. Target parsing
  - [x] 3.1 Write `collectors/target.ts` test-first. Tests first for every form in requirement 2.3, the length and character rules of 2.4, the two rejections of 2.5 and 2.6, and host checks (`github.com.evil.example`, `gist.github.com`, `github.com@evil.example`, a URL with a port or credentials are all rejected).
    - _Requirements: 2.3 to 2.6, 3.6_
  - [x]* 3.2 Property tests.
    - Property 1: target parsing is total and normalises.
    - Property 2: a parsed Target cannot bend a URL. Include a URL-builder function `requestUrls(target, branch)` in `collectors/urls.ts` that the collector will use.
    - _Requirements: 2.3 to 2.6, 3.2 to 3.6_

- [x] 4. Parsing and classification
  - [x] 4.1 Write `collectors/parse.ts` and `classify` test-first, against the recorded and synthetic files. Tests first for: each field check on metadata, tree and the two file bodies; a wrong type in any field gives `unreadable`; clipping of paths and files; the 100,000-entry cap; rate-limit detection from 429, from 403 with `x-ratelimit-remaining: 0` and from `retry-after`; `resetAt` from the header and from `retry-after`; a 403 without rate-limit signs is `unreadable`, not `rate_limited`.
    - _Requirements: 3.8 to 3.11, 3.18, 8.2, 8.3, 8.7_
  - [x]* 4.2 Property test.
    - Property 11, first step: `classify` and the parsers never throw, and a rate-limit response is never `not_found` or `unreadable`. Generate statuses, headers and bodies, including non-JSON and deeply nested JSON. Task 5.2 extends it to `collect`.
    - _Requirements: 8.1, 8.2, 8.6, 8.7, 3.18_

- [x] 5. The collector
  - [x] 5.1 Write `collectors/collect.ts` test-first with an injected `fetch` that replays the recorded files. Tests first for: the exact URLs and headers of requirement 3 (no `Authorization`, `credentials: "omit"`, an `AbortSignal`); the order of requests; each at most once; the progress events (`reading`, then the final status) in order; a failing step stops the run and leaves the later steps `not_run`; 404 for `.gitignore` and README gives an absent file, not an error; 409 gives an empty tree; truncated gives `truncated: true`; a `fetch` that rejects gives `unreachable`; a request that outlives `timeoutMs` (use Vitest's fake timers and a fetch that never resolves) gives `unreachable`; the snapshot's `takenAt` equals the injected clock.
    - _Requirements: 3.1 to 3.13, 4.2, 8.6, 12.6_
  - [x]* 5.2 Property test.
    - Property 10: collection is faithful to the recorded responses.
    - Property 11, second step: `collect` resolves and never rejects, for any status, headers and body.
    - _Requirements: 3.1, 3.7, 3.12, 3.13, 4.2_

- [ ] 6. Fact derivation
  - The knowledge base existed when task 6 ran, so `extractors.ts` holds the real table and no test table was made (accepted, design "The real table"). Task 7 does not replace it.
  - [x] 6.1 Write `collectors/gitignore.ts` test-first. Tests first for: comments, blank lines, a trailing slash for directories, a leading slash, `!` negation, `*`, `**`, `?`, escaped `#` and `!`, and the later line winning. An unsupported construct (for example a character class) returns an `unsupported` result. The function returns the matching line number and text.
    - _Requirements: 3.14, 3.16_
  - [x]* 6.2 Property test.
    - Property 5: the gitignore matcher agrees with its own evidence.
    - _Requirements: 3.14, 3.16_
  - [ ] 6.3 Write `collectors/derive.ts` and `collectors/extractors.ts` test-first. Tests first for: a fact is returned only when its value matches its type; a missing extractor or an `undefined` result goes to `unseen`; evidence is clipped to 200 characters; a truncated tree makes every tree fact unseen; the knowledge base has no "today" fact, so none is read (requirement 3.23).
    - _Requirements: 3.9, 3.14 to 3.17_
    - Reopened by Kiro's review of task 6 (requirement 3.22): `headings()` in `extractors.ts` reads a line inside a fenced code block as a heading, so a README with a shell comment `# Install` in a code block makes `readme_has_run_heading` true, a false pass. Skip every line from a ``` or ~~~ fence to its closing fence (an unclosed fence runs to the end of the text). Drop `*` from the underline characters: `Usage` over `***` is a thematic break in Markdown, not a heading. Write the tests first and keep the red runs: a fenced `# Install`, an unclosed fence, `Usage` over `***`, and a real heading after a closed fence. Change nothing else in the extractors. Attach the Task_Evidence for task 6, which the pull request does not have yet. Tick tasks 6 and 6.3 only after Kiro's re-review.
  - [x]* 6.4 Property tests.
    - Property 3: derivation is pure and typed.
    - Property 4: nothing is guessed from a truncated tree.
    - _Requirements: 3.9, 3.14 to 3.16_

- [ ] 7. Knowledge base and checklists
  - Prerequisite: `apps/pre-flight/kb/*.yaml` exists. If it does not, stop and tell the human.
  - Run `pnpm dc build`, find where the JSON is written, and write `src/kb.ts`: import the JSON, check its shape with a hand-written guard (no validation library), export `kb`, `labelFor`, `defFor`, `clauseFor`, `ruleExpression` (using `print`).
  - Write `src/checklists.ts` from the knowledge base: `GOAL` (read from `kb.goals`, the single goal with values `ready` and `not_ready`), and the one checklist's title, groups and checks with severity. Confirm group names, severities and which checks it lists with the human (open questions 1 and 2) before you write them. Write `validateChecklists(kb)` and show `LoadFailure` when it fails.
  - `collectors/extractors.ts` already holds the real table (task 6). Check that it has one extractor for each non-derived fact the collector can read, and none for the rest. Keep the test knowledge base only for tests that need a case the real one lacks.
  - Vitest: the guard accepts the real knowledge base and rejects one without `goals`; `validateChecklists` accepts the real set and rejects a check listed in no group, a check twice in the checklist, an unknown fact, and a knowledge base with no goal or with two; every non-derived fact of the knowledge base has an extractor or a non-empty `ask`.
  - _Requirements: 1.4, 1.8 to 1.10, 3.14 to 3.17_

- [ ] 8. Report logic
  - [ ] 8.1 Write `src/report/audit.ts`, `summary.ts`, `evidence.ts`, `sources.ts` and `questions.ts`, test-first, against the real knowledge base and the recorded snapshots.
    - Tests first for: collected values win over answers; the Summary sentence for ready, not ready (one and several, blockers only, warnings only) and undecided; evidence lines are de-duplicated and clipped; `relabelSources` marks collected leaves and leaves the rest; `questionFor` picks the first needed question in a check's proof, and boolean questions go inline while others go to the list.
    - _Requirements: 5.1 to 5.8, 6.1, 6.4, 6.8, 6.9, 7.4_
  - [ ]* 8.2 Property tests.
    - Property 6: collected values win and answers do not leak.
    - Property 7: relabelling changes sources only.
    - Property 8: the summary is the engine's, not the app's.
    - Property 9: an inline answer changes only what depends on it.
    - _Requirements: 5.2 to 5.6, 6.2, 6.6, 6.8, 6.9, 7.4, 7.8_

- [ ] 9. Markdown export
  - [ ] 9.1 Write `src/report/markdown.ts` test-first: `escapeMd`, `codeSpan` and `toMarkdown`. Tests first for the exact output shape in the design; a path with backticks, a `.gitignore` line that starts with `#` or `-`, a path with `<script>`, a label with `*` and `[`; a report in each state; the same report gives the same text.
    - _Requirements: 10.4 to 10.9_
  - [ ]* 9.2 Property test.
    - Property 12: Markdown cannot be injected into.
    - _Requirements: 10.4 to 10.9_

- [ ] 10. Run controller
  - Write `src/run/controller.ts`: the reducer over `idle`, `collecting`, `error`, `report`, with run ids that drop stale events, the abort on route change, and the `answer` and `reopen` actions. Add the lazy loader for snapshots.
  - Vitest: steps move only on collector events; an event from an older run is ignored; an abort by navigation leaves no error; `answer` keeps answers for the current report and clears them on a new run; a snapshot run makes no request (assert with a fetch that fails the test if called).
  - _Requirements: 4.1 to 4.8, 6.7, 9.4, 9.6_

- [ ] 11. Start screen
  - Write `src/screens/Start.tsx`: the heading, paragraph and privacy line, the labelled "Repository" field with the two messages, "Run the checks", and the "Try a sample" buttons from the snapshot index.
  - Playwright `e2e/preflight-start.spec.ts`: every accepted form routes to the same Report address; empty and bad input show the two messages and make no request; Enter submits; a sample button routes to the sample address and makes no request; no uppercase text, no arrow glyph; axe clean at three widths.
  - _Requirements: 2.1 to 2.11_

- [ ] 12. Collection steps
  - Write `src/screens/Steps.tsx`: the four steps with their statuses from the controller, the live-region announcements, and the container that holds its height until the Report mounts.
  - Playwright `e2e/preflight-steps.spec.ts` with routed responses that are held and released one by one: a step shows "Waiting", then "Reading" only after its request is sent, then its final status only after its response; no percentage or other progress element exists; later steps read "Not run" after a failure; reduced motion shows no movement; the snapshot route shows the snapshot line and no steps; layout shift stays below 0.05 when the Report replaces the steps.
  - _Requirements: 4.1 to 4.8, 11.8_

- [ ] 13. The report
  - Write `src/screens/Report.tsx`: the Summary, the grouped `CheckRow`s with evidence, the "Needs your answer" list, the "Checked <time>" or "Snapshot taken <date>" line, "Check another repository", and the print rule. Build it from `buildReport`.
  - Playwright `e2e/preflight-report.spec.ts`, on routed recorded responses for each bundled repository: the Summary state word, icon and sentence; each check's state word, label, rule id and Evidence_Line; paths in the Machine voice; no placeholder where a check has no evidence; the time line; the report fits one printed page; hostile strings (build a recorded fixture with a path of `<img src=x onerror=alert(1)>` and a name with Markdown syntax) render as text and run no script.
  - _Requirements: 5.1 to 5.15_

- [ ] 14. Inline questions and the answers rail
  - Wire `CheckRow` questions, the "Needs your answer" list and `AnswersRail` ("Your answers", reopen on change). Announce each Summary change through the polite live region.
  - Playwright `e2e/preflight-questions.spec.ts`: answering a boolean question changes the row and the Summary at once with no loading state; a non-boolean question appears in the list and has the same effect; the rail lists the answer and changing it shows the question in its row filled in; answers clear on "Check another repository"; a fact that is both collected and answered keeps the collected value; no question appears that the engine did not list.
  - _Requirements: 6.1 to 6.9_

- [ ] 15. Checkpoint: collect and report
  - Run `pnpm check`, `pnpm test:props` and `pnpm e2e` for the Pre-Flight specs. Record the results. Ask the human whether anything is unclear before the X-ray, error and snapshot work.

- [ ] 16. X-ray on any check
  - [ ] 16.1 Write `src/screens/Xray.tsx` over `XrayStage`: target from the check's rule button, title "Why: <label>", `FilmBody` with `explain`, `relabelSources`, `ProofTree` keyed by fact, `ruleExpression`, `clauseFor`, `decidingClause`, `onChangeAnswer` for answered facts only, and the grouped "Evidence" list under the tree. Keep the film in step with new answers.
    - _Requirements: 7.1 to 7.7, 7.9 to 7.13_
  - [ ] 16.2 Playwright `e2e/preflight-xray.spec.ts`.
    - A failed check opens "Why: <label>"; each rule's sentence comes first and its expression sits behind "Show the rule"; collected facts say "Collected", inline answers say "You answered", a check's root is its rule and shows no "Worked out" badge, since no check rule reads a derived fact; the Evidence list shows each collected fact's line; "Change this answer" appears on an answered fact only, closes the panel and shows the question in its row; the clause shows as a quote.
    - At 1280 px paper and film sit side by side, at 390 px the film is a sheet.
    - Keyboard: arrows move, Enter expands, Escape closes and focus returns to the rule button.
    - Develop: about 500 ms in the default project, a 120 ms fade and no scan line in `reduced-motion`.
    - Answering while the film is open updates the proof.
    - _Requirements: 7.1 to 7.13_

- [ ] 17. Errors
  - Write `src/screens/Errors.tsx` for the four `CollectError` kinds, with the exact copy, the reset time in the user's locale, "Try again", the sample buttons, and the snapshot offer when the target matches a bundled snapshot. Keep the steps visible above the error with the failed step marked, and move focus to the heading.
  - Playwright `e2e/preflight-errors.spec.ts` with synthetic responses: 404 shows the private-or-missing message; a rate limit with a reset header shows a local time, one without shows "Try again in about an hour.", and both offer samples; a rate limit for this repository's target also offers the snapshot, and choosing it shows the snapshot Report with no request; an aborted fetch shows the unreachable message and "Try again" runs the collection again; a 500 and a body that is not JSON show the unreadable message; no message shows GitHub's own text; the app never swaps in a snapshot on its own; the app never retries on its own (count requests); axe clean at three widths on each.
  - _Requirements: 8.1 to 8.12, 9.6_

- [ ] 18. Bundled snapshots
  - [ ] 18.1 Run `pnpm record:snapshots` (you may run it; the human has approved the 12 requests) and confirm the three recorded sets build into samples (no snapshot JSON is stored). Check by eye, and list in the pull request, why each is public, what it shows (ready, not ready, an unseen fact), and the date. Check that the snapshot of this repository shows `.kiro` present and not ignored.
    - _Requirements: 9.1 to 9.3, 9.8_
  - [ ] 18.2 Load them lazily into their own chunk, and show the snapshot line and date in the Report.
    - Vitest: the three snapshots parse as `RepoSnapshot`; each yields a Report through the same `deriveFacts` and `audit` as a live run; together they hold a ready result, a not-ready result and an unseen fact.
    - Build test: the snapshot chunk exists apart from the main bundle and the three together gzip under 60 kB.
    - _Requirements: 9.4, 9.5, 9.7, 11.7_

- [ ] 19. Markdown export screen
  - Wire "Copy report as Markdown": copy, announce "Report copied", and the read-only text area with "Copy this text by hand." when the clipboard refuses.
  - Playwright `e2e/preflight-export.spec.ts`: the copied text equals the expected Markdown for each bundled repository (expected text in `e2e/fixtures/`, approved by the human); a fixture with Markdown syntax in a path exports escaped; a refused clipboard shows the text area with the text selected; the same report exports the same text twice.
  - _Requirements: 10.1 to 10.9_

- [ ] 20. End-to-end journeys
  - [ ] 20.1 Write `e2e/fixtures/preflight-<id>.json` for each bundled repository: per check the state, label, rule id and evidence lines, from the recorded responses. Ask the human to approve each file. Write `e2e/preflight-journey.spec.ts`: for each repository, run it as a live journey with routed recorded responses, then from its sample button, and assert both give the expected Report.
    - Assert a live run makes exactly four requests to the four URLs in order, with no `Authorization` header, and that any request to another host fails the test.
    - _Requirements: 13.1 to 13.4_
  - [ ] 20.2 Keyboard-only run from the start screen through the Report, an inline answer, the X-ray and the export, with a visible focus ring at each stop. Write `e2e/preflight-keyboard.spec.ts`.
    - _Requirements: 11.2, 13.10_
  - [ ] 20.3 Accessibility sweep: axe at 390, 768 and 1280 on the start screen, the steps, the Report in each state, the open X-ray and each error screen; touch targets of at least 44 px; no horizontal scroll at 320 px and at 200% zoom with a very long path and a very long `.gitignore` line. Write `e2e/preflight-a11y.spec.ts`.
    - _Requirements: 11.1, 11.3, 11.4_
  - [ ] 20.4 Copy and refusals scan on every screen for exclamation marks, uppercase labels, arrow glyphs in buttons, shadows, gradients and apologies. Write `e2e/preflight-refusals.spec.ts`.
    - _Requirements: 11.5, 11.6_
  - [ ] 20.5 Privacy: fail on any storage write, any cookie, any request that is not to `api.github.com`, and any `Authorization` header. Write `e2e/preflight-privacy.spec.ts`.
    - _Requirements: 1.5, 1.6_
  - [ ] 20.6 Budgets: a build test gzips the main JavaScript (excluding the develop and snapshot chunks) and fails above 200 kB, reporting both chunk sizes; a layout-shift check below 0.05 on each screen; a Vitest benchmark that one `audit` over a snapshot's facts takes under 10 ms.
    - _Requirements: 11.7 to 11.9_
  - [ ] 20.7 A guard test that fails in a Claude Code pull request if the diff touches `packages/ui`, `packages/engine/src/types.ts` or any file under `apps/pre-flight/{kb,rulebook,golden}`. Skip it outside CI.
    - _Requirements: 1.7, 12.3 to 12.5_

- [ ] 21. Final checkpoint
  - Run `pnpm check`, `pnpm test:props`, `pnpm build`, `pnpm dc validate`, `pnpm dc golden` and `pnpm e2e`. All must pass.
  - Attach the Task_Evidence for the whole app: the start screen, the steps, the Report in each state, the open X-ray, each error and the export at 390, 768 and 1280 px, and the reduced-motion X-ray.
  - Update `README.md` with a short Pre-Flight section: what it is, how to run it, the four requests it makes and why, how to re-record the snapshots. State anything you could not finish.
  - Open the pull request for the gate. Kiro reviews it against this spec.
  - _Requirements: all_

## Notes

- Tasks marked `*` are property tests. Run them with the task before them, not later.
- Questions that block a task: open questions 1 and 2 block task 7. The goal, the recording run, the snapshot repositories and the missing replay link are decided.
- If Phase 2 is late, tasks 1 to 6 and 10 can proceed against the small test knowledge base. It was not needed: the real knowledge base existed at task 6. Keep it only for cases the real one does not cover.
- Pre-Flight's golden scenarios (audit mode, from Phase 2) prove the engine and the knowledge base through `pnpm dc golden`. The end-to-end tests here prove the interface and the collector. Both must pass at the final checkpoint.
- The Kiro lane's gate review checks every requirement above against the evidence, and amends this spec if it accepts a deviation.
