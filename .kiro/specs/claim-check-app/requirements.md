# Requirements Document

## Introduction

Claim Check is the first Dead Certain app: `apps/claim-check`, package `@dead-certain/claim-check`. A health-insurance policyholder answers questions one at a time. The app returns how much of a hospital claim the sample policy pays, an itemised list of deductions, and the clause behind each line. Every amount opens a proof, the X-ray.

The app is a thin interface over two things that already exist: the engine API in `packages/engine/src/types.ts` (consultation mode) and the components in `packages/ui`. It decides nothing itself. It compiles no rules at run time, calls no LLM and makes no network request.

This spec is implemented by the Claude Code lane in `apps/claim-check/src` and `e2e`. The Kiro lane writes the spec only. The requirements derive from section 8 of `docs/BUILD_PLAN.md` (the Claim Check screens), `.kiro/steering/design-system.md` and the `ui-kit` spec. Requirement numbers are stable so the design's correctness properties can cite them.

Scope of this spec: the start screen, the consultation flow, the verdict, the X-ray proof view, the rulebook page, the replay link and stale-link notice, the 404 page, and a Playwright test of every golden scenario. Out of scope: any change to `packages/ui` or `packages/engine`, the knowledge base itself, and the golden scenarios themselves (Phase 2 delivers both).

## Glossary

- **Claim_Check**: The app in `apps/claim-check`.
- **Engine**: The public API of `@dead-certain/engine` that satisfies `EngineApi` in `packages/engine/src/types.ts`. Claim_Check uses `start`, `next`, `answer`, `explain`, `whatIf`, `encode` and `decode`. It does not use `audit`.
- **UI_Kit**: The package `@dead-certain/ui`.
- **Knowledge_Base**: The compiled JSON of `apps/claim-check/kb/*.yaml`, produced by `pnpm dc build`, typed as `KnowledgeBase`.
- **Rulebook**: The sample policy in `apps/claim-check/rulebook/`, which the Knowledge_Base's clauses come from.
- **Golden_Scenario**: One scenario in `apps/claim-check/golden/*.yaml`, in the format of the "Golden scenarios" section of `docs/kb-format.md`.
- **Session**: The engine's `Session`: the Knowledge_Base and the answers so far.
- **Replay_Token**: The string `encode(session)` returns.
- **Replay_Fragment**: The URL fragment `#/?r=<Replay_Token>`. Routes live in the fragment (section 7 of `docs/BUILD_PLAN.md`), so the check route's query holds the token.
- **Replay_Link**: The page URL with a Replay_Fragment.
- **Stale_Link**: A Replay_Link whose token `decode` rejects with `KB_MISMATCH`, `MALFORMED_TOKEN` or `UNSUPPORTED_VERSION`.
- **Goal_Config**: The small module `src/config.ts` that names the Knowledge_Base's amount goal, state goal and claimed-amount fact. It is the only place the app names a fact or goal.
- **Question_Path**: The ordered list of facts the Engine asks, found by replaying the answers from an empty session. It does not depend on the order the user answered in.
- **Relevant_Answer**: An answered fact that appears as a leaf with source `answered` in the proof of a goal, or that is the question being asked now.
- **Skipped_Note**: A `SkippedNote` from `@dead-certain/ui`: an answered fact that is no longer a Relevant_Answer, with one plain line of reason.
- **Verdict_Screen**: The screen that shows the verdict, the ledger and the what-if list.
- **X-ray**: The proof view: paper on the left and film on the right at 1280 px and up, film as a sheet below that, opened through `XrayStage`.
- **Deciding_Clause**: The clause cited by the rule that produced the line or goal being explained.
- **Task_Evidence**: Per task: screenshots at 390, 768 and 1280 px, a clean browser console, a zero-violation axe result and `pnpm check` output.
- **Claude_Code_Lane**: The implementing lane for `apps/claim-check/src` and `e2e`.
- **Kiro_Lane**: The lane that owns `.kiro/**`, `packages/engine`, `packages/kb-tools`, `apps/*/kb`, `apps/*/rulebook` and `apps/*/golden`.

