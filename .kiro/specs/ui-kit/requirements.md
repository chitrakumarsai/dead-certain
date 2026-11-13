# Requirements Document

## Introduction

The ui-kit is the shared design system for Dead Certain: the package `@dead-certain/ui` (`packages/ui`) plus the `/kit` gallery in `apps/site`. It supplies design tokens, self-hosted fonts and the Dead Certain React components that Claim Check, Pre-Flight and the site build on. The kit is a presentation layer over the engine contract in `packages/engine/src/types.ts`. It renders the contract's types and computes no decision.

Two materials organise the interface. Paper is for asking and answering. Film is for proof. One choreographed moment, the X-ray develop, moves a verdict from paper to film.

This spec is implemented by the Claude Code lane. The Kiro lane writes the spec only. These requirements derive from the approved `design.md`, section 8 of `docs/BUILD_PLAN.md` and `.kiro/steering/design-system.md`. Requirement numbers are stable so the design's correctness properties can reference them.

## Glossary

- **UI_Kit**: The package `@dead-certain/ui` in `packages/ui`, including its stylesheets, components, formatting helpers and fixtures.
- **Tokens_Stylesheet**: The file `packages/ui/tokens.css`, which defines every colour, spacing, radius, layout, motion and type value as a CSS custom property.
- **Theme_Stylesheet**: The file `packages/ui/theme.css`, which maps tokens into the Tailwind theme.
- **Built_CSS**: The CSS that the Vite build of the UI_Kit and the Gallery emits.
- **Paper**: The surface for asking and answering, set by Sheet with `data-surface="paper"`.
- **Film**: The surface for proof, set by the Film component with `data-surface="film"`.
- **Engine_Contract**: The public types in `packages/engine/src/types.ts`: `Question`, `Verdict`, `LineItem`, `ProofNode`, `Alternative`, `FactDef`, `FactValue`, `FactSource`, `Clause` and `ErrorCode`.
- **Component_Set**: The eighteen components: Sheet, Film, QuestionCard, AnswerControl, AnswersRail, ClauseQuote, VerdictHeadline, Ledger, ProportionBar, ProofTree, SourceBadge, CheckRow, Button, Disclosure, XrayStage, AppShell, WhatIfList and StaleLinkNotice.
- **Gallery**: The `/kit` page of `apps/site`, served at `/dead-certain/kit/` from the entry `apps/site/kit/index.html`.
- **Specimen**: One rendered state of one component in the Gallery, marked `data-specimen="<component>-<state>"`.
- **Static_Screen**: One of the six fixture-built screens rendered in the Gallery.
- **Fixtures**: The file `packages/ui/src/fixtures.ts`, which holds contract-typed sample data in integer minor units.
- **Format_Module**: The code in `packages/ui/src/format/` that formats and parses money, dates, values and labels.
- **Live_Region**: The single polite `aria-live` region hosted by AppShell.
- **Proof_Tree_Reducer**: The pure function `treeReduce` in `proofTreeState.ts` that maps a tree state and a key to the next tree state.
- **Verdict_State_Mapper**: The function `verdictStateFrom` in `verdictState.ts`.
- **Stale_Link_Notice**: The StaleLinkNotice component.
- **Replay_Failure**: One of `KB_MISMATCH`, `MALFORMED_TOKEN` or `UNSUPPORTED_VERSION`, each a member of the engine's `ErrorCode`.
- **Kit_Test_Suite**: The Vitest unit and property tests in `packages/ui` and the Playwright tests in `e2e/kit.spec.ts`.
- **Task_Evidence**: The per-task bundle of screenshots at 390, 768 and 1280 px, a clean browser console read, a zero-violation axe result and `pnpm check` output.
- **Kit_Bundle**: The built JavaScript of the UI_Kit, excluding React and React DOM.
- **Claude_Code_Lane**: The implementing lane for `packages/ui`, `apps/site` and `e2e`.
- **Kiro_Lane**: The lane that owns `.kiro/**` and `packages/engine`.

## Requirements

### Requirement 1: Design tokens and surfaces

**User Story:** As a designer, I want every colour, size and motion value defined once as a token, so that both apps and the site look the same.

#### Acceptance Criteria

1. THE Tokens_Stylesheet SHALL define the colour tokens `--lightbox`, `--paper`, `--ink`, `--ink-soft`, `--hairline`, `--film`, `--bone`, `--bone-soft`, `--wax`, `--paid`, `--reduced`, `--denied`, `--focus-paper` and `--focus-film` with the values in `.kiro/steering/design-system.md`.
2. THE Tokens_Stylesheet SHALL define the spacing tokens `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`, `--space-12`, `--space-16` and `--space-24` as 4, 8, 12, 16, 24, 32, 48, 64 and 96 px.
3. THE Tokens_Stylesheet SHALL define `--radius-paper` as 4 px, `--radius-control` as 6 px and `--radius-film` as 8 px.
4. THE Tokens_Stylesheet SHALL define `--column-max` as 680 px, `--rail-width` as 240 px and `--touch-min` as 44 px.
5. THE Tokens_Stylesheet SHALL define the motion tokens `--ease` as `cubic-bezier(0.2, 0, 0, 1)`, `--dur-press` as 120 ms, `--dur-panel` as 200 ms, `--dur-xray` as 500 ms and `--dur-reduced` as 120 ms.
6. THE Tokens_Stylesheet SHALL define the type tokens for the Document, System and Machine voices at the sizes in `.kiro/steering/design-system.md`, with the verdict headline at 36/44 and the question text at 21/28 below 768 px.
7. THE Tokens_Stylesheet SHALL define the surface-context properties `--surface`, `--text`, `--text-soft`, `--control-border`, `--divider` and `--focus`, with Paper values as the default.
8. WHEN an element carries `data-surface="film"`, THE Tokens_Stylesheet SHALL resolve `--surface` to `--film`, `--text` to `--bone`, `--text-soft` to `--bone-soft`, `--control-border` and `--divider` to `--bone-soft`, and `--focus` to `--focus-film`.
9. THE Tokens_Stylesheet SHALL set `:focus-visible` to a 2 px outline in `--focus` with a 2 px offset.
10. THE Tokens_Stylesheet SHALL set `color-scheme` to `light`.
11. THE Theme_Stylesheet SHALL remove the Tailwind default palette and off-scale spacing so that a hardcoded colour or off-scale spacing value fails to compile into a class.
12. THE UI_Kit SHALL provide a `.figures` utility that sets `font-variant-numeric` to `tabular-nums lining-nums`, and every component that prints a monetary amount SHALL apply it.
13. THE UI_Kit SHALL export `tokens.css`, `styles.css` and the package entry points `.`, `./fixtures`, `./styles.css` and `./tokens.css` from `package.json`.
14. WHILE `@media (forced-colors: active)` applies, THE UI_Kit SHALL draw borders and icons with `currentColor` or system colours and SHALL keep focus drawn as an `outline`.

