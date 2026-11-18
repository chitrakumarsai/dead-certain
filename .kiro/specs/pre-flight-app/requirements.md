# Requirements Document

## Introduction

Pre-Flight is the second Dead Certain app: `apps/pre-flight`, package `@dead-certain/pre-flight`. A developer submits a public GitHub repository. The app collects facts from the GitHub REST API, asks only for what it cannot see, and returns pass or fail for each checklist item with the rule and the evidence behind it. Any failed check opens its proof, the X-ray.

Pre-Flight runs the engine in **audit mode**: the collector and the user supply facts, and `audit(kb, facts)` returns a verdict whose line items are the checks and whose `needed` list holds the questions still open. The app decides nothing itself. It composes `@dead-certain/ui` components over the engine API in `packages/engine/src/types.ts` and changes neither.

This spec is implemented by the Claude Code lane in `apps/pre-flight/src`, `apps/pre-flight/collectors` and `e2e`. The Kiro lane writes the spec only. The requirements derive from section 8 of `docs/BUILD_PLAN.md` (the Pre-Flight screens), section 7 (the Pre-Flight collector), `.kiro/steering/design-system.md` and the `ui-kit` spec. Requirement numbers are stable so the design's correctness properties can cite them.

Scope: the start screen, the collector contract, live collection steps, the report, inline questions, the X-ray, error states, three bundled snapshots as the rate-limit fallback, and Markdown export. Out of scope: any change to `packages/ui` or `packages/engine`, the knowledge base and golden scenarios (Phase 2 delivers them), a replay link for reports (decided: none), authentication, and any request outside the four below.

## Glossary

- **Pre_Flight**: The app in `apps/pre-flight`.
- **Engine**: The public API of `@dead-certain/engine`. Pre_Flight uses `audit`, `explain` and `print`. It does not use `next`, `answer`, `whatIf`, `encode` or `decode`.
- **UI_Kit**: The package `@dead-certain/ui`.
- **Knowledge_Base**: The compiled JSON of `apps/pre-flight/kb/*.yaml`, produced by `pnpm dc build`, typed as `KnowledgeBase`.
- **Goal**: The Knowledge_Base's single goal. Its value is exactly `ready` or `not_ready`, or unknown while checks are open. It covers every check of the Knowledge_Base.
- **Checklist**: The one list of checks, with its title and Groups, declared in `src/checklists.ts`. It holds every check of the Knowledge_Base. There is no choice of Checklist.
- **Check**: A fact with `role: "check"`. Its line item is true for pass, false for fail and unknown for open.
- **Group**: A heading in the report that holds related checks, such as "Repository" or "Kiro usage". Declared in `src/checklists.ts`.
- **Severity**: "blocker" or "warning", declared per check in `src/checklists.ts`. It only changes how the summary counts a failed check. It never changes a check's value.
- **Target**: A repository named by `owner` and `name`.
- **Collector**: The code in `apps/pre-flight/collectors` that fetches and reads a Target.
- **Snapshot**: The raw result of the four requests for one Target: `RepoSnapshot` (see the design). The Collector produces it, and the bundled snapshots are stored in the same shape.
- **Derived_Facts**: The facts and evidence lines that the pure function `deriveFacts(snapshot, kb)` reads from a Snapshot.
- **Evidence_Line**: One plain sentence or path that shows why a collected fact has its value, such as ".gitignore line 12: .kiro/".
- **Unseen_Fact**: A non-derived fact the Collector cannot read from a Snapshot. The Engine lists it in `needed`, and the app asks it inline.
- **Collection_Step**: One of the four requests, shown as it starts and as it finishes.
- **Bundled_Snapshot**: One of three Snapshots committed in the repo, one of them of this repository, used as the rate-limit fallback and as the sample repositories.
- **Report**: The screen that shows the summary, the grouped checks, the inline questions and the actions.
- **Summary**: The `VerdictHeadline` (size "summary") and its sentence at the top of the Report.
- **X-ray**: The proof view, opened through `XrayStage`.
- **Task_Evidence**: Per task: screenshots at 390, 768 and 1280 px, a clean browser console, a zero-violation axe result and `pnpm check` output.
- **Claude_Code_Lane**: The implementing lane for `apps/pre-flight/src`, `apps/pre-flight/collectors` and `e2e`.
- **Kiro_Lane**: The lane that owns `.kiro/**`, `packages/engine`, `packages/kb-tools`, `apps/*/kb`, `apps/*/rulebook` and `apps/*/golden`.