## Requirements

### Requirement 1: App shell, routes and run-time boundaries

**User Story:** As a policyholder, I want a small app that opens fast and keeps my answers on my device, so that I can trust it with claim details.

#### Acceptance Criteria

1. THE Claim_Check SHALL serve three pages chosen by the fragment route, so deep links work on static hosting: the check at `#/`, the rulebook at `#/rulebook`, and a 404 page for any other route.
2. THE Claim_Check SHALL render every page inside the UI_Kit `AppShell` with the app name "Claim Check" and navigation entries "Claim Check" and "Rulebook", with `current` set on the page shown.
3. THE Claim_Check SHALL load the Knowledge_Base from the compiled JSON of `pnpm dc build` and SHALL NOT parse YAML or compile rules in the browser.
4. THE Claim_Check SHALL make no network request after the page and its assets have loaded, and SHALL load no third-party font, script or style.
5. THE Claim_Check SHALL NOT use `localStorage`, `sessionStorage`, cookies, analytics or a backend.
6. THE Claim_Check SHALL import the Engine and the UI_Kit as packages, and SHALL NOT modify `packages/engine/src/types.ts` or any file in `packages/ui`.
7. THE Claim_Check SHALL name a fact or a goal in `src/config.ts` only, and every other module SHALL read the fact definitions, labels, clauses and currency from the Knowledge_Base.
8. WHEN the Knowledge_Base file is missing or does not satisfy `KnowledgeBase` at start-up, THE Claim_Check SHALL show a plain-words notice that says the rules failed to load and that the page should be reloaded, and SHALL NOT show a blank page.
9. THE Claim_Check SHALL set the document title to the screen's heading followed by "Claim Check", and SHALL update it on each screen change.

### Requirement 2: Start screen

**User Story:** As a policyholder, I want to know what the app does and begin in one action, so that I do not have to read a manual first.

#### Acceptance Criteria

1. WHEN the page opens with no Replay_Fragment, THE Claim_Check SHALL show the start screen on one Sheet.
2. THE start screen SHALL show the heading "Check a hospital claim before you file it" as the page's level-1 heading, in the Document voice at 36/44.
3. THE start screen SHALL show a paragraph in the System voice that says the person answers a few questions and gets the amount the policy pays, each deduction and the clause behind it.
4. THE start screen SHALL show a primary Button labelled "Start the check" and a link labelled "Read the sample policy" to the rulebook page.
5. THE start screen SHALL show the two lines "Uses a sample policy written for this demo." and "Your answers stay in your browser." in small type.
6. WHEN the user activates "Start the check", THE Claim_Check SHALL move focus to the heading of the first question and SHALL show that question.
7. WHEN the user presses Enter while "Start the check" has focus, THE Claim_Check SHALL behave as for activation.
8. THE start screen SHALL contain no uppercase label, no caption above the heading and no arrow in a button label.

### Requirement 3: The consultation flow, one question at a time

**User Story:** As a policyholder, I want one clear question at a time with its reason, so that I understand why I am being asked.

#### Acceptance Criteria