### Requirement 2: Contrast floor and refused patterns

**User Story:** As a user with low vision, I want text and controls to meet contrast floors and the design to avoid decorative effects, so that the interface stays legible and calm.

#### Acceptance Criteria

1. THE Kit_Test_Suite SHALL parse the Tokens_Stylesheet and compute the WCAG contrast ratio for every foreground and background pair in the contrast table of `design.md`.
2. WHEN the Kit_Test_Suite computes a ratio, THE Kit_Test_Suite SHALL fail if the ratio is below the floor of 4.5 for text pairs or 3 for focus rings and control boundaries listed in the table.
3. THE Kit_Test_Suite SHALL assert that no text and no control boundary uses `--hairline`.
4. THE Kit_Test_Suite SHALL assert that `--wax` is used only as a fill behind `--ink` or `--film` text, as a stroke, or as the focus ring on Film.
5. THE Built_CSS SHALL contain zero `box-shadow` declarations other than `none`.
6. THE Built_CSS SHALL contain zero uses of `linear-gradient`, `radial-gradient` or `conic-gradient`.
7. THE Built_CSS SHALL contain zero `text-transform: uppercase` declarations.
8. THE Built_CSS SHALL contain zero `prefers-color-scheme: dark` media queries.
9. THE Built_CSS SHALL contain zero `https://` URLs.
10. THE UI_Kit SHALL contain zero scroll-triggered entrance animations.
11. THE Kit_Test_Suite SHALL fail WHEN any rendered Button label in the Gallery matches `/[→←↑↓➜»«]/u`.
12. THE UI_Kit SHALL place the progress line of a QuestionCard below the question heading and not above it.
13. THE UI_Kit SHALL write all copy in sentence case, in active voice and without exclamation marks.
14. THE UI_Kit SHALL limit humor to the AppShell footer.

### Requirement 3: Self-hosted fonts and loading

**User Story:** As a developer, I want the three Plex faces self-hosted and measured, so that no third-party request is made and layout does not jump.

#### Acceptance Criteria

1. THE UI_Kit SHALL load IBM Plex Serif at weights 400 and 600, IBM Plex Sans at weights 400 and 600, and IBM Plex Mono at weight 400 through the `@fontsource` packages `@fontsource/ibm-plex-serif`, `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`.
2. THE UI_Kit SHALL import the `latin` subset only, with `fonts.css` as the single import point.
3. WHEN the Kit_Test_Suite checks glyph coverage, THE Kit_Test_Suite SHALL confirm that U+20B9 (`₹`) renders from the chosen subset.
4. IF U+20B9 is missing from the `latin` subset of a face, THEN THE UI_Kit SHALL also import the `latin-ext` subset for that face.
5. THE Built_CSS SHALL reference font files by relative path only, with zero requests to a third-party origin.
6. THE UI_Kit SHALL document the `<link rel="preload">` tags for the files used above the fold: Sans 400, Sans 600 and Serif 600.
7. THE UI_Kit SHALL assign the Document voice to clause text and verdict statements, the System voice to questions, controls and explanations, and the Machine voice to rule ids, expressions, file paths and replay tokens.

### Requirement 4: Formatting and parsing

**User Story:** As a policyholder, I want amounts and dates shown in a familiar, exact format, so that I can trust the numbers.

#### Acceptance Criteria

1. WHEN `formatMoney` receives an integer count of minor units and a currency, THE Format_Module SHALL return the amount in the currency's grouping, so that 14250000 INR minor units format as `₹1,42,500` under the `en-IN` locale.
2. WHEN the minor-unit amount is a whole number of major units, THE Format_Module SHALL omit the fraction digits, and WHEN it is not, THE Format_Module SHALL print the currency's full fraction digits.
3. WHEN `parseMoney` receives text, THE Format_Module SHALL strip spaces and group separators and return an integer of minor units built by string concatenation, with zero floating-point multiplication.
4. IF `parseMoney` receives an empty string, THEN THE Format_Module SHALL return a failure with the reason `empty`.
5. IF `parseMoney` receives text that is not digits with an optional decimal point, THEN THE Format_Module SHALL return a failure with the reason `format`.
6. IF `parseMoney` receives more fraction digits than the currency allows, THEN THE Format_Module SHALL return a failure with the reason `decimals`.
7. IF the parsed integer is not a safe integer, THEN THE Format_Module SHALL return a failure with the reason `format`.
8. FOR ALL non-negative safe integers `m` and currencies in INR, USD and JPY, parsing the output of `formatMoney(m)` SHALL return an integer equal to `m` (round-trip property).
9. WHEN `parseMoney` succeeds, THE Format_Module SHALL return a safe integer whose `formatMoney` output has no more fraction digits than the currency allows.
10. WHEN a user types in a money field, THE Format_Module SHALL regroup the digits and keep the caret after the same count of digits it followed before the edit.
11. WHEN `formatDate` receives an ISO `YYYY-MM-DD` string, THE Format_Module SHALL build the `Date` from the UTC timestamp `T00:00:00Z` and format with `timeZone: "UTC"`.
12. THE Format_Module SHALL contain zero local-time constructors or getters: `new Date(y, m, d)`, `new Date(iso)` without a `Z`, `getDate`, `getMonth`, `getFullYear` and `getHours`.
13. WHEN `formatDate` runs on an ISO string, THE Format_Module SHALL print the calendar day that the string names, whatever the machine's time zone.
14. WHEN `humanize` receives a fact name with no `FactDef.label`, THE Format_Module SHALL replace underscores with spaces and capitalise the first letter, matching the engine rule.
15. THE Format_Module SHALL render `ProofNode.because` text as received, with no placeholder substitution.