## Requirements

### Requirement 1: App shell, routes and run-time boundaries

**User Story:** As a developer, I want a small static app that reads only public data, so that I can run it on any repository without giving it access.

#### Acceptance Criteria

1. THE Pre_Flight SHALL serve two screens chosen by the fragment route, so that deep links work on static hosting: the start screen at `#/` and the Report at `#/report?repo=<owner/name>` or `#/report?sample=<id>`.
2. WHEN the fragment route matches neither screen, THE Pre_Flight SHALL show the start screen.
3. THE Pre_Flight SHALL render every screen inside the UI_Kit `AppShell` with the app name "Pre-Flight" and the one navigation entry "Pre-Flight".
4. THE Pre_Flight SHALL load the Knowledge_Base from the compiled JSON of `pnpm dc build` and SHALL NOT parse YAML or compile rules in the browser.
5. THE Pre_Flight SHALL make no network request except the Collector's requests to `https://api.github.com/`, and SHALL load no third-party font, script or style.
6. THE Pre_Flight SHALL NOT use `localStorage`, `sessionStorage`, cookies, analytics or a backend, and SHALL send no credential, token or `Authorization` header.
7. THE Pre_Flight SHALL NOT modify `packages/engine/src/types.ts` or any file in `packages/ui`.
8. THE Pre_Flight SHALL name a fact or a goal in `src/checklists.ts` and in `collectors/extractors.ts` only, and every other module SHALL read definitions, labels, clauses and currency from the Knowledge_Base.
9. WHEN the Knowledge_Base file is missing or does not satisfy `KnowledgeBase` at start-up, THE Pre_Flight SHALL show a plain-words notice that the rules failed to load and that the page should be reloaded, and SHALL NOT show a blank page.
10. WHEN the Knowledge_Base loads, THE Pre_Flight SHALL check that the Knowledge_Base has exactly one goal, that every check fact appears in exactly one group of the Checklist, and that every listed fact exists with `role: "check"`, and IF a check fails, THEN THE Pre_Flight SHALL show the load-failure notice.
11. THE Pre_Flight SHALL set the document title to the screen's heading followed by "Pre-Flight", and SHALL update it on each screen change.

### Requirement 2: Start screen

**User Story:** As a developer, I want to name a repository in the form I already have it and start in one action, so that I do not reformat anything.

#### Acceptance Criteria

1. THE start screen SHALL show a level-1 heading, a short paragraph in the System voice that says Pre-Flight reads a public repository and returns a pass or fail for each checklist item with the rule and evidence behind it, and the line "Pre-Flight reads public repositories only. Nothing you enter leaves your browser except requests to GitHub."
2. THE start screen SHALL show a labelled text field "Repository" that accepts `owner/name` or a GitHub URL.
3. THE Pre_Flight SHALL accept these forms and return the same Target for each: `owner/name`, `github.com/owner/name`, `https://github.com/owner/name`, the same with a trailing slash, with a `.git` suffix, and with a path such as `/tree/main/src`, with surrounding spaces ignored.
4. THE Pre_Flight SHALL accept an owner of 1 to 39 letters, digits and hyphens that does not start or end with a hyphen, and a name of 1 to 100 letters, digits, `.`, `_` and `-` that is not `.` or `..`.
5. IF the field is empty, THEN THE Pre_Flight SHALL show "Enter a repository as owner/name or a GitHub URL." under the field.
6. IF the text is not a Target, or the host of a URL is not `github.com`, THEN THE Pre_Flight SHALL show "This is not a GitHub repository. Use owner/name or a github.com URL." under the field, and SHALL make no request.
7. THE start screen SHALL show a primary Button "Run the checks".
8. WHEN the user activates "Run the checks" or presses Enter in the field and the Target is valid, THE Pre_Flight SHALL go to the Report route for that Target.
9. THE start screen SHALL show the Bundled_Snapshots as buttons under the heading "Try a sample", each labelled with the repository's `owner/name`.
10. WHEN the user activates a sample button, THE Pre_Flight SHALL go to the Report route for that sample, and SHALL make no network request.
11. THE start screen SHALL contain no uppercase label, no caption above a heading and no arrow in a button label.