1. THE Claim_Check SHALL show exactly one `QuestionCard` at a time, built from the question `next(session)` returns and the matching `FactDef`.
2. THE Claim_Check SHALL render the control that matches the fact type: two large buttons for boolean, radio cards for enum, a currency input for money, a number input for number, and the native picker for date.
3. THE `QuestionCard` SHALL show a disclosure "Why this question?" that holds the question's `why` text and, when the question has a `clause`, the clause id, title and text from the Knowledge_Base as a `ClauseQuote`.
4. THE Claim_Check SHALL show the progress line "Question N. Up to M more." where N is the position of the question in the Question_Path and M is the number of askable facts with no answer yet, less the one being asked, and SHALL show "Last question." when M is zero.
5. WHEN an answer is empty or invalid, THE Claim_Check SHALL show a message in plain words under the field, using the UI_Kit's answer messages, and SHALL NOT call `answer`.
6. WHEN the Engine rejects a valid-looking answer with an `EngineError` whose code is `INVALID_ANSWER` or `NOT_ANSWERABLE`, THE Claim_Check SHALL show a plain-words message under the field and SHALL NOT change the session.
7. WHEN the user submits a valid answer, THE Claim_Check SHALL call `answer(session, fact, value)`, SHALL replace the session with the result, and SHALL show the next question or the verdict without a loading state.
8. WHEN the user presses Enter in the field, THE Claim_Check SHALL submit the answer if it is valid.
9. WHEN a question has options and the user presses a number key that matches an option, THE Claim_Check SHALL select that option.
10. WHEN the user presses Escape while a disclosure or panel is open, THE Claim_Check SHALL close it.
11. WHEN a new question appears, THE Claim_Check SHALL move focus to its heading and SHALL announce the question through the polite live region.
12. WHEN the user activates "Back", THE Claim_Check SHALL show the previous question of the Question_Path with its answer filled in, and SHALL leave every answer in the session.
13. THE Claim_Check SHALL omit "Back" on the first question.
14. THE Claim_Check SHALL NOT ask a question for a fact the Engine has not asked, and SHALL NOT ask a question for a fact that already has an answer unless the user chose to change it.

### Requirement 4: The answers rail

**User Story:** As a policyholder, I want to see my answers and change any of them, with the result updating at once, so that I can try what-ifs without starting over.

#### Acceptance Criteria

1. THE Claim_Check SHALL pass an `AppShell` rail that lists each Relevant_Answer as a button, in Question_Path order, with its label, its value as printed and its raw value.
2. WHERE the viewport is 1024 px wide or more, THE Claim_Check SHALL show the rail as the 240 px margin rail, and WHERE it is narrower, THE Claim_Check SHALL show it as the collapsed "Your answers (N)" disclosure.
3. WHEN the user activates an answer in the rail, THE Claim_Check SHALL show that question with its current answer filled in.
4. WHEN the user submits a changed answer, THE Claim_Check SHALL recompute with `answer` and SHALL show the resulting question or verdict, and SHALL NOT ask the user to confirm.
5. WHEN a change makes an answered fact no longer a Relevant_Answer, THE Claim_Check SHALL remove it from the rail and SHALL show a Skipped_Note for it with the reason "Not needed now that <label of the changed fact> is <printed value>."
6. WHEN a change makes a skipped fact relevant again, THE Claim_Check SHALL restore its answer to the rail and SHALL remove its Skipped_Note.
7. THE Claim_Check SHALL keep the answer of a skipped fact in the session and the Replay_Token, so that changing the answer back restores it.
8. THE Claim_Check SHALL mark the question being asked with `aria-current` in the rail.
9. WHEN the rail changes, THE Claim_Check SHALL announce the change through the polite live region in one short sentence.

### Requirement 5: Early stop

**User Story:** As a policyholder, I want the app to stop asking as soon as the outcome is decided, so that I answer only what matters.

#### Acceptance Criteria

1. WHEN `next(session)` returns a verdict, THE Claim_Check SHALL stop asking questions and SHALL show the Verdict_Screen.
2. WHEN the Verdict_Screen is reached by submitting an answer, THE Claim_Check SHALL show the line "That is enough to decide" above the verdict headline and SHALL announce it through the polite live region.
3. WHEN the Verdict_Screen is reached by opening a Replay_Link, THE Claim_Check SHALL NOT show the line "That is enough to decide".
4. WHEN the user changes an answer from the Verdict_Screen and the result is a new question, THE Claim_Check SHALL show that question and SHALL NOT show the old verdict.
5. THE Claim_Check SHALL NOT ask a question after `next` has returned a verdict for the same answers.

### Requirement 6: The verdict

**User Story:** As a policyholder, I want the amount stated first, then where every deduction came from, so that I can see what is paid and why.