### Requirement 5: Typed against the engine contract

**User Story:** As a maintainer, I want the kit to consume the engine's own types without importing engine code, so that the lanes stay decoupled and contract changes break compilation.

#### Acceptance Criteria

1. THE UI_Kit SHALL import from `@dead-certain/engine/types` using `import type` only.
2. THE Kit_Test_Suite SHALL fail WHEN any file under `packages/ui/src`, test files excepted, imports a value from `@dead-certain/engine`.
3. THE UI_Kit SHALL accept `Question`, `Verdict`, `LineItem`, `ProofNode`, `Alternative`, `FactDef` and `Clause` as component props without conversion.
4. WHEN a component needs a value that the Engine_Contract lacks, THE UI_Kit SHALL accept the value as an explicit prop: `unit`, `min`, `mark`, `SkippedNote.reason`, `ruleExpression` and the clause lookup.
5. THE UI_Kit SHALL leave `packages/engine/src/types.ts` unchanged.
6. THE Kit_Test_Suite SHALL prove with `expectTypeOf` that the component props accept the contract types unchanged, and that `ReplayFailure` extends `ErrorCode`.
7. THE UI_Kit SHALL render `LineItem.label` verbatim for every ledger and check line.
8. WHERE `FactDef.label` is absent, THE AnswersRail SHALL display `humanize(fact)` as the label.
9. THE UI_Kit SHALL render clause text, `because` text and engine messages as text, with zero uses of `dangerouslySetInnerHTML` in `packages/ui/src`.
10. THE UI_Kit SHALL store nothing in `localStorage`, cookies or analytics, and SHALL make zero network requests.

### Requirement 6: Button

**User Story:** As a user, I want clear, large buttons with plain-word labels, so that I can act with a pointer or a keyboard.

#### Acceptance Criteria

1. THE Button SHALL offer the variants `primary`, `secondary` and `quiet`, with `secondary` as the default.
2. THE Button SHALL render the primary variant as `--ink` fill with `--paper` text on Paper, and as `--bone` fill with `--film` text on Film.
3. THE Button SHALL render the secondary variant with a `--control-border` outline, and the quiet variant as underlined text.
4. THE Button SHALL present a minimum target of 44 by 44 px and a 6 px radius.
5. WHEN a user presses the Button, THE Button SHALL change colour over 120 ms with zero movement and zero shadow.
6. WHILE the Button is disabled, THE Button SHALL set `aria-disabled`, stay in the tab order, and leave the reason in nearby text and not in a tooltip.
7. THE Button SHALL display a visible focus ring from `:focus-visible` on every state.
8. THE Gallery SHALL capture hover, pressed and focus states by Playwright acting on the real control, and the Gallery SHALL render zero forced-state markup.

### Requirement 7: Disclosure

**User Story:** As a user, I want optional detail tucked behind a clearly named control, so that the page stays quiet until I ask for more.

#### Acceptance Criteria

1. THE Disclosure SHALL render its trigger as a `<button>` with `aria-expanded` and `aria-controls`.
2. WHEN the trigger is activated, THE Disclosure SHALL open or close the panel over 200 ms.
3. WHILE `prefers-reduced-motion: reduce` applies, THE Disclosure SHALL open and close the panel instantly.
4. WHEN Escape is pressed while focus is inside the panel, THE Disclosure SHALL close the panel and return focus to the trigger.
5. THE Disclosure SHALL hide the chevron icon from assistive technology and SHALL swap the glyph to show open and closed states.
6. THE Disclosure SHALL support controlled and uncontrolled use through `open`, `defaultOpen` and `onOpenChange`.
7. THE Disclosure SHALL keep one trigger name across a flow.

### Requirement 8: SourceBadge

**User Story:** As a user reading a proof, I want each fact to say where it came from, so that I can judge it.

#### Acceptance Criteria

1. WHEN `source` is `answered`, THE SourceBadge SHALL display the text "You answered" with a filled-square marker.
2. WHEN `source` is `collected`, THE SourceBadge SHALL display the text "Collected" with a ring marker.
3. WHEN `source` is `derived`, THE SourceBadge SHALL display the text "Worked out" with a diamond marker.
4. THE SourceBadge SHALL render the text in `--text-soft` and SHALL hide the marker from assistive technology.
5. THE SourceBadge SHALL render on both Paper and Film.

### Requirement 9: ClauseQuote

**User Story:** As a policyholder, I want to read the clause behind a decision, so that I can check the source of each line.

#### Acceptance Criteria

1. THE ClauseQuote SHALL render a `<blockquote>` with a heading line made of the clause id and title in the System voice, and the clause text in the Document voice at 17/28.
2. WHEN `variant` is `plain`, THE ClauseQuote SHALL draw a 2 px left rule in `--divider`.
3. WHEN `variant` is `deciding`, THE ClauseQuote SHALL draw a 2 px left rule in `--wax`.
4. WHEN `mark` is a substring of `clause.text`, THE ClauseQuote SHALL render that substring in a `<mark>` with `--wax` fill and `--ink` text on Paper or `--film` text on Film.
5. IF `mark` is absent or not found in `clause.text`, THEN THE ClauseQuote SHALL highlight nothing.
6. IF a clause id has no `Clause`, THEN THE UI_Kit SHALL print the clause id as plain text without a quote.

### Requirement 10: AnswerControl

**User Story:** As a user, I want an input that matches the kind of fact I am answering, so that answering is quick and hard to get wrong.

#### Acceptance Criteria