### Requirement 3: The collector contract

**User Story:** As a maintainer, I want the collector to make exactly the requests it promises and to say what it could not see, so that the report never claims more than it read.

#### Acceptance Criteria

1. THE Collector SHALL make four requests to the GitHub REST API, in this order of dependency: repository metadata, the recursive tree, the `.gitignore` file and the README.
2. THE Collector SHALL request repository metadata with `GET https://api.github.com/repos/{owner}/{name}`.
3. THE Collector SHALL request the tree with `GET https://api.github.com/repos/{owner}/{name}/git/trees/{default_branch}?recursive=1`, where `default_branch` comes from the metadata response.
4. THE Collector SHALL request the `.gitignore` file at the repository root with `GET https://api.github.com/repos/{owner}/{name}/contents/.gitignore`, and the README with `GET https://api.github.com/repos/{owner}/{name}/readme`, each with the header `Accept: application/vnd.github.raw+json`.
5. THE Collector SHALL send every request with `Accept` set to a GitHub media type, the header `X-GitHub-Api-Version` set, `credentials: "omit"`, and no `Authorization` header or token.
6. THE Collector SHALL percent-encode `owner`, `name` and `default_branch` when it builds a URL, and SHALL build a URL only for a Target that satisfies requirement 2.4.
7. THE Collector SHALL make no request other than these four, SHALL make each at most once per run, and SHALL make no later request after a failure that stops the run.
8. WHEN the tree request or the README or `.gitignore` request returns 404, THE Collector SHALL record that file as absent and SHALL NOT treat the run as failed.
9. WHEN the tree response has `truncated: true`, THE Collector SHALL record the tree as truncated, and every fact that depends on the whole tree SHALL be an Unseen_Fact.
10. WHEN the tree request returns 409 for an empty repository, THE Collector SHALL record an empty tree.
11. THE Collector SHALL keep from the tree only each entry's path and type, and SHALL keep at most the first 65,536 bytes of the `.gitignore` file and of the README.
12. THE Collector SHALL take its `fetch` function, its clock and its progress callback as arguments, SHALL read no global except through them, and SHALL give each request a timeout of 10 seconds through an `AbortSignal`.
13. THE Collector SHALL return a Snapshot: the Target, the metadata fields it uses, the tree entries, the two file texts or their absence, the `truncated` flag, the time of the run, and the rate-limit headers of the last response.
14. THE function `deriveFacts(snapshot, kb)` SHALL be pure and SHALL return the facts it can read, one Evidence_Line for each, and the list of Unseen_Facts.
15. THE function `deriveFacts` SHALL return only facts that are non-derived facts of the Knowledge_Base, with a value of the fact's type.
16. WHERE a non-derived fact has no extractor, or its extractor cannot read a value from the Snapshot, THE function `deriveFacts` SHALL leave it out and list it as an Unseen_Fact, and SHALL NOT guess a value.
17. IF the Collector needs a fact the Snapshot cannot give, THEN THE Pre_Flight SHALL ask the user for it through the Engine's `needed` list, and the Collector SHALL NOT ask.
18. THE Collector SHALL treat every string from GitHub as untrusted data: it SHALL read JSON only, SHALL validate each field it uses by type, and SHALL clip each Evidence_Line to 200 characters.
19. THE Collector and its tests SHALL be written test-first against recorded API responses stored in `apps/pre-flight/collectors/recorded/`, and no automated test SHALL call the live API.