#### Acceptance Criteria

1. THE Verdict_Screen SHALL show a `VerdictHeadline` whose state comes from `verdictStateFrom` applied to the value of the state goal, with the state's icon and word.
2. THE headline statement SHALL read "<payable> of <claimed> will be paid" in the Document voice at 48/56 (36/44 below 768 px), with amounts in tabular lining figures and the currency of the Knowledge_Base.
3. THE Verdict_Screen SHALL show a `ProportionBar` whose total is the claimed amount and whose parts are one "paid" part for the payable amount and one "cut" part for each deduction line item with a non-zero value, each cut part labelled with the line item's label.
4. THE Verdict_Screen SHALL show a `Ledger` with the claimed amount, each non-zero deduction as a row with its label, clause id and signed amount, and the payable amount, and the ledger's arithmetic SHALL be claimed minus the deductions shown equals payable.
5. THE Verdict_Screen SHALL take the line items from `Verdict.lineItems`, and SHALL NOT compute or adjust an amount.
6. WHEN a line item's value is unknown, THE Claim_Check SHALL show the row as "Not yet known" and SHALL NOT include it in the proportion bar.
7. THE Verdict_Screen SHALL show a button "See why", a button "Copy link to this verdict" and a quiet button "Start over".
8. WHEN the user activates "Start over", THE Claim_Check SHALL clear all answers and the Replay_Fragment and SHALL show the start screen.
9. WHEN the state is `denied`, THE Claim_Check SHALL show the same screen with a payable amount of zero and the headline state "Not paid".
10. THE Verdict_Screen SHALL NOT show a joke, an exclamation mark or a colour that is not paired with the state's icon and word.
11. THE Verdict_Screen SHALL fit on one printed page, with its ledger and the clauses it cites, when printed.

### Requirement 7: What would change this

**User Story:** As a policyholder, I want to see which single change would alter the outcome, so that I know what matters.

#### Acceptance Criteria

1. THE Verdict_Screen SHALL show a `WhatIfList` headed "What would change this", built from `whatIf(session)`.
2. FOR each alternative, THE `WhatIfList` SHALL show the changed fact's label, the new value as printed and the signed change in the payable amount.
3. WHEN `whatIf(session)` returns no alternative, THE Claim_Check SHALL omit the heading and the list.
4. WHEN the user activates an alternative, THE Claim_Check SHALL NOT change the session, and SHALL offer the question for that fact through the answers rail only.

### Requirement 8: The X-ray proof view

**User Story:** As a policyholder, I want to open any amount and see the rules, answers and clause behind it, so that I can check the decision myself.

#### Acceptance Criteria

1. WHEN the user activates "See why", THE Claim_Check SHALL open the X-ray for the whole verdict, titled "Why".
2. WHEN the user activates a ledger row, THE Claim_Check SHALL open the X-ray for that line, titled "Why: <label of the line>".
3. THE X-ray SHALL be built with `XrayStage`, with the proof taken from `explain(session, fact)` for the goal or the line item's fact.
4. THE X-ray SHALL show the proof as a `ProofTree`, with each rule's plain sentence from `ProofNode.because` first and its expression behind "Show the rule", printed from the rule with the Engine's `print`.
5. THE X-ray SHALL show each fact's source as "You answered", "Collected" or "Worked out" through `SourceBadge`.
6. THE X-ray SHALL show the Deciding_Clause as a `ClauseQuote` in the "deciding" variant, with a wax rule beside it, and SHALL mark the deciding sentence only when the Knowledge_Base names one.
7. WHEN an answered fact is shown in the tree, THE X-ray SHALL offer "Change this answer", and activating it SHALL close the X-ray and show that question with its answer filled in.
8. WHERE the viewport is 1280 px wide or more, THE X-ray SHALL show paper on the left and film on the right, and WHERE it is narrower, THE X-ray SHALL show the film as a sheet that slides up.
9. WHEN the X-ray opens and the user has not asked for reduced motion, THE Claim_Check SHALL run the develop: a scan line crosses the paper once in 500 ms and the film appears behind it.
10. WHILE `prefers-reduced-motion: reduce` applies, THE Claim_Check SHALL replace the scan line with a 120 ms fade of the film and SHALL show no other movement.
11. THE X-ray's tree SHALL follow the ARIA tree pattern: arrow keys move, Enter expands, and Escape closes the X-ray and returns focus to the row or button that opened it.
12. WHEN the X-ray is open, THE Claim_Check SHALL keep the proof in step with the session, and WHEN the proof's target no longer exists after a change, THE Claim_Check SHALL close the X-ray.
13. THE X-ray SHALL use no animation other than the develop, the 200 ms panel open and close, and the 120 ms control presses.