1. WHEN `def.type` is `boolean`, THE AnswerControl SHALL render two large radio buttons labelled "Yes" and "No" and SHALL emit `true` or `false`.
2. WHEN `def.type` is `enum`, THE AnswerControl SHALL render one radio card per `def.options` entry labelled `humanize(option)` and SHALL emit the option string.
3. WHEN `def.type` is `money`, THE AnswerControl SHALL render a text input with a visible currency unit prefix and SHALL emit an integer of minor units.
4. WHEN `def.type` is `number`, THE AnswerControl SHALL render a text input with `inputmode="decimal"` and, WHERE `unit` is supplied, a visible unit suffix, and SHALL emit a `number`.
5. WHEN `def.type` is `date`, THE AnswerControl SHALL render a native `<input type="date">` and SHALL emit an ISO `YYYY-MM-DD` string.
6. WHILE focus is on a radio group of a boolean fact, WHEN the user presses `1` or `2`, THE AnswerControl SHALL select Yes or No.
7. WHILE focus is on a radio group of an enum fact, WHEN the user presses `1` to `9`, THE AnswerControl SHALL select the option at that position, and options after the ninth SHALL be selectable by arrow keys and click.
8. WHILE focus is in a text-like field, THE AnswerControl SHALL treat digit keys as text.
9. WHEN Enter is pressed in a money, number or date field, THE AnswerControl SHALL call `onEnter`.
10. THE AnswerControl SHALL label the group or input by the question heading through `aria-labelledby`.
11. WHEN `error` is set, THE AnswerControl SHALL set `aria-invalid="true"`, set `aria-describedby` to the error element and render the error text under the field.
12. THE AnswerControl SHALL support the states empty, filled, focused, invalid and disabled for every control type, plus a typing state for money and number.
13. WHEN the money value is zero and `min` is absent, THE AnswerControl SHALL accept zero and emit `0`.
14. WHERE the app supplies `min`, THE AnswerControl SHALL reject a money value below `min`.
15. IF the money value is below `min` and `min` is 1, THEN THE AnswerControl SHALL show "Enter an amount above zero."
16. IF the money value is below `min` and `min` is above 1, THEN THE AnswerControl SHALL show "Enter an amount of at least" followed by `min` formatted in the currency, ending with a full stop.
17. THE AnswerControl SHALL expose no `allowZero` prop.
18. IF a money field is empty, THEN THE AnswerControl SHALL show "Enter an amount."
19. IF the money text is not digits with an optional decimal point, THEN THE AnswerControl SHALL show "Use digits only, with an optional decimal point."
20. IF the money text has more fraction digits than the currency allows, THEN THE AnswerControl SHALL show "Use at most N decimal places." with N taken from the currency.
21. IF a number field is empty or not a number, THEN THE AnswerControl SHALL show "Enter a number."
22. IF a date field is empty, THEN THE AnswerControl SHALL show "Pick a date."
23. IF a boolean or enum field is empty, THEN THE AnswerControl SHALL show "Choose one answer."
24. THE AnswerControl SHALL write validation messages in plain words without an apology.

### Requirement 11: QuestionCard

**User Story:** As a user, I want one question at a time with a reason for asking it, so that I always know what is needed and why.

#### Acceptance Criteria

1. THE QuestionCard SHALL render, from top to bottom, the question heading as `<h2 tabindex="-1">`, the progress line, the AnswerControl, the error, a Disclosure titled "Why this question?" and the Back and Continue buttons.
2. THE QuestionCard SHALL tie the progress line to the heading through `aria-describedby`.
3. WHEN the QuestionCard mounts or `question.fact` changes, THE QuestionCard SHALL move focus to the heading and announce the progress line through the Live_Region.
4. WHEN `progress` is supplied, THE QuestionCard SHALL print "Question N. Up to M more." and, on the last known question, "Last question."
5. WHEN the user presses Enter in a text-like field or on the heading, THE QuestionCard SHALL validate the value.
6. IF validation fails, THEN THE QuestionCard SHALL show the message under the field, set `aria-invalid` and move focus to the field.
7. WHEN validation passes, THE QuestionCard SHALL call `onSubmit(question.fact, value)` once.
8. WHEN `externalError` is supplied, THE QuestionCard SHALL show it as the field error.
9. WHEN the user edits the field, THE QuestionCard SHALL clear the error.
10. THE QuestionCard SHALL keep Continue enabled in every state.
11. WHEN `onBack` is absent, THE QuestionCard SHALL omit the Back button.
12. WHEN Escape is pressed with a Disclosure open, THE QuestionCard SHALL close that Disclosure.
13. WHERE `question.why` or `clause` is absent, THE QuestionCard SHALL omit the matching part of the Disclosure content.
14. THE QuestionCard SHALL render the question heading at 24/32 and, below 768 px, at 21/28.

### Requirement 12: AnswersRail

**User Story:** As a user, I want to see and change my earlier answers, so that I can explore what would change the result.

#### Acceptance Criteria

1. THE AnswersRail SHALL render each answer as a `<button>` with the visible text of label and display value, and the accessible name "Change <label>, currently <value>".
2. WHEN a user activates an answer, THE AnswersRail SHALL call `onChange(fact)`.
3. WHEN the viewport is 1024 px or wider and the Film is not open side by side, THE AnswersRail SHALL render as a 240 px `<aside aria-label="Your answers">`.
4. WHEN the viewport is below 1024 px, THE AnswersRail SHALL render as a Disclosure titled "Your answers (N)" above the Sheet.
5. WHILE the Film is open side by side, THE AnswersRail SHALL collapse into the same Disclosure.
6. WHEN `current` matches an answer, THE AnswersRail SHALL mark that answer `aria-current`.
7. WHEN `skipped` has entries, THE AnswersRail SHALL render each `SkippedNote.reason` as a plain line below the list and announce each through the Live_Region once.
8. WHEN `answers` is empty, THE AnswersRail SHALL show "No answers yet."
9. THE AnswersRail SHALL render no loading indicator.

### Requirement 13: VerdictHeadline and verdict states

**User Story:** As a user, I want the verdict in words, an icon and colour, so that the result is clear whatever I can see.

#### Acceptance Criteria

1. THE VerdictHeadline SHALL map `paid` to the word "Paid in full", a check icon and `--paid`.
2. THE VerdictHeadline SHALL map `reduced` to "Paid in part", a minus icon and `--reduced`.
3. THE VerdictHeadline SHALL map `denied` to "Not paid", a cross icon and `--denied`.
4. THE VerdictHeadline SHALL map `ready` to "Ready", a check icon and `--paid`.
5. THE VerdictHeadline SHALL map `not_ready` to "Not ready", a cross icon and `--denied`.
6. THE VerdictHeadline SHALL map `undecided` to "More answers needed", a question icon and `--text-soft`.
7. THE VerdictHeadline SHALL place the state word and the statement inside one heading, with the accessible text reading the word, a full stop and the statement.
8. THE VerdictHeadline SHALL hide the icon from assistive technology.
9. THE VerdictHeadline SHALL render at 48/56 for `size="verdict"` and 36/44 for `size="summary"`, and at 36/44 on phones for `verdict`.
10. WHEN a verdict appears, THE VerdictHeadline SHALL receive focus and the Live_Region SHALL announce it.
11. WHEN the Verdict_State_Mapper receives a goal value in {paid, reduced, denied, ready, not_ready}, THE Verdict_State_Mapper SHALL return the matching state.
12. IF the goal value is outside that set or `undefined`, THEN THE Verdict_State_Mapper SHALL return `undecided` without throwing.
13. THE VerdictHeadline SHALL apply `.figures` to every amount in the statement.