### Requirement 4: Live collection steps

**User Story:** As a developer, I want to see what Pre-Flight is doing as it does it, so that waiting is not a guess.

#### Acceptance Criteria

1. WHEN the Report route opens for a Target, THE Pre_Flight SHALL start the Collector and SHALL show the four Collection_Steps as a list: "Read repository details", "Read file tree", "Read .gitignore" and "Read README".
2. THE Pre_Flight SHALL show a step as "Waiting" until its request is sent, as "Reading" while its request is in flight, and as "Done", "Not found" or "Failed" when it finishes, from the Collector's progress callback only.
3. THE Pre_Flight SHALL NOT show a percentage, a timer that is not real elapsed time, an animated bar that is not driven by the callback, or a step that has not happened.
4. THE Pre_Flight SHALL announce each finished step through the polite live region.
5. WHEN a step fails in a way that stops the run, THE Pre_Flight SHALL leave the later steps as "Not run" and SHALL show the error for that failure (requirement 8).
6. WHEN every step has finished, THE Pre_Flight SHALL show the Report, with focus on the Summary heading and an announcement of the Summary.
7. WHILE the user asks for reduced motion, THE Pre_Flight SHALL show no movement in the steps.
8. THE Pre_Flight SHALL NOT show Collection_Steps for a Bundled_Snapshot, and SHALL instead show the line "Using a snapshot of <owner/name> taken <date>." above the Report.

### Requirement 5: The report

**User Story:** As a developer, I want a summary I can read in a second and checks grouped the way I think about them, so that I know what to fix.

#### Acceptance Criteria

1. THE Report SHALL call `audit(kb, facts)` with the Derived_Facts and the user's answers, and SHALL show the result.
2. THE Report SHALL show a Summary: a `VerdictHeadline` with `size="summary"`, whose state comes from `verdictStateFrom` applied to the Goal's value, and a sentence in the Document voice.
3. THE Summary sentence SHALL read "<N> blockers and <M> warnings in <owner/name>" with the counts of failed checks by Severity, "1 blocker" and "1 warning" in the singular, and the zero parts left out, WHEN the state is `not_ready`.
4. THE Summary sentence SHALL read "All <K> checks passed in <owner/name>" WHEN the state is `ready`, with K the number of checks, and "<Q> checks need your answer in <owner/name>" WHEN the state is `undecided`, with Q the number of unknown checks and "1 check needs your answer" in the singular.
5. THE Report SHALL list the Checklist's checks in its Groups, with each Group's name as a heading and one `CheckRow` for each check, in the order of `src/checklists.ts`.
6. THE Report SHALL take each row's value from the `LineItem` of `audit`, and SHALL NOT compute or adjust a value.
7. EACH `CheckRow` SHALL show its state in an icon and a word ("Passed", "Failed" or "Needs your answer"), its label, its rule id as the button that opens the proof, and an Evidence_Line.
8. THE Evidence_Line of a check SHALL be the Evidence_Lines of the collected facts in the check's proof, without repeats, joined with a line break, and clipped to 200 characters each.
9. THE Evidence_Line for a path or a file name SHALL be set in the Machine voice.
10. WHEN a check has no collected fact in its proof, THE Report SHALL show the check without an Evidence_Line, and SHALL NOT show a placeholder.
11. THE Report SHALL show the time of the run as "Checked <HH:MM>" in the user's locale, and SHALL show "Snapshot taken <date>" for a Bundled_Snapshot.
12. THE Report SHALL show the repository `owner/name`, as text, in the Summary sentence and nowhere as a link whose address is built from GitHub's response.
13. THE Report SHALL show a quiet Button "Check another repository" that returns to the start screen.
14. THE Report SHALL render every string from GitHub as text, never as markup, and SHALL NOT use `dangerouslySetInnerHTML`.
15. THE Report SHALL fit on one printed page, with the Summary and the grouped checks, when printed.