### Requirement 9: The rulebook page

**User Story:** As a reader, I want to read the sample policy and see which rules use each clause, so that I can check the rules cover the policy and nothing else.

#### Acceptance Criteria

1. THE rulebook page SHALL show the clauses of the Knowledge_Base in the Document voice, in numbered order, each with its id, title and text.
2. FOR each clause, THE rulebook page SHALL list the rules that cite it, each with its id, its plain sentence and a link to open that rule's proof where the rule has a fact the Engine can explain.
3. WHEN no rule cites a clause, THE rulebook page SHALL show "Not used in any decision" for that clause.
4. THE rulebook page SHALL show, from the rule side, every rule with the clause it cites, so that the page proves coverage in both directions.
5. WHEN a rule cites a clause id that the Knowledge_Base does not hold, THE rulebook page SHALL show the rule under "Cites a missing clause" with the id, and SHALL NOT fail to render.
6. THE rulebook page SHALL read clauses and rules from the Knowledge_Base only, and SHALL NOT carry a second copy of any clause text.
7. THE rulebook page SHALL support a link to a single clause at `#/rulebook?clause=<clause id>`, using the clause id as the element id, and SHALL move focus to that clause when the page opens on its link.
8. THE rulebook page SHALL be reachable from the start screen, the navigation and the stale-link notice.

### Requirement 10: The replay link

**User Story:** As a policyholder, I want a link that always shows the same verdict, so that I can share or revisit it.

#### Acceptance Criteria

1. WHEN the session changes, THE Claim_Check SHALL write the Replay_Fragment `#/?r=<Replay_Token>` with `history.replaceState`, so that a change adds no history entry and no request is made.
2. WHEN the session has no answers, THE Claim_Check SHALL write the fragment as `#/` with no token.
3. WHEN the page opens with a Replay_Fragment, THE Claim_Check SHALL call `decode(kb, token)` and SHALL show the question or verdict for the decoded session.
4. FOR the same answers, THE Claim_Check SHALL show the same verdict and the same proof every time a Replay_Link opens, on any load.
5. WHEN the user activates "Copy link to this verdict", THE Claim_Check SHALL copy the Replay_Link to the clipboard, SHALL show the link as text in the Machine voice, and SHALL announce "Link copied" through the polite live region.
6. WHEN the clipboard is not available, THE Claim_Check SHALL show the link as selectable text and SHALL say to copy it by hand.
7. WHEN the fragment changes while the page is open, THE Claim_Check SHALL decode it again and SHALL show the result.
8. THE Replay_Token SHALL be the only answer data in the fragment, and THE Claim_Check SHALL send nothing about the answers to any server.

### Requirement 11: The stale-link notice

**User Story:** As a person with an old link, I want to be told plainly that it no longer works and what to do, so that I am not shown a wrong verdict.

#### Acceptance Criteria