### Requirement 14: ProportionBar

**User Story:** As a policyholder, I want a quick picture of how much is paid and how much is cut, so that I grasp the result at a glance.

#### Acceptance Criteria

1. THE ProportionBar SHALL size each part with `flex-grow` equal to its integer value, and SHALL render a remainder item for `total` minus the sum of parts, with zero percentage arithmetic and zero rounding.
2. THE ProportionBar SHALL give every non-zero part a minimum width of 2 px.
3. THE ProportionBar SHALL draw paid parts solid in `--paid` and cut parts in `--reduced` with a diagonal hatch from an SVG `<pattern>`.
4. THE ProportionBar SHALL separate segments by a 2 px `--paper` gap and SHALL use zero CSS gradients.
5. THE ProportionBar SHALL expose `role="img"` with an `aria-label` that reads every part in words and amounts.
6. IF a part value is negative or not an integer, THEN THE ProportionBar SHALL clamp the value to 0.
7. IF the sum of parts exceeds `total`, THEN THE ProportionBar SHALL clamp the bar to `total`, render no remainder and log nothing.
8. THE ProportionBar SHALL support the states all paid, one cut, many cuts, all cut and zero parts.
9. FOR ALL `total` above zero and part lists, THE ProportionBar SHALL produce flex-grow values that sum to `total` with none negative.

### Requirement 15: Ledger

**User Story:** As a policyholder, I want an itemised table of deductions with the clause for each, so that I can see exactly how the payable amount was reached.

#### Acceptance Criteria

1. THE Ledger SHALL render a semantic `<table>` with a visually hidden caption "Claim ledger" and `<th scope="row">` row headers.
2. THE Ledger SHALL print `LineItem.label` in the label column, `LineItem.clause` in the Machine voice in the clause column, and the amount right-aligned with `.figures`.
3. THE Ledger SHALL print a deduction with the sign U+2212, as in "− ₹38,000".
4. THE Ledger SHALL render each amount exactly as `formatMoney` returns it, and SHALL compute no sums.
5. WHEN a Ledger row is activated, THE Ledger SHALL call `onOpen(item, element)` with the row element.
6. THE Ledger SHALL give each item row an accessible name of the form "Room rent above the limit, clause 4.2, minus ₹38,000. See why".
7. WHEN `selectedFact` matches a row, THE Ledger SHALL set `aria-current="true"` on that row.
8. THE Ledger SHALL render the claimed and payable rows as plain text and separate them from the deductions by a hairline rule.
9. WHEN there are no deductions, THE Ledger SHALL render only the claimed and payable rows.
10. WHEN an item has a value of 0, THE Ledger SHALL omit its row.
11. WHEN an item value is `undefined`, THE Ledger SHALL print "Not known yet" and keep the row openable.
12. WHEN a label is long, THE Ledger SHALL wrap the label and keep the amount unwrapped, down to 320 px.
13. FOR ALL Fixtures verdicts, claimed minus the sum of deductions SHALL equal payable.

### Requirement 16: CheckRow

**User Story:** As a developer using Pre-Flight, I want each checklist item to show pass, fail or unknown with evidence, so that I know what to fix.

#### Acceptance Criteria

1. WHEN `item.value` is `true`, THE CheckRow SHALL show the word "Passed" with a check icon in `--paid`.
2. WHEN `item.value` is `false`, THE CheckRow SHALL show the word "Failed" with a cross icon in `--denied`.
3. WHEN `item.value` is `undefined` or not a boolean, THE CheckRow SHALL show the word "Needs your answer" with a question icon in `--text-soft`.
4. THE CheckRow SHALL include the state word in the accessible name.
5. THE CheckRow SHALL show `LineItem.label`, the rule id in the Machine voice and, WHERE `detail` is supplied, the evidence line in the Machine voice.
6. WHEN the user activates the rule id, THE CheckRow SHALL call `onOpen(item, element)`.
7. WHILE the value is unknown and `question` is supplied, THE CheckRow SHALL show `question.text` and an inline boolean AnswerControl.
8. WHEN the user answers the inline question, THE CheckRow SHALL call `onAnswer(fact, value)`.

### Requirement 17: WhatIfList

**User Story:** As a user, I want to see which answers would change the outcome, so that I know what matters.

#### Acceptance Criteria

1. WHEN `alternatives` has entries, THE WhatIfList SHALL render one row per `Alternative` in the form "If <label> were <value>: <delta>".
2. WHERE `amountGoal` is supplied, THE WhatIfList SHALL show the signed delta between `alt.verdict.goals[amountGoal]` and `current.goals[amountGoal]`.
3. WHERE `amountGoal` is absent and `stateGoal` is supplied, THE WhatIfList SHALL name the new verdict state.
4. WHEN `alternatives` is empty, THE WhatIfList SHALL render nothing and no heading.
5. THE WhatIfList SHALL render plain text with no actions.

### Requirement 18: ProofTree

**User Story:** As an auditor, I want to explore a verdict's proof by keyboard, so that I can see every rule and fact that decided it.

#### Acceptance Criteria