### Requirement 6: Inline questions

**User Story:** As a developer, I want to answer only what Pre-Flight could not see, in place, and watch the summary change, so that I never fill in a form.

#### Acceptance Criteria

1. FOR each check whose value is unknown, THE Report SHALL show the first question in `verdict.needed` whose fact appears in the check's proof, inline in its `CheckRow`, with the controls that match the fact's type.
2. WHEN the user answers an inline question, THE Pre_Flight SHALL run `audit` again with the answer added and SHALL update the row, the Summary and the other rows at once, with no loading state.
3. THE Pre_Flight SHALL announce the changed Summary through the polite live region.
4. WHEN a needed fact is not of type boolean, THE Report SHALL show its question with the matching `AnswerControl` in a list headed "Needs your answer", below the groups, and SHALL show the same Summary effect.
5. THE Pre_Flight SHALL list each answered fact in the margin rail as "Your answers" with its label and value, and WHEN the user activates one, THE Report SHALL show its question again, in the row it belongs to, with the current answer filled in.
6. WHEN the user changes an answer, THE Pre_Flight SHALL run `audit` again at once and update the Report.
7. THE Pre_Flight SHALL keep the user's answers in memory only for the current Report, and SHALL clear them when the user starts another run or checks another repository.
8. THE Pre_Flight SHALL NOT ask a question the Engine did not list in `needed`.
9. THE Pre_Flight SHALL NOT allow a user answer to replace a collected fact: WHEN a fact is both collected and answered, THE Pre_Flight SHALL use the collected value.

### Requirement 7: The X-ray on any check

**User Story:** As a developer, I want to open any failed check and see exactly which rule and evidence decided it, so that I can fix it or argue with it.

#### Acceptance Criteria

1. WHEN the user activates a check's rule id, THE Pre_Flight SHALL open the X-ray for that check, titled "Why: <check label>".
2. THE X-ray SHALL be built with `XrayStage`, with the proof taken from `explain({ kb, answers: facts }, checkFact)`.
3. THE X-ray SHALL show the proof as a `ProofTree`, each rule's plain sentence first and its expression behind "Show the rule", printed with the Engine's `print`.
4. THE Pre_Flight SHALL label each fact's source in the proof "Collected" when the fact came from the Collector, "You answered" when it came from an inline answer, and "Worked out" when it is derived, and SHALL set the source on each node itself, because the Engine reports every non-derived fact as "answered".
5. THE X-ray SHALL show the Evidence_Line of each collected fact beside that fact in the tree.
6. THE X-ray SHALL show the clause the deciding rule cites as a `ClauseQuote`, from the Knowledge_Base's clauses.
7. WHEN an answered fact is shown in the tree, THE X-ray SHALL offer "Change this answer", and activating it SHALL close the X-ray and show that question again in its row.
8. A collected fact SHALL NOT offer "Change this answer".
9. WHERE the viewport is 1280 px wide or more, THE X-ray SHALL show paper on the left and film on the right, and WHERE it is narrower, THE X-ray SHALL show the film as a sheet that slides up.
10. WHEN the X-ray opens and the user has not asked for reduced motion, THE Pre_Flight SHALL run the develop of 500 ms, and WHILE `prefers-reduced-motion: reduce` applies, THE Pre_Flight SHALL replace the scan line with a 120 ms fade.
11. THE tree SHALL follow the ARIA tree pattern: arrow keys move, Enter expands, and Escape closes the X-ray and returns focus to the button that opened it.
12. THE Pre_Flight SHALL offer the X-ray on every check with a known value, and SHALL offer it on a failed check at least.
13. WHEN an answer or a change makes the open check unknown, THE Pre_Flight SHALL keep the X-ray open and update its proof.

### Requirement 8: Errors