1. WHEN `decode` throws an `EngineError` with code `KB_MISMATCH`, `MALFORMED_TOKEN` or `UNSUPPORTED_VERSION`, THE Claim_Check SHALL show the UI_Kit `StaleLinkNotice` for that code in place of the question or verdict.
2. WHEN `decode` throws any other `EngineError`, THE Claim_Check SHALL show the `StaleLinkNotice` for `MALFORMED_TOKEN`.
3. WHEN `decode` throws an error that is not an `EngineError`, THE Claim_Check SHALL show the `StaleLinkNotice` for `MALFORMED_TOKEN` and SHALL NOT show the error's message.
4. THE Claim_Check SHALL NOT show a verdict, a partial verdict or a question for a Stale_Link.
5. THE Claim_Check SHALL pass `rulebookHref` for `KB_MISMATCH`, so that "Read the current policy" opens the rulebook page.
6. WHEN the user activates "Start the check" in the notice, THE Claim_Check SHALL clear the fragment and show the first question.
7. WHEN the notice appears, THE Claim_Check SHALL move focus to its heading and SHALL announce it through the polite live region.

### Requirement 12: The 404 page

**User Story:** As a person on a wrong address, I want to see that and get back, so that I am not stranded.

#### Acceptance Criteria

1. WHEN the fragment route matches no page, THE Claim_Check SHALL show a 404 page in the AppShell with the heading "Page not found" and one dry line of humor that says nothing about money.
2. THE 404 page SHALL offer links to the check and to the rulebook.
3. THE 404 page SHALL set the document title to "Page not found. Claim Check" and SHALL move focus to its heading.
4. THE 404 page SHALL work on static hosting with no server rewrite and no `404.html`, because routes live in the fragment.
5. THE 404 page SHALL NOT use an exclamation mark.

### Requirement 13: Accessibility, layout and budgets

**User Story:** As a user of any ability or device, I want every part of the app to work with a keyboard, a phone or a screen reader, so that nobody is shut out of their claim.

#### Acceptance Criteria

1. THE Claim_Check SHALL pass an axe-core run with zero violations of WCAG 2.2 AA on the start screen, a question of each fact type, the Verdict_Screen, the open X-ray, the rulebook page, the stale-link notice and the 404 page, at 390, 768 and 1280 px.
2. THE Claim_Check SHALL be usable with a keyboard alone, from the start screen through the verdict, the X-ray and back, with a visible focus ring on every interactive element.
3. THE Claim_Check SHALL keep every touch target at least 44 px, SHALL hold its layout from 320 px wide and at 200% zoom, and SHALL show no horizontal scroll at those sizes.
4. THE Claim_Check SHALL announce each new question, each verdict, each rail change, "Link copied" and each notice through the single polite live region.
5. THE Claim_Check SHALL follow the copy rules: sentence case, active voice, no exclamation mark, no apology, one name for a control through a flow, and humor only in the footer and on the 404 page.
6. THE Claim_Check SHALL contain none of the refused patterns: global dark mode, uppercase labels, a caption above a heading, a shadow, a gradient, an entrance animation on scroll, an arrow in a button label.
7. THE built app SHALL send less than 200 kB of JavaScript, gzipped, not counting the on-demand develop chunk, and SHALL report the chunk's size beside it.
8. THE Claim_Check SHALL show a cumulative layout shift below 0.05 on every screen.
9. THE Claim_Check SHALL compute one consultation step in under 10 ms, measured in a benchmark over the built Knowledge_Base.
10. THE Claim_Check SHALL render each step without a spinner or loading placeholder.

### Requirement 14: Dependencies and lanes

**User Story:** As the maintainer, I want the app to stay inside its lane and its dependency list, so that the two lanes review each other cleanly.

#### Acceptance Criteria

1. THE Claim_Check SHALL use only the dependencies of section 7 of `docs/BUILD_PLAN.md` and `.kiro/steering/tech.md`: React, Vite, Tailwind CSS, Radix primitives, Motion and the workspace packages, with exact pinned versions.
2. IF a task needs a package outside that list, THEN THE Claude_Code_Lane SHALL stop and ask the human before adding it.
3. THE Claude_Code_Lane SHALL write only in `apps/claim-check/src`, `apps/claim-check` configuration files, `e2e` and the root configuration it needs, and SHALL NOT write in `.kiro/**`, `apps/claim-check/kb`, `apps/claim-check/rulebook` or `apps/claim-check/golden`.
4. IF the app needs a value that `packages/engine/src/types.ts` does not carry, THEN THE Claude_Code_Lane SHALL take it as an app-side prop or open a question for the Kiro_Lane, and SHALL NOT change the contract.
5. IF the app needs a component or prop that the UI_Kit does not offer, THEN THE Claude_Code_Lane SHALL compose it in the app from existing components and SHALL NOT edit `packages/ui`.