1. THE ProofTree SHALL render a container with `role="tree"` and the accessible name "Proof", and each node with `role="treeitem"`, `aria-level`, `aria-setsize` and `aria-posinset`.
2. THE ProofTree SHALL set `aria-expanded` on parent nodes to reflect the true state, and SHALL place children in `role="group"`.
3. THE ProofTree SHALL use a roving tabindex so exactly one treeitem has `tabindex="0"`.
4. THE ProofTree SHALL render a derived node with a rule as a joint showing the rule id in the Machine voice and the `because` sentence.
5. THE ProofTree SHALL render a node with no children and an `answered` or `collected` source as a bone end with label, value and SourceBadge.
6. WHEN a node value is `undefined`, THE ProofTree SHALL print "Not known yet".
7. WHEN the user presses Down or Up, THE Proof_Tree_Reducer SHALL move the active node through the visible nodes, stopping at the first and last.
8. WHEN the user presses Right on a closed parent, THE Proof_Tree_Reducer SHALL expand the parent, and on an open parent SHALL move to its first child.
9. WHEN the user presses Left on an open parent, THE Proof_Tree_Reducer SHALL collapse the parent, and otherwise SHALL move to the parent.
10. WHEN the user presses Home or End, THE Proof_Tree_Reducer SHALL move to the first or last visible node.
11. WHEN the user presses Enter on a parent, THE Proof_Tree_Reducer SHALL toggle its expansion.
12. WHEN the user presses Escape, THE ProofTree SHALL call `onEscape`.
13. THE ProofTree SHALL identify nodes by index path, so a fact that appears under two rules gets two unique ids.
14. THE ProofTree SHALL open the root and its direct children initially and close deeper nodes.
15. FOR ALL proof trees, states and keys, THE Proof_Tree_Reducer SHALL return an active id that is in the visible ids, and SHALL never place a leaf in the expanded set.
16. FOR ALL inputs, THE Proof_Tree_Reducer SHALL leave the input state unchanged.
17. THE ProofTree SHALL place the "Show the rule" Disclosure and the "Change this answer" Button inside the active treeitem and give them `tabindex="0"` only while that treeitem is active.
18. WHERE `ruleExpression` is supplied, THE ProofTree SHALL show the expression behind a Disclosure titled "Show the rule".
19. WHERE `onChangeAnswer` is supplied, THE ProofTree SHALL offer "Change this answer" on answered facts.
20. WHEN a node's clause equals `decidingClause`, THE ProofTree SHALL show its ClauseQuote in the deciding variant under the rule sentence.
21. THE ProofTree SHALL draw strokes in `--text-soft`.

### Requirement 19: Sheet and Film

**User Story:** As a designer, I want two clearly different surfaces, so that asking and proving feel like different activities.

#### Acceptance Criteria

1. THE Sheet SHALL render a `--paper` fill, a 1 px `--hairline` border, a 4 px radius, 16 px padding below 768 px and 24 px padding from 768 px, a maximum width of `--column-max`, and `data-surface="paper"`.
2. THE Film SHALL render a `--film` fill, no border, an 8 px radius and `data-surface="film"`.
3. THE Film SHALL render a heading with the supplied `title`, `tabindex="-1"`, and a Close button beside it.
4. WHEN `presentation` is `side`, THE Film SHALL render a non-modal `<section>` labelled by its heading.
5. WHEN `presentation` is `sheet`, THE Film SHALL render a Radix Dialog anchored to the bottom, with focus trapped, Escape closing it, a maximum height of 85 vh, inner scrolling and a flat scrim with fixed opacity.
6. THE Film SHALL keep the same inner content across both presentations so that a resize across 1280 px does not remount the ProofTree.
7. THE Sheet and Film SHALL use zero shadows.

### Requirement 20: XrayStage

**User Story:** As a user, I want the proof to develop from the verdict in one deliberate moment, so that I see why the verdict is what it is.

#### Acceptance Criteria

1. WHEN the viewport is 1280 px or wider and a target is open, THE XrayStage SHALL lay out the Sheet (up to 680 px) beside the Film with `presentation: "side"`.
2. WHEN the viewport is below 1280 px and a target is open, THE XrayStage SHALL show the Sheet at full width and the Film with `presentation: "sheet"`.
3. WHEN the stage opens for the first time and `prefers-reduced-motion` is not `reduce`, THE XrayStage SHALL cross the Sheet once with a 2 px `--film` scan line over 500 ms using `--ease`, left to right at 1280 px and above and top to bottom below it.
4. WHEN the scan line crosses, THE XrayStage SHALL reveal the Film behind the line with an animated `clip-path` over the same 500 ms.
5. WHILE `prefers-reduced-motion: reduce` applies, THE XrayStage SHALL render no scan line and SHALL fade the Film in over 120 ms.
6. WHEN the target changes while the stage is open, THE XrayStage SHALL swap the Film content at once with no animation.
7. WHEN the stage opens or the target changes, THE XrayStage SHALL move focus to the Film heading and announce the title through the Live_Region.
8. WHEN the stage closes, THE XrayStage SHALL return focus to the opener element.
9. IF the opener is no longer in the document when the stage closes, THEN THE XrayStage SHALL move focus to the Sheet heading.
10. THE XrayStage SHALL import `motion` through `LazyMotion` with `domAnimation` and `m` components, and no other component SHALL import `motion`.
11. THE XrayStage SHALL accept the targets `{ kind: "verdict" }` and `{ kind: "line", fact }`.
12. WHEN `print` media applies, THE UI_Kit SHALL hide the Film.

### Requirement 21: AppShell

**User Story:** As a user, I want a consistent frame with landmarks and a skip link, so that I can navigate any app by keyboard or screen reader.

#### Acceptance Criteria

1. THE AppShell SHALL make the skip link "Skip to the content" the first focusable element.
2. THE AppShell SHALL render a `<header>` with the "Dead Certain" wordmark and navigation, a `<main id="content" tabindex="-1">`, an optional `<aside>` for the rail and a `<footer>`.
3. WHEN the viewport is below 768 px, THE AppShell SHALL place navigation behind a button labelled "Menu".
4. WHEN Escape is pressed or the user navigates, THE AppShell SHALL close the open menu.
5. THE AppShell SHALL host the single polite Live_Region and expose the `useAnnounce()` hook.
6. WHERE `footer` is not supplied, THE AppShell SHALL show "No guesses were made in the production of this verdict."
7. THE AppShell SHALL mark the current navigation item with `aria-current`.

### Requirement 22: Stale link notice

**User Story:** As a user opening an old verdict link, I want a clear explanation and a way forward, so that I am not left with a blank page.

#### Acceptance Criteria