**User Story:** As a developer, I want an error to say what happened and what to do next, so that I am never stuck.

#### Acceptance Criteria

1. WHEN the metadata request returns 404, THE Pre_Flight SHALL show "This repository is private or does not exist. Pre-Flight reads public repositories only." with a link "Check another repository".
2. WHEN a response is a rate-limit response (status 403 or 429 with `x-ratelimit-remaining` of 0, or status 429, or a `retry-after` header), THE Pre_Flight SHALL show a message that says GitHub's limit for this browser is used up, says when to retry in the user's local time from `x-ratelimit-reset` (or from `retry-after`), and offers the samples as buttons.
3. WHEN the rate-limit response carries no reset time, THE Pre_Flight SHALL say "Try again in about an hour." in place of a time.
4. WHEN the request's Target matches a Bundled_Snapshot, THE rate-limit message SHALL also offer "Use the snapshot of <owner/name> taken <date>" as a button.
5. WHEN the user activates a snapshot button, THE Pre_Flight SHALL show the Report from that snapshot with the line from requirement 4.8 and SHALL make no request.
6. WHEN the browser cannot reach GitHub (the request fails, times out or is blocked), THE Pre_Flight SHALL show "Pre-Flight could not reach GitHub. Check your connection and try again." with a button "Try again".
7. WHEN GitHub returns another failing status, or a body that fails a field check, THE Pre_Flight SHALL show "GitHub sent a response Pre-Flight could not read. Try again later." with a button "Try again".
8. THE Pre_Flight SHALL show no error message that includes GitHub's own message text, a stack, an unescaped URL or a token.
9. THE Pre_Flight SHALL move focus to the error's heading and SHALL announce it through the polite live region.
10. THE Pre_Flight SHALL keep the Collection_Steps visible above an error, with the failed step marked, so that the user sees where the run stopped.
11. THE Pre_Flight SHALL NOT retry a request on its own.
12. THE error copy SHALL contain no apology and no exclamation mark.

### Requirement 9: Bundled snapshots

**User Story:** As a judge or a developer who has hit the limit, I want the app to still show what it does, so that a rate limit never blocks the demonstration.

#### Acceptance Criteria

1. THE Pre_Flight SHALL bundle three Snapshots in `apps/pre-flight/collectors/snapshots/`, one of them of this repository.
2. THE Bundled_Snapshots SHALL be recorded by the Collector's recording script from real responses, SHALL hold public data only, and SHALL carry the date they were taken.
3. THE Bundled_Snapshots SHALL be chosen so that the three together show a ready result, a not-ready result with failed checks, and a result with at least one inline question.
4. THE Pre_Flight SHALL read a Bundled_Snapshot through the same `deriveFacts` and the same `audit` as a live Snapshot, with no other code path.
5. THE Pre_Flight SHALL load the snapshots on demand, in a chunk apart from the main bundle, and the three together SHALL weigh less than 60 kB gzipped.
6. THE Pre_Flight SHALL NOT use a Bundled_Snapshot unless the user chose it by a button, and SHALL NOT replace a failed live run with a snapshot on its own.
7. THE Pre_Flight SHALL say in the Report that the data is a snapshot and when it was taken, and SHALL NOT say "Checked <time>" for it.
8. THE snapshot of this repository SHALL show `.kiro` present and not ignored, and SHALL be re-recorded whenever `.gitignore` or the `.kiro` directory changes, by a command `pnpm record:snapshots` that the Claude_Code_Lane documents and that a human runs.

### Requirement 10: Markdown export

**User Story:** As a developer, I want to paste the report into an issue or a pull request, so that I can share what failed.

#### Acceptance Criteria