### Requirement 15: A Playwright test for every golden scenario

**User Story:** As a maintainer, I want every golden scenario run through the real interface, so that the interface and the engine agree on every case the rulebook defines.

#### Acceptance Criteria

1. THE test suite SHALL contain one Playwright test for each Golden_Scenario in `apps/claim-check/golden/*.yaml`, generated from the files, so that a scenario added later gets a test with no change to the test code.
2. FOR each scenario with `expect.goals`, THE test SHALL open the built app, answer each fact in `facts` through the interface in the order the app asks, and SHALL assert that the verdict screen shows the state, the payable amount and the claimed amount that the expected goals give.
3. FOR each scenario with `expect.line_items`, THE test SHALL assert that the ledger shows exactly the non-zero deduction rows the line items give, with their labels and amounts, and no other deduction.
4. FOR each scenario with `expect.fires`, THE test SHALL open the X-ray for the verdict and SHALL assert that each listed rule id appears in the proof or in a ledger line's proof.
5. FOR each scenario with `expect.ask`, THE test SHALL assert that, after the given facts, the app shows a question for that fact and no verdict.
6. THE test SHALL give every fact through the control that matches its type, using the labelled field or option, and SHALL NOT call the Engine or write the fragment to reach the screen.
7. FOR each scenario, THE test SHALL copy the Replay_Link after the verdict, open it in a new page and SHALL assert that the same verdict and ledger appear.
8. THE test SHALL read the scenarios with the `@dead-certain/kb-tools` loader and the amounts in minor units, and SHALL format expected amounts with the UI_Kit's `formatMoney`, so that no expected string is typed by hand.
9. THE test suite SHALL fail when `apps/claim-check/golden/` holds no scenario, so that a missing folder does not pass.
10. THE test suite SHALL cover the flows that scenarios do not: a keyboard-only run from start to verdict and into the X-ray and out, changing an answer from the rail so that the verdict recomputes and a skipped note appears, early stop with "That is enough to decide", a Stale_Link for each of `KB_MISMATCH`, `MALFORMED_TOKEN` and `UNSUPPORTED_VERSION`, the 404 page, the rulebook coverage in both directions, and the X-ray develop with and without reduced motion.
11. THE test suite SHALL run at 390, 768 and 1280 px and in the reduced-motion project, and SHALL fail on any console error or warning.
12. THE test suite SHALL produce Task_Evidence for the interface work: screenshots at 390, 768 and 1280 px, attached to the pull request and not committed.

## Open questions for the human and the Kiro lane

These do not block the requirements. They block tasks that depend on them, and each task names its question.

1. **Goal and fact names.** The Knowledge_Base does not exist yet. `src/config.ts` needs the amount goal (assumed `payable`), the state goal (assumed `outcome`, with values `paid`, `reduced`, `denied`) and the claimed-amount fact (assumed `claimed`). The names are confirmed when Phase 2 delivers the Knowledge_Base.
2. **Where the compiled JSON is written.** `pnpm dc build` is documented to write JSON, but its output path is not stated in `docs/kb-format.md`. The first task confirms the path and reads it.
3. **The deciding sentence.** `Clause` has no field that marks the deciding sentence. Requirement 8.6 marks one only when the Knowledge_Base names it, and otherwise draws the wax rule beside the whole clause.
4. **App base path.** The site uses base `/dead-certain/`. The template's base for a new app is `/claim-check/`. The tasks assume `/dead-certain/claim-check/`.