1. WHEN `failure` is `KB_MISMATCH`, THE Stale_Link_Notice SHALL show the heading "This link was made with older rules" and a body that says the rules have changed and tells the user to start the check again.
2. WHEN `failure` is `MALFORMED_TOKEN`, THE Stale_Link_Notice SHALL show the heading "This link is incomplete or damaged" and a body that tells the user to check the whole link was copied or start again.
3. WHEN `failure` is `UNSUPPORTED_VERSION`, THE Stale_Link_Notice SHALL show the heading "This link comes from a different version" and a body that tells the user to start again.
4. THE Stale_Link_Notice SHALL define copy for every Replay_Failure through a `Record<ReplayFailure, Copy>`, so that adding a code without copy fails to compile.
5. THE Stale_Link_Notice SHALL render a primary Button "Start the check" that calls `onStart`.
6. WHERE `rulebookHref` is supplied and `failure` is `KB_MISMATCH`, THE Stale_Link_Notice SHALL render a quiet link "Read the rules".
7. THE Stale_Link_Notice SHALL use the info icon in `--text-soft` and SHALL use no `--denied` colour.
8. WHEN the notice mounts, THE Stale_Link_Notice SHALL move focus to its heading and announce it through the Live_Region.
9. THE Stale_Link_Notice SHALL render inside `<main>` as a state and SHALL not be a modal or `role="alert"`.
10. THE Stale_Link_Notice SHALL show kit-owned copy and SHALL not show the engine's own message.

### Requirement 23: Fixtures

**User Story:** As a developer, I want contract-typed sample data for every component state, so that the gallery and screens run without the engine.

#### Acceptance Criteria

1. THE Fixtures SHALL annotate every export with an Engine_Contract type so that contract drift fails to compile.
2. THE Fixtures SHALL extend the existing exports `CLAIMED_AMOUNT`, `questionFixture`, `claimVerdictFixture`, `proofFixture` and `preFlightVerdictFixture`, and SHALL not replace them.
3. THE Fixtures SHALL provide `factDefFixtures`, `questionFixtures`, `clauseFixtures`, `answersFixture`, `skippedFixture`, the verdict edge fixtures, the Pre-Flight edge fixtures, the proof fixtures, the alternatives fixtures and `claimFormat`.
4. THE Fixtures SHALL express every amount in integer minor units.
5. THE Fixtures SHALL keep claimed minus deductions equal to payable in every verdict fixture.
6. THE Fixtures SHALL provide a 30-line verdict fixture and a 200-node proof fixture.
7. THE Fixtures SHALL mark the clause text in `clauseFixtures` as sample text in a comment.
8. THE Kit_Test_Suite SHALL confirm that each proof node index path is unique and each referenced rule and clause appears in a fixture.
9. WHEN a component first needs a fixture, THE Claude_Code_Lane SHALL add that fixture in the same task.

### Requirement 24: The /kit gallery

**User Story:** As a reviewer, I want every component in every state on one page, so that I can inspect the whole system and use it as the visual reference.

#### Acceptance Criteria

1. THE Gallery SHALL be served as a second HTML entry `apps/site/kit/index.html` at `/dead-certain/kit/`, and SHALL leave the placeholder at `/` unchanged.
2. THE Gallery SHALL render a skip-linked table of contents followed by one section per component.
3. THE Gallery SHALL render each state as a Specimen `<figure data-specimen="<component>-<state>">` with a System-voice heading, the live component and a one-line note.
4. WHEN the URL fragment matches a Specimen id, THE Gallery SHALL scroll to that Specimen.
5. THE Gallery SHALL render Paper specimens on `--lightbox` and Film specimens inside a Film.
6. THE Gallery SHALL render every cell of the specimen matrix in `design.md`, covering Tokens, Button, Disclosure, SourceBadge, ClauseQuote, AnswerControl, QuestionCard, AnswersRail, VerdictHeadline, ProportionBar, Ledger, CheckRow, WhatIfList, ProofTree, Sheet, Film, XrayStage, AppShell and Stale_Link_Notice.
7. THE Gallery SHALL render the token section with colour swatches and ratios, all seven type styles, the spacing scale, the radii and the motion durations.
8. THE Gallery SHALL build on React and Tailwind added to `apps/site`.
9. THE Gallery SHALL use only Fixtures for data and SHALL not import the engine at run time.

### Requirement 25: Static screens

**User Story:** As an app builder, I want finished example screens, so that Claim Check and Pre-Flight can match a visual baseline.

#### Acceptance Criteria

1. THE Gallery SHALL render six Static_Screens: Claim Check start, Claim Check question (money), Claim Check verdict (reduced, with ledger and what-if), Claim Check verdict with the X-ray open, Pre-Flight report (not ready, with an inline question) and stale link (`KB_MISMATCH`).
2. THE Gallery SHALL expose each Static_Screen as its own deep link.
3. THE Static_Screens SHALL use only Component_Set components and Fixtures.
4. THE Static_Screens SHALL render the X-ray as a side panel at 1280 px and as a bottom sheet at 390 and 768 px.
5. THE Static_Screens SHALL group Pre-Flight checks by the first number of the clause id, with titles from an app-supplied map.

### Requirement 26: Accessibility floor

**User Story:** As a user of assistive technology or a small screen, I want the kit to meet WCAG 2.2 AA, so that every app built on it is usable.

#### Acceptance Criteria

1. THE UI_Kit SHALL make every interactive element operable by keyboard with a visible focus ring.
2. THE UI_Kit SHALL give every interactive element a target of at least 44 by 44 px.
3. THE UI_Kit SHALL hold its layout from 320 px wide and at 200% zoom with zero horizontal scroll.
4. THE UI_Kit SHALL render questions as real labelled form fields with no placeholder-only labels.
5. THE UI_Kit SHALL announce results and focus changes through the single polite Live_Region.
6. THE UI_Kit SHALL pair every verdict, check and source state with a word and an icon or marker, so colour is never the only signal.
7. THE UI_Kit SHALL hide decorative icons from assistive technology with `aria-hidden="true"`.
8. THE UI_Kit SHALL draw every icon as inline SVG with `currentColor`, a 2 px stroke and a 24 px grid, and SHALL add no icon package.
9. THE UI_Kit SHALL identify state changes with distinct icon shapes, not only with colour.

### Requirement 27: Motion