1. THE Report SHALL show a Button "Copy report as Markdown".
2. WHEN the user activates it, THE Pre_Flight SHALL copy a Markdown text of the Report to the clipboard and announce "Report copied" through the polite live region.
3. WHEN the clipboard is not available, THE Pre_Flight SHALL show the Markdown in a read-only text area, selected, with "Copy this text by hand."
4. THE Markdown SHALL hold, in order: a level-1 heading with the Summary sentence, the Checklist title, the time of the run or the snapshot date, then for each Group a level-2 heading and a list with one item per check.
5. EACH list item SHALL hold the state word ("Passed", "Failed" or "Needs your answer"), the check label, the rule id in a code span, and each Evidence_Line on an indented line in a code span.
6. THE Markdown SHALL contain no emoji and no HTML.
7. THE Pre_Flight SHALL escape every string from GitHub that goes into the Markdown, so that a path or a `.gitignore` line cannot add a heading, a link, an image, a table or HTML, and SHALL keep a backtick in a code span from ending the span.
8. FOR the same Report, THE Pre_Flight SHALL produce the same Markdown every time.
9. THE Markdown SHALL include a line "Checked with Pre-Flight." and no link whose address comes from GitHub's response.

### Requirement 11: Accessibility, layout and budgets

**User Story:** As a user of any ability or device, I want every part of the app to work with a keyboard, a phone or a screen reader, so that nobody is shut out of the checks.

#### Acceptance Criteria

1. THE Pre_Flight SHALL pass an axe-core run with zero violations of WCAG 2.2 AA on the start screen, the Collection_Steps, the Report in each state (ready, not ready, undecided), the open X-ray and each error screen, at 390, 768 and 1280 px.
2. THE Pre_Flight SHALL be usable with a keyboard alone, from the start screen through the Report, an inline answer, the X-ray and the export, with a visible focus ring on every interactive element.
3. THE Pre_Flight SHALL keep every touch target at least 44 px, SHALL hold its layout from 320 px wide and at 200% zoom, and SHALL show no horizontal scroll at those sizes, including for long paths and `.gitignore` lines.
4. THE Pre_Flight SHALL announce each finished step, the Summary, each Summary change, each error and "Report copied" through the single polite live region.
5. THE Pre_Flight SHALL follow the copy rules: sentence case, active voice, no exclamation mark, no apology, one name for a control through a flow ("See why" opens "Why"), and no humor.
6. THE Pre_Flight SHALL contain none of the refused patterns: global dark mode, uppercase labels, a caption above a heading, a shadow, a gradient, an entrance animation on scroll, an arrow in a button label.
7. THE built app SHALL send less than 200 kB of JavaScript, gzipped, not counting the on-demand X-ray develop chunk and the snapshot chunk, and SHALL report both chunks' sizes beside it.
8. THE Pre_Flight SHALL show a cumulative layout shift below 0.05 on every screen, including when the Collection_Steps give way to the Report.
9. THE Pre_Flight SHALL run one `audit` call in under 10 ms over a Bundled_Snapshot's facts, measured in a benchmark.

### Requirement 12: Dependencies, lanes and test-first collector

**User Story:** As the maintainer, I want the app to stay in its lane and the network code to be proven before it is used, so that the two lanes review each other cleanly and the collector is trustworthy.

#### Acceptance Criteria

1. THE Pre_Flight SHALL use only the dependencies of section 7 of `docs/BUILD_PLAN.md` and `.kiro/steering/tech.md`, with exact pinned versions.
2. IF a task needs a package outside that list, THEN THE Claude_Code_Lane SHALL stop and ask the human before adding it.
3. THE Claude_Code_Lane SHALL write only in `apps/pre-flight/src`, `apps/pre-flight/collectors`, `apps/pre-flight` configuration files, `e2e` and the root configuration it needs, and SHALL NOT write in `.kiro/**`, `apps/pre-flight/kb`, `apps/pre-flight/rulebook` or `apps/pre-flight/golden`.
4. IF the app needs a value that `packages/engine/src/types.ts` does not carry, THEN THE Claude_Code_Lane SHALL take it as an app-side value or open a question for the Kiro_Lane, and SHALL NOT change the contract.
5. IF the app needs a component or prop that the UI_Kit does not offer, THEN THE Claude_Code_Lane SHALL compose it in the app from existing components and SHALL NOT edit `packages/ui`.
6. THE Claude_Code_Lane SHALL write each Collector test before the code it tests, and SHALL show the test failing for the right reason before it writes the code, and the task's evidence SHALL record both runs.
7. THE Claude_Code_Lane SHALL record the API responses once, with a script that a human runs, and SHALL commit them with the date and the exact request URLs, and no response SHALL hold a token, a cookie or a header that identifies the person who recorded it.

### Requirement 13: End-to-end tests

**User Story:** As a maintainer, I want the real interface exercised end to end without the live API, so that CI is stable and the rate-limit fallback is proven.

#### Acceptance Criteria

1. THE end-to-end tests SHALL answer every request to `https://api.github.com/` from the recorded responses through Playwright routing, and SHALL fail the test on any request to another host.
2. THE end-to-end tests SHALL run the full journey on each Bundled_Snapshot's recorded responses as a live run: start screen, steps, Report, and assert each check's state, label, rule id and Evidence_Line against an expectation file committed in `e2e/fixtures/`.
3. THE end-to-end tests SHALL run each sample button and assert that no request is made.
4. THE end-to-end tests SHALL assert that a live run makes exactly four requests, each to the URL of requirement 3, in a valid order, with no `Authorization` header.
5. THE end-to-end tests SHALL cover each input form of requirement 2.3 and each rejection of requirement 2.5 and 2.6.
6. THE end-to-end tests SHALL cover the three error screens (private or missing, rate limit with and without a reset time, unreachable) and the snapshot offer in the rate-limit message.
7. THE end-to-end tests SHALL cover an inline question: answering it changes the row and the Summary at once, and changing the answer from the rail changes them back.
8. THE end-to-end tests SHALL cover the X-ray on a failed check: its sources read "Collected" and "You answered" as they should, its Evidence_Lines show, "Change this answer" appears on an answered fact only, and the develop runs with and without reduced motion.
9. THE end-to-end tests SHALL cover the Markdown export: its content equals the expected text for each Bundled_Snapshot, and a repository whose path holds Markdown syntax produces an escaped export.
10. THE end-to-end tests SHALL cover a keyboard-only run from the start screen to the export.
11. THE end-to-end tests SHALL run at 390, 768 and 1280 px and in the reduced-motion project, and SHALL fail on any console error or warning.
12. THE end-to-end tests SHALL produce Task_Evidence for the interface work: screenshots at 390, 768 and 1280 px, attached to the pull request and not committed.

## Open questions and decisions

Decided by the human:

- **Goal.** The Knowledge_Base has a single goal, not one per checklist. Its values are exactly `ready` or `not_ready`. The Summary state comes from it.
- **Recording.** Claude Code may run the recording script. At most 12 requests in total are made, well under the unauthenticated limit.
- **Replay link.** Pre-Flight reports have none. The report depends on live GitHub data, and a link would either re-fetch and drift or need the snapshot inside the URL.

Questions 1 to 3 are still open. They do not block the requirements. They block tasks that depend on them, and each task names its question. Question 4 is answered.

1. **Fact and check names.** The Knowledge_Base does not exist yet. `src/checklists.ts` and `collectors/extractors.ts` need the check facts, their groups and severities, and the non-derived facts the Collector can read. They are filled in when Phase 2 delivers the Knowledge_Base.
2. **Severity and groups.** The engine contract has neither. They live in `src/checklists.ts` as app-side data, checked against the Knowledge_Base at start-up (requirement 1.10). If the human wants them in the Knowledge_Base, that needs a contract change with both lanes' consent.
3. **The two other snapshot repositories.** The human picks two public repositories to bundle with this one, so that the set shows ready, not ready and an inline question. The tasks stop at that point to ask.
4. **What a Checklist is, with one goal.** Answered: One checklist, no picker. The Checklist holds every check, so it needs no sentence for a check outside it, and the Report route carries no checklist id.