**User Story:** As a user sensitive to motion, I want movement rationed and removable, so that the interface stays calm.

#### Acceptance Criteria

1. THE UI_Kit SHALL use `--ease` for every transition and animation.
2. THE UI_Kit SHALL limit choreographed motion to the X-ray develop.
3. WHILE `prefers-reduced-motion: reduce` applies, THE Tokens_Stylesheet SHALL set `--dur-panel` to 0 ms.
4. WHILE `prefers-reduced-motion: reduce` applies, THE UI_Kit SHALL keep the 120 ms colour change on Button press and SHALL remove all other movement.
5. THE UI_Kit SHALL drive every transition other than the X-ray develop with CSS and the motion tokens.

### Requirement 28: Testing, evidence and gates

**User Story:** As a reviewer, I want each task closed with evidence and automated gates, so that I can accept work without redoing it.

#### Acceptance Criteria

1. THE Kit_Test_Suite SHALL name property tests `*.props.test.ts` and use fast-check at version 4.10.2.
2. THE Kit_Test_Suite SHALL cover pure logic in Vitest with no DOM: the Format_Module, the Verdict_State_Mapper, the Proof_Tree_Reducer, `visibleIds`, the money reformatter, the bar partition, `humanize`, the contrast function and the token parser.
3. THE Kit_Test_Suite SHALL cover component behaviour through Playwright against the Gallery, with no jsdom and no Testing Library.
4. THE Kit_Test_Suite SHALL run Playwright at 390, 768 and 1280 px as three projects, and with `reducedMotion: "reduce"` as a fourth.
5. WHEN a Playwright test runs, THE Kit_Test_Suite SHALL fail on any browser console message of type `error` or `warning`.
6. WHEN the Kit_Test_Suite runs axe on the full Gallery page and on each Static_Screen at each width, THE Kit_Test_Suite SHALL fail on any violation.
7. THE Kit_Test_Suite SHALL check horizontal scroll at 320 px and the 44 px target size of every interactive element.
8. THE Claude_Code_Lane SHALL end every task with Task_Evidence: screenshots at 390, 768 and 1280 px for what the task built, a clean console read, a zero-violation axe result and `pnpm check` output.
9. THE Claude_Code_Lane SHALL attach screenshots to the pull request and SHALL not commit them.
10. THE Kit_Test_Suite SHALL make no pixel comparison, and CI SHALL run no visual-regression gate and commit no pixel baselines.
11. THE Kit_Test_Suite SHALL fail WHEN the gzipped Kit_Bundle exceeds 50 kB.
12. THE Kit_Test_Suite SHALL measure the Lighthouse, layout-shift and 200 kB per-app budgets on the apps in Phase 3 and not on the Gallery.
13. THE Kit_Test_Suite SHALL use zero Lighthouse runs on the Gallery.

### Requirement 29: Fixed stack and dependencies

**User Story:** As a maintainer, I want a fixed stack with exact-pinned dependencies, so that builds are reproducible and reviewed.

#### Acceptance Criteria

1. THE UI_Kit SHALL use TypeScript in strict mode on Node 22 with pnpm workspaces, React, Tailwind CSS, Radix primitives and Motion, with Vitest, fast-check, Playwright, axe-core and Biome as tools.
2. THE Claude_Code_Lane SHALL choose each dependency version with `context7` in the first task and SHALL record the versions in `package.json`.
3. THE UI_Kit SHALL pin every dependency to an exact version with zero range specifiers (`^`, `~`).
4. THE UI_Kit SHALL add only these packages beyond the stack: `@tailwindcss/vite`, `@vitejs/plugin-react`, `@radix-ui/react-radio-group`, `@radix-ui/react-collapsible`, `@radix-ui/react-dialog`, the three `@fontsource` IBM Plex packages and `@axe-core/playwright`.
5. THE UI_Kit SHALL import Radix per package.
6. THE UI_Kit SHALL add no icon package, no jsdom, no Testing Library and no Lighthouse dependency.
7. IF a task needs a dependency outside the approved list, THEN THE Claude_Code_Lane SHALL ask the human before adding it.
8. THE UI_Kit SHALL use no runtime CSS-in-JS.
9. THE Kit_Bundle SHALL load `motion` only inside XrayStage.

### Requirement 30: Lane boundaries and delivery order

**User Story:** As the project lead, I want the lanes kept apart and the work ordered, so that each task is small and reviewable.

#### Acceptance Criteria

1. THE Claude_Code_Lane SHALL implement the UI_Kit in `packages/ui`, the Gallery in `apps/site` and the Playwright tests in `e2e`.
2. THE Kiro_Lane SHALL write the spec only, and SHALL create no files under `packages/ui` or `apps/`.
3. THE Kiro_Lane SHALL create no `tasks.md` in the requirements phase.
4. THE Claude_Code_Lane SHALL deliver in this order: dependencies, tokens, fonts, format and pure logic, primitives, input, composed components, proof, gallery completion and static screens, then the optional items.
5. THE Claude_Code_Lane SHALL build one control type per task for the AnswerControl.
6. IF a change to `packages/engine/src/types.ts` is needed, THEN THE Claude_Code_Lane SHALL stop and seek consent from both lanes.

### Requirement 31: Optional items

**User Story:** As the project lead, I want nice-to-have items built last and dropped first, so that time pressure never cuts core work.

#### Acceptance Criteria

1. WHERE the optional fallback font metric faces are built, THE UI_Kit SHALL define `Plex Sans Fallback`, `Plex Serif Fallback` and `Plex Mono Fallback` in `fonts.css` using `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override`, and SHALL record the measured values in a code comment.
2. WHERE the fallback font metric faces are not built, THE UI_Kit SHALL end the font stacks in plain system fonts.
3. WHERE the optional print styles are built, THE UI_Kit SHALL provide `print.css` that gives a one-page verdict with its ledger and clauses and hides the Film.
4. WHERE the optional ProofTree timing measurement is built, THE Kit_Test_Suite SHALL record a Playwright trace that shows an arrow-key press to paint in under 50 ms on the 200-node fixture.
5. THE Gallery SHALL keep the 200-node ProofTree specimen whether or not the timing measurement is built.
6. THE Claude_Code_Lane SHALL build the optional items last and in any order, and SHALL drop them first if time runs short.
