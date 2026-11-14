# Implementation Plan: ui-kit

## Overview

This plan builds the shared design system `@dead-certain/ui` (`packages/ui`) and the `/kit` gallery in `apps/site`, in TypeScript strict mode. The order follows the design's delivery order: dependencies and tokens, fonts, pure logic, primitives, the five `AnswerControl` bodies (one per task), composed components, the proof components, the gallery completion and static screens, and last the three optional items.

**This spec is implemented by Claude Code, not Kiro.** Kiro wrote the spec and creates no files under `packages/ui` or `apps/`. Every task below is addressed to Claude Code. Each task is small enough to build, screenshot and close on its own. Do the tasks one at a time, in order.

The design lists no items for the Kiro lane, so this plan has no handoff section. The one cross-lane rule is in the working rules: `packages/engine/src/types.ts` does not change without both lanes' consent.

## Working rules for every task

- Run every command under Node 22 (`.nvmrc`). Before the first command in a session, run `nvm use` (or an equivalent) and confirm `node -v` prints `v22.x`.
- Never use watch mode or any long-running process. Run tests with `pnpm vitest run <path>`, `pnpm test:props`, `pnpm e2e` or `pnpm check`. Ask the human to start a dev server if you need one for screenshots, or use `vite build` plus `vite preview` in a background process you stop afterwards.
- Tasks run one at a time, in the order listed. Do not start a task while another is in progress.
- **Dependencies.** Task 1.1 picks exact versions with `context7` for the approved list in requirement 29.4 and nothing else. Pin every dependency to an exact version: no `^`, no `~`. If any task needs a package outside that list, **stop and ask the human before adding it**. This includes an icon package, jsdom, Testing Library, Lighthouse and any CSS-in-JS library, all of which are refused (requirements 29.6, 29.8).
- **Lanes.** Stay in `packages/ui`, `apps/site`, `e2e` and the root configuration files you need. Do not touch `.kiro/**` or `apps/*/kb`. Do not edit `packages/engine/src/types.ts`. If a task seems to need a contract change, stop and seek consent from both lanes (requirement 30.6). Where the contract lacks a value, take it as a prop, as the design says.
- **Engine imports.** Import from `@dead-certain/engine/types` with `import type` only. No value import from `@dead-certain/engine` anywhere under `packages/ui/src` outside test files (requirement 5.1, 5.2).
- **Refusals (never build these).** No global dark mode and no `prefers-color-scheme: dark`. No uppercase labels or `text-transform: uppercase`. No `box-shadow` other than `none`. No `linear-gradient`, `radial-gradient` or `conic-gradient`. No scroll-triggered entrance animation. No arrow or chevron glyphs in button labels. No `dangerouslySetInnerHTML`. No `localStorage`, cookies, analytics or network request. No emoji. No exclamation marks. No humor except the AppShell footer. No `hairline` on text or control borders. No `wax` as text colour.
- **Copy.** Sentence case, active voice, plain words, no apology. Use the exact strings quoted in the requirements.
- **Styling.** Tailwind utilities over the token custom properties. Take colour, size, radius and spacing from `tokens.css` only. No hex value outside `tokens.css`.
- **Motion.** Import `motion` in `XrayStage.tsx` only, through `LazyMotion` with `domAnimation` and `m`. Every other transition is CSS and uses the motion tokens.
- **Radix.** Import per package: `@radix-ui/react-radio-group`, `@radix-ui/react-collapsible`, `@radix-ui/react-dialog`.
- **Fixtures.** Add a fixture in the task that first needs it. Extend `packages/ui/src/fixtures.ts`; never replace the existing exports. Annotate every export with a contract type. Amounts are integer minor units, and claimed minus deductions equals payable.
- **Tests.** Pure logic is tested in Vitest with no DOM. Component behaviour is tested in Playwright against the gallery. No jsdom, no Testing Library, no pixel comparison, no committed baselines, no Lighthouse. Every property test file ends in `.props.test.ts`, uses fast-check `4.10.2`, runs each property at least 100 times (`{ numRuns: 100 }` or more) and starts each property with a comment `// Feature: ui-kit, Property N: <title>`.
- **Interactive states.** Hover, pressed and focus are checked by Playwright acting on the real control. Render no forced-state markup and no `:hover` snapshot class (requirement 6.8).
- **Gallery.** Every component task adds its section and its specimens to the gallery in the same task, using the id form `data-specimen="<component>-<state>"`. Each specimen is a `<figure>` with a System-voice heading, the live component and a one-line note.
- **Task_Evidence (every task ends with it, requirement 28.8).** Before you tick a task, produce all four:
  1. Screenshots at **390, 768 and 1280 px** of what the task built, taken from the Playwright projects. Attach them to the pull request. Do **not** commit them. For a task with no visible output (pure logic, scripts), attach the unchanged `/kit` page at the three widths to show nothing regressed.
  2. A **clean browser console read**: zero `error` and zero `warning` messages, enforced by the Playwright console gate.
  3. A **zero-violation axe result** on the gallery page, or on the specimens the task added.
  4. The output of `pnpm check`, exiting with 0.
- A task is done when its Task_Evidence is attached, `pnpm check` exits with 0, and the task is ticked in this file. Do not edit `requirements.md` or `design.md`.

## Tasks

- [ ] 1. Dependencies and site wiring
  - [ ] 1.1 Pick and pin the approved dependencies
    - Use `context7` to choose the current stable exact version of each package: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `tailwindcss` (v4, CSS-first `@theme`), `@tailwindcss/vite`, `@vitejs/plugin-react`, `@radix-ui/react-radio-group`, `@radix-ui/react-collapsible`, `@radix-ui/react-dialog`, `motion`, `@fontsource/ibm-plex-serif`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` and `@axe-core/playwright`. `fast-check` is `4.10.2`. `axe-core` is already in the stack.
    - Add them to the right `package.json` (`packages/ui`, `apps/site`, root or `e2e` for the axe adapter) with exact versions and no range specifiers. Keep `@dead-certain/engine` as `workspace:*` in `packages/ui`.
    - Record each chosen version, and the `context7` source, in the pull request description. Report the `pnpm-lock.yaml` change.
    - Add nothing else. If anything outside the list is needed, ask the human first.
    - Add a Vitest test `packages/ui/src/deps.test.ts` that fails if any `dependencies` or `devDependencies` entry in `packages/ui/package.json` or `apps/site/package.json` starts with `^` or `~` or is `latest`.
    - Run `pnpm install` under Node 22, then `pnpm check`.
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7, 29.8_

  - [ ] 1.2 Give `apps/site` React, Tailwind and the `/kit` entry
    - Add `@vitejs/plugin-react` and `@tailwindcss/vite` to `apps/site/vite.config.ts`, keep `base: "/dead-certain/"`, and add a Vite multi-page input so the build emits `index.html` and `kit/index.html`.
    - Create `apps/site/kit/index.html` and `apps/site/src/kit/main.tsx` that render an empty gallery shell: a page heading, a skip link and an empty `<main id="content">`. Leave `apps/site/index.html` and `src/placeholder.css` untouched.
    - Confirm `pnpm build` emits `/dead-certain/kit/` and that the placeholder at `/` is unchanged.
    - Close with Task_Evidence (the empty shell).
    - _Requirements: 24.1, 24.8, 29.1_

- [ ] 2. Design tokens and the test harness
  - [ ] 2.1 Write `tokens.css` and `styles.css`
    - Create `packages/ui/tokens.css` with every token from the design's "Design tokens" section and the steering file: colours, spacing (`--space-1` to `--space-24`), radii, layout, motion, type, breakpoint notes, `color-scheme: light`, the Paper surface defaults, the `[data-surface="film"]` overrides and the `:focus-visible` rule.
    - Under `@media (prefers-reduced-motion: reduce)` set `--dur-panel` to `0ms`.
    - Create `packages/ui/styles.css` that imports `fonts.css` (empty placeholder for now), `tokens.css` and `theme.css` (empty placeholder) in order. Add the `exports` entries `.`, `./fixtures`, `./styles.css` and `./tokens.css` to `packages/ui/package.json`, and create `src/index.ts` with an empty export.
    - Copy values from `.kiro/steering/design-system.md`. Do not re-derive them.
    - Close with Task_Evidence (the shell now loading `styles.css`).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.13, 27.1, 27.3_

  - [ ] 2.2 Write `theme.css` (Tailwind mapping), `.figures` and forced colors
    - Map tokens into the Tailwind `@theme`. Remove the default palette and off-scale spacing so a hardcoded colour or an off-scale spacing class does not compile. Spacing keys match the token suffixes (`p-4` is 16 px).
    - Add the `.figures` utility (`font-variant-numeric: tabular-nums lining-nums`).
    - Add the `@media (forced-colors: active)` block: borders and icons use `currentColor` or system colours, and focus stays an `outline`.
    - Import `theme.css` from `styles.css`.
    - Close with Task_Evidence.
    - _Requirements: 1.11, 1.12, 1.14_

  - [ ] 2.3 Write the contrast test and the token-usage tests
    - Create `packages/ui/src/tokens.contrast.test.ts`. Parse `tokens.css`, implement `luminance` and `contrast` as in the design, and assert every pair in the contrast table meets its floor (4.5 for text, 3 for focus rings and control boundaries). Assert `hairline` on `paper` is the one pair with no floor.
    - Add a source scan test that fails if `--hairline` is used for `color`, for a control's border, or inside a component's text classes, and if `--wax` is used as a `color` value outside `<mark>`-style fills. Scan `packages/ui/**/*.css` and `packages/ui/src/**/*.tsx`.
    - **Property 11: Contrast floor**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - Close with Task_Evidence.

  - [ ] 2.4 Write the refused-pattern CSS scan
    - Create `packages/ui/src/refusals.test.ts` that builds the site with Vite (or reads the build output) and scans the Built_CSS for: any `box-shadow` other than `none`, `linear-gradient`, `radial-gradient`, `conic-gradient`, `text-transform: uppercase`, `prefers-color-scheme: dark` and `https://`.
    - Add a source scan that fails on `dangerouslySetInnerHTML`, `localStorage`, `document.cookie` and `fetch(` under `packages/ui/src` (test files excepted).
    - This test gains its font and gradient coverage as later tasks add CSS. It must pass now on tokens alone.
    - **Property 12: No refused patterns** (CSS part; the button-label part lands in task 5.2)
    - **Validates: Requirements 2.5, 2.6, 2.7, 2.8, 2.9, 5.9, 5.10**
    - Close with Task_Evidence.

  - [ ] 2.5 Add the three-width Playwright projects, the console gate and the axe helper
    - Extend the existing Playwright config with projects at **390**, **768** and **1280** px and a fourth project with `reducedMotion: "reduce"` at 1280 px. Point `webServer` or `baseURL` at the built site (`/dead-certain/kit/`); do not leave a watcher running.
    - Create `e2e/kit.spec.ts` with a shared fixture that fails any test on a browser `console` message of type `error` or `warning`, and an `expectNoAxeViolations(page, scope?)` helper using `@axe-core/playwright`.
    - Add a first test that opens `/dead-certain/kit/`, passes the console gate and axe, and takes a screenshot saved under `test-results/` (git-ignored by Playwright's output folder, never committed). Add no `toHaveScreenshot` call and no baseline folder.
    - Close with Task_Evidence.
    - _Requirements: 28.3, 28.4, 28.5, 28.6, 28.9, 28.10, 28.13_

  - [ ] 2.6 Add the token section to the gallery
    - Add a "Tokens" section: colour swatches with their contrast ratios (computed by the same `contrast` function, imported from a small `packages/ui/src/tokens/contrast.ts` shared with the test in task 2.3), all seven type styles, the spacing scale, the three radii and the motion durations (a small control that replays a 120, 200 and 500 ms transition; under reduced motion it shows the 0 ms and 120 ms values as text).
    - Add the table of contents with skip link and the first specimen ids (`tokens-colour`, `tokens-type`, `tokens-spacing`, `tokens-radius`, `tokens-motion`).
    - Add Playwright checks: every specimen exists, `#tokens-type` deep link scrolls it into view, and Paper specimens sit on `--lightbox`.
    - Close with Task_Evidence.
    - _Requirements: 24.2, 24.3, 24.4, 24.5, 24.7_

- [ ] 3. Fonts
  - [ ] 3.1 Write `fonts.css` and verify the rupee glyph
    - Create `packages/ui/fonts.css` importing the per-weight `latin` CSS files only: Serif 400 and 600, Sans 400 and 600, Mono 400. Wire the three families into `--font-doc`, `--font-sys` and `--font-mono` with plain system-font fallbacks. Import `fonts.css` first in `styles.css`.
    - Check that U+20B9 renders from the `latin` subset (inspect the font files with a small Vitest test or a Playwright glyph check). If a face lacks it, also import that face's `latin-ext` subset and note it in a comment.
    - Document the `<link rel="preload">` tags for Sans 400, Sans 600 and Serif 600 in the package README section or a comment in `fonts.css`, and add them to `apps/site/kit/index.html`.
    - Extend the refusals test: the Built_CSS references font files by relative path only, with no third-party origin.
    - Apply the voice assignments in the gallery shell: Document for clause text and verdict statements, System for questions and controls, Machine for rule ids and paths.
    - Close with Task_Evidence.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 31.2_

- [ ] 4. Format and pure logic (no UI)
  - [ ] 4.1 Implement `format/money.ts`, `format/label.ts` and `format/value.ts`
    - `money.ts`: `formatMoney(minor, currency, locale?)`, `parseMoney(text, currency, locale)` (string concatenation, no float multiply) and the helpers `minorDigits` and `defaultLocale` exactly as in the design's pseudocode. `FormatContext` type lives in `src/types.ts`.
    - `label.ts`: `humanize(fact)` copying the engine rule (underscores to spaces, first letter capitalised).
    - `value.ts`: `formatDate(iso, locale = "en-IN")`, implemented here so `formatValue` compiles: build the `Date` from `${iso}T00:00:00Z` and format with `timeZone: "UTC"`. Task 4.4 tests it.
    - `value.ts`: `formatValue(def, value, format)` for money, number, boolean, enum (via `humanize`) and date (calls `formatDate`), and "Not known yet" for `undefined`.
    - Write `format.test.ts`: `₹1,42,500` under `en-IN`; whole amounts omit fraction digits and others print them; the three failure reasons `empty`, `format` and `decimals`; an unsafe integer fails with `format`; `humanize` examples; `because` text is passed through untouched.
    - Close with Task_Evidence.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.11, 4.12, 4.13, 4.14, 4.15_

  - [ ] 4.2 Write the money property tests
    - File `format.props.test.ts`.
    - **Property 1: Money round trip** (INR, USD, JPY, every non-negative safe integer)
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.8**
    - **Property 2: Parse never invents precision** (arbitrary strings; success implies a safe integer and no excess fraction digits in `formatMoney(minor, c)`)
    - **Validates: Requirements 4.3, 4.6, 4.7, 4.9**
    - Close with Task_Evidence.

  - [ ] 4.3 Implement `reformatMoneyInput` and its property test
    - Add `reformatMoneyInput(raw, caret, locale)` to `format/money.ts` with the helpers `countDigits`, `stripGroupSeparators`, `splitAtFirstDecimal`, `groupInteger` and `indexAfterNDigits`, as in the design.
    - Add unit tests for typing in the middle of a number, typing a decimal point, and deleting a separator.
    - **Property 3: Reformat keeps the digits** (the output's digits and decimal point equal the input's, and the caret follows the same count of digits)
    - **Validates: Requirements 4.10**
    - Close with Task_Evidence.

  - [ ] 4.4 Test `formatDate` and add the UTC source scan
    - `formatDate` is implemented in task 4.1. This task adds its tests only.
    - Write `format.date.test.ts`. It is a **plain unit test, not a property test**: for a fixed set of ISO dates including month ends, year ends and a leap day, assert the printed calendar day matches the ISO string. Do not re-run the file under other time zones and do not spawn a child process.
    - Add a source scan that fails if `packages/ui/src/format/**` contains `new Date(` with more than one argument, `new Date(iso)` without `Z`, `getDate`, `getMonth`, `getFullYear` or `getHours`.
    - **Property 4: Date formatting never uses local time** (unit test plus source scan, as the design specifies)
    - **Validates: Requirements 4.11, 4.12, 4.13**
    - Close with Task_Evidence.

  - [ ] 4.5 Implement `verdictState.ts` and its property test
    - Create `GOAL_TO_STATE` and `verdictStateFrom(goal, needed)` exactly as in the design. The mapping table is the only place the vocabulary lives. Export `VerdictState` from `src/types.ts`.
    - Write `verdictState.test.ts` for the five known goals and for `undefined`, an unknown string, a number and a boolean.
    - **Property 8: Verdict state is total** (every `FactValue | undefined`, every `needed >= 0`, never throws, always a member of `VerdictState`)
    - **Validates: Requirements 13.11, 13.12**
    - Close with Task_Evidence.

  - [ ] 4.6 Implement the proof-tree reducer and its property tests
    - Create `components/proofTreeState.ts` with `Key`, `TreeState`, `visibleIds`, `nodeAt`, `parentId`, `treeReduce`, `toggleNode` (a pointer toggle: make the node active, then apply the Enter transition) and the immutable set helpers `withId`, `withoutId`, `withoutBranch` (closes an id and every descendant id) and `toggled` (uses `withoutBranch` when it closes). Node ids are index paths (`"0.1.0"`). Export `initialTreeState(root)`, which opens the root and its direct children and puts `active` on the root, and `normalizeTreeState(root, state)`, which drops ids that name no node, drops expanded ids that name a leaf, opens the ancestors of every open node and of the active node, and falls back to the root (`"0"`) when `active` is missing or unknown. `treeReduce` returns the normalised state without applying the key when its input is stale, and reuses a valid input as is.
    - Add fixtures `deepProofFixture` (4 levels, one fact under two rules) and `hugeProofFixture` (200 nodes), annotated with `ProofNode`.
    - Write `proofTreeState.test.ts` for each key at the edges: Down at the last node, Up at the first, Right on a leaf, Left on the root, Enter on a leaf. Add tests for `normalizeTreeState` (unknown ids, expanded leaves, ancestors opened, missing or unknown `active` falls back to `"0"`, no default root-and-children expansion on a supplied state) and for branch collapse (Left and Enter closing remove the id and every descendant id).
    - **Property 5: Tree reducer stays on screen** (from arbitrary states mixing keys with `toggleNode` pointer toggles, the result's `active` is in `visibleIds`, no leaf is ever in `expanded`, and every ancestor of an expanded id is expanded)
    - **Validates: Requirements 18.7, 18.8, 18.9, 18.10, 18.11, 18.15, 18.23**
    - **Property 6: Tree reducer is pure** (the input state is unchanged, deep-frozen in the test)
    - **Validates: Requirements 18.16**
    - **Property 7: Tree ids are unique** (everything expanded, including a fact under two rules)
    - **Validates: Requirements 18.13**
- **Property 18: Normalisation is valid and idempotent** (from arbitrary states mixing keys with `toggleNode` pointer toggles, `normalizeTreeState` returns an `active` that names a node, expanded ids that name nodes with children, every ancestor of an expanded id and of `active` expanded, and normalising twice equals normalising once)
    - **Validates: Requirements 18.14, 18.23**
    - Generate random `ProofNode` trees with a fast-check arbitrary kept in `src/testkit/proofArb.ts` (test-only, never exported from `index.ts`). The arbitrary-state generator `rawStateArb` lives in `packages/ui/src/proofTreeState.props.test.ts`, not in `proofArb.ts`.
    - Close with Task_Evidence.

  - [ ] 4.7 Implement `partitionBar` and its property test
    - Create `components/partitionBar.ts`: `partitionBar(total, parts)` returns clamped integer parts and the remainder, clamping negative or non-integer values to 0 and clamping the sum to `total` with no remainder when parts exceed it.
    - Write unit tests for all paid, one cut, many cuts, all cut, zero parts, over-sum and negative parts.
    - **Property 9: Bar parts never exceed the bar** (for every `total > 0` and part list, the flex-grow values including the remainder sum to `total` and none is negative)
    - **Validates: Requirements 14.1, 14.6, 14.7, 14.9**
    - Close with Task_Evidence.

  - [ ] 4.8 Add the contract and import-boundary tests
    - Create `packages/ui/src/contract.test.ts` using `expectTypeOf`: `ReplayFailure extends ErrorCode` (the one allowed type-only import from `@dead-certain/engine`). Add one `expectTypeOf` line per component prop in the task that builds that component; this task creates the file and the first assertion.
    - Create `packages/ui/src/boundary.test.ts`: scan every non-test file under `packages/ui/src` and fail on any value import from `@dead-certain/engine` (only `import type` from `@dead-certain/engine/types` is allowed), on any import of `motion` outside `components/XrayStage.tsx`, and on any `dangerouslySetInnerHTML`.
    - State in the pull request description that packages/engine/src/types.ts is unchanged by the ui-kit lane.
    - **Property 13: No runtime engine import**
    - **Validates: Requirements 5.1, 5.2, 5.5, 5.6, 20.10, 29.9**
    - Close with Task_Evidence.

- [ ] 5. Primitives
  - [ ] 5.1 Add the accessibility helpers and the icon set
    - `a11y/LiveRegion.tsx` (one polite `aria-live` region and a context with `useAnnounce()`), `a11y/useFocusOnMount.ts` (focus a heading when it mounts or when a key changes) and `a11y/useReducedMotion.ts`.
    - `icons/`: `CheckCircle`, `MinusCircle`, `CrossCircle`, `QuestionCircle`, `InfoCircle`, `Chevron`, `Close`, `Menu`. Inline SVG, 24 px grid, 2 px stroke, `currentColor`, `aria-hidden="true"`. No icon package.
    - Add a small gallery section "Icons" showing the eight at 24 px on Paper and Film (`icons-paper`, `icons-film`).
    - Playwright: every icon has `aria-hidden="true"`; the live region exists once; announcing a message updates its text.
    - Close with Task_Evidence.
    - _Requirements: 26.5, 26.7, 26.8, 21.5_

  - [ ] 5.2 Build `Button`
    - Implement the three variants, the Paper and Film colours, 44 by 44 px target, 6 px radius, 120 ms colour change on press, `aria-disabled` that stays in the tab order, and the focus ring. A disabled button shows its reason in nearby text; the gallery specimen includes that text.
    - Gallery specimens: primary, secondary and quiet, each default and disabled, on Paper and Film (12 specimens).
    - Playwright: hover, press and focus the real control and assert the computed colour or outline; assert each button is at least 44 by 44 px; assert no rendered label matches `/[→←↑↓➜»«]/u`; assert a disabled button is still reachable by Tab.
    - Extend the refusals test with the button-label scan on the built gallery page. Add the `expectTypeOf` line for `ButtonProps` to `contract.test.ts`.
    - **Property 12: No refused patterns** (button-label part)
    - **Validates: Requirements 2.11, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**
    - Close with Task_Evidence.

  - [ ] 5.3 Build `Disclosure`
    - Wrap `@radix-ui/react-collapsible`. Trigger is a real button with `aria-expanded` and `aria-controls`; 200 ms height transition (instant when `prefers-reduced-motion: reduce`); Escape inside the panel closes it and returns focus to the trigger; the chevron icon is hidden from assistive technology and swaps glyph for open and closed; controlled and uncontrolled use.
    - Gallery specimens: closed, open, nested in Film.
    - Playwright: toggle by click and by Enter and Space; Escape returns focus to the trigger; under the reduced-motion project the panel changes instantly (computed `transition-duration` is `0s`).
    - Add the `expectTypeOf` line for `DisclosureProps`.
    - Close with Task_Evidence.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 27.3_

  - [ ] 5.4 Build `SourceBadge`
    - Three sources with their words and markers: "You answered" (filled square), "Collected" (ring), "Worked out" (diamond). Text in `--text-soft`, marker `aria-hidden`.
    - Gallery specimens: the three sources on Paper and on Film (6 specimens).
    - Playwright: each badge contains its word; each has a marker element with `aria-hidden`.
    - Add the `expectTypeOf` line for `SourceBadgeProps`.
    - Close with Task_Evidence.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 5.5 Build `ClauseQuote`
    - `<blockquote>` with a System-voice heading line (clause id and title) and Document-voice body at 17/28. `plain` has a 2 px `--divider` left rule, `deciding` a 2 px `--wax` rule. A `mark` substring renders in a `<mark>` (wax fill, `ink` text on Paper, `film` text on Film); a missing `mark` highlights nothing. When the app passes only a clause id with no `Clause`, show the id as plain text without a quote (put this in a small `ClauseRef` helper used by later components).
    - Add `clauseFixtures` (clauses 4.2, 6.1, 1.2, 2.2 with short sample text, marked "sample" in a comment) and add the matching `fixtures.test.ts` check that every `LineItem.clause` in the verdict fixtures has a `Clause` fixture.
    - Gallery specimens: plain, deciding without mark, deciding with mark, mark not found, long text, on Paper and on Film.
    - Playwright: one `<mark>` exists only in the `mark` specimens; the `deciding` rule colour is wax.
    - Add the `expectTypeOf` line for `ClauseQuoteProps`.
    - Close with Task_Evidence.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 23.1, 23.7_

  - [ ] 5.6 Build `Sheet` and `Film`
    - `Sheet`: paper fill, 1 px hairline border, 4 px radius, 16 px padding below 768 and 24 px from 768, `max-width: var(--column-max)`, `data-surface="paper"`, no shadow.
    - `Film`: film fill, no border, 8 px radius, `data-surface="film"`, heading with `tabindex="-1"` and a Close button. An optional `headingRef?: RefObject<HTMLHeadingElement | null>` prop attaches to the heading so a parent can focus the title. The panel and the scrim carry `print:hidden`. `presentation: "side"` renders a non-modal `<section aria-labelledby>`. `presentation: "sheet"` renders a Radix Dialog anchored to the bottom (focus trapped, Escape closes, 85 vh maximum, inner scroll, flat scrim at fixed opacity). The same inner children render in both so they are not remounted.
    - Gallery specimens: `sheet-paper`, `film-side`, `film-sheet`.
    - Playwright: the sheet is at most 680 px wide; the film dialog traps focus and Escape closes it; a content node marked with a counter keeps its identity when `presentation` flips (resize 1279 to 1280); `headingRef` points at the heading; the panel and the scrim have `print:hidden`.
    - Add the `expectTypeOf` lines for `SheetProps` and `FilmProps`.
    - Close with Task_Evidence.
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9_

- [ ] 6. AnswerControl, one control type per task
  - [ ] 6.1 Build the `AnswerControl` shell and the boolean body
    - Create `AnswerControl.tsx` with the full props from the design and a switch on `def.type`. Implement the `boolean` body: two large radio buttons "Yes" and "No" in a Radix RadioGroup styled as buttons, emitting `true` or `false`. Add the shared error element: `aria-invalid="true"`, `aria-describedby`, text under the field. Other types render a "not built yet" placeholder that throws nothing and is replaced in tasks 6.2 to 6.5.
    - Shortcuts `1` and `2` select Yes and No only while focus is on the radio group. Label the group with `aria-labelledby={labelledBy}`. States: empty, filled, focused, invalid, disabled.
    - Add `factDefFixtures` (all five types plus the check facts) and the first `questionFixtures`.
    - Gallery specimens: `answercontrol-boolean-empty`, `-filled`, `-invalid`, `-disabled`.
    - Playwright: arrow keys move; `1` and `2` select; the error is linked by `aria-describedby`; message is "Choose one answer."
    - Add the `expectTypeOf` line for `AnswerControlProps`.
    - Close with Task_Evidence.
    - _Requirements: 10.1, 10.6, 10.10, 10.11, 10.12, 10.23, 10.24_

  - [ ] 6.2 Add the enum body
    - One radio card per `def.options` entry, labelled `humanize(option)`, emitting the option string. Keys `1` to `9` select the first nine; the tenth and later options are reachable by arrow keys and click only.
    - Gallery specimens: enum with 2, 6 and 10 options; filled; invalid; disabled.
    - Playwright: digit shortcuts work on the group; with 10 options the key `0` and any further digit do nothing; arrows reach the tenth.
    - Close with Task_Evidence.
    - _Requirements: 10.2, 10.7, 10.12, 10.23_

  - [ ] 6.3 Add the money body
    - Text input with a visible currency unit prefix (from `Intl.NumberFormat(...).formatToParts`) that is part of the accessible name; regroup digits as you type through `reformatMoneyInput` and keep the caret; emit integer minor units through `parseMoney`; Enter calls `onEnter`; digit keys are always text here. Zero is valid and emits `0` when `min` is absent. With `min`: "Enter an amount above zero." when `min` is 1, otherwise "Enter an amount of at least ₹500." with `min` formatted. There is no `allowZero` prop.
    - Messages: "Enter an amount.", "Use digits only, with an optional decimal point.", "Use at most 2 decimal places." (the number from the currency).
    - Gallery specimens: empty, typing, filled, zero, invalid (each of the three messages), below `min` (both messages), disabled.
    - Playwright: typing `142500` shows `1,42,500` and the caret stays after the typed digits when editing the middle; zero is accepted; digit keys type text; Enter fires `onEnter`.
    - Close with Task_Evidence.
    - _Requirements: 10.3, 10.8, 10.9, 10.12, 10.13, 10.14, 10.15, 10.16, 10.17, 10.18, 10.19, 10.20, 10.24_

  - [ ] 6.4 Add the number body
    - Text input with `inputmode="decimal"`, optional `unit` suffix as visible text, emitting a `number`; Enter calls `onEnter`; digit keys are text. Empty or non-numeric shows "Enter a number."
    - Gallery specimens: with a unit ("days"), without a unit, typing, invalid, disabled.
    - Playwright: `inputmode` is `decimal`; the unit is visible text; the error message and `aria-invalid` appear.
    - Close with Task_Evidence.
    - _Requirements: 10.4, 10.8, 10.9, 10.12, 10.21_

  - [ ] 6.5 Add the date body
    - Native `<input type="date">` emitting an ISO `YYYY-MM-DD` string; Enter calls `onEnter`. Empty shows "Pick a date." Use `formatDate` for any text display of the value.
    - Gallery specimens: empty, filled, invalid, disabled.
    - Playwright: fill a date and read the emitted ISO string; the error is linked by `aria-describedby`.
    - Close with Task_Evidence.
    - _Requirements: 10.5, 10.9, 10.12, 10.22_

- [ ] 7. Composed components
  - [ ] 7.1 Build `QuestionCard`
    - Order: heading (`<h2 tabindex="-1">`, 24/32, 21/28 below 768), progress line **below** the heading tied by `aria-describedby`, `AnswerControl`, error, a `Disclosure` titled "Why this question?" with `question.why` and a plain `ClauseQuote`, then Back (omitted without `onBack`) and Continue (never disabled).
    - Focus the heading on mount and when `question.fact` changes (`useFocusOnMount`) and announce the progress line ("Question 3. Up to 6 more.", "Last question."). Enter in a text-like field or on the heading validates; invalid shows the message, sets `aria-invalid` and moves focus to the field; valid calls `onSubmit(fact, value)` once. `externalError` shows as the field error; editing clears the error; Escape closes an open Disclosure. Omit the parts of the Disclosure that have no `why` or no `clause`.
    - Gallery specimens: each control type, with and without why and clause, invalid, first question, last question.
    - Playwright: heading is focused on mount; the progress line sits below the heading in DOM and layout order; `onSubmit` fires once on Enter; Continue is enabled when empty.
    - Add `questionFixtures` for all five types and the `expectTypeOf` line for `QuestionCardProps`.
    - Close with Task_Evidence.
    - _Requirements: 2.12, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.14_

  - [ ] 7.2 Build `AnswersRail`
    - Each answer is a `<button>` showing label and display value, with the accessible name "Change <label>, currently <value>". `current` sets `aria-current`. `skipped` notes render as plain lines and are announced once. Empty shows "No answers yet." No loading indicator.
    - Layout: from 1024 px a 240 px `<aside aria-label="Your answers">`; below 1024 px, and while the Film is open side by side, a `Disclosure` titled "Your answers (N)".
    - Add `answersFixture` and `skippedFixture`.
    - Gallery specimens: empty, three answers, current, with skipped notes, collapsed (phone), rail (desktop).
    - Playwright: accessible names; the rail appears as an aside at 1280 and as a disclosure at 390 and 768.
    - Add the `expectTypeOf` line for `AnswersRailProps`.
    - Close with Task_Evidence.
    - _Requirements: 5.8, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

  - [ ] 7.3 Build `VerdictHeadline`
    - One heading holding the state line (icon plus word) and the statement; accessible text reads the word, a full stop, then the statement. Six states with their words, icons and colours. `size` verdict (48/56, 36/44 on phones) or summary (36/44). Amounts use `.figures`. The icon is `aria-hidden`. Focus goes to the heading when a verdict appears, with a live-region announcement.
    - Add `undecidedVerdictFixture`, `paidInFullVerdictFixture` and `deniedVerdictFixture`, each with arithmetic that adds up.
    - Gallery specimens: six states by two sizes.
    - Playwright: the heading's text content for each state; the icon carries `aria-hidden`; the heading is focusable and gets focus when mounted by the specimen.
    - **Property 10: Colour is never the only signal** (verdict part: for each `VerdictState`, the rendered output contains the word and an icon element)
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.13, 26.6, 26.9**
    - Add the `expectTypeOf` line for `VerdictHeadlineProps`.
    - Close with Task_Evidence.

  - [ ] 7.4 Build `ProportionBar`
    - Use `partitionBar` from task 4.7. Flex items sized by `flex-grow` equal to the integer value, a remainder item, 2 px minimum width for non-zero parts, solid `--paid` for paid and `--reduced` with an SVG `<pattern>` hatch for cuts, 2 px `--paper` gaps, no CSS gradient, `role="img"` with an `aria-label` reading every part in words and amounts.
    - Gallery specimens: all paid, one cut, many cuts, all cut, zero parts.
    - Playwright: the `aria-label` text for each specimen; computed `flex-grow` values sum to `total`; the Built_CSS scan still passes.
    - Add the `expectTypeOf` line for `ProportionBarProps`.
    - Close with Task_Evidence.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.8_

  - [ ] 7.5 Build `Ledger`
    - A semantic `<table>` with a visually hidden caption "Claim ledger" and `<th scope="row">` headers. Columns: label (`LineItem.label` verbatim), clause (Machine voice) and amount (right aligned, `.figures`, never wraps). Deductions print with U+2212 as "− ₹38,000". Each item row has a row-sized button with the accessible name "Room rent above the limit, clause 4.2, minus ₹38,000. See why"; `selectedFact` sets `aria-current="true"`; `onOpen(item, element)` passes the row's button so the app can use it (`XrayStage` does not take it). The claimed and payable rows are plain text with a hairline rule above the total. Zero-value deductions are omitted; an `undefined` value prints "Not known yet" and stays openable; labels wrap down to 320 px.
    - Add `manyDeductionsFixture` (30 lines), `unknownLineWithKnownPayableFixture` and `zeroDeductionFixture`. `unknownLineWithKnownPayableFixture` is deliberately not engine-faithful (an unknown deduction beside a known payable), carries a comment that says why, and is exempt by name in `fixtures.test.ts` (constant `NOT_ENGINE_FAITHFUL`). Extend `fixtures.test.ts` to assert claimed minus deductions equals payable for every verdict fixture not named in `NOT_ENGINE_FAITHFUL`.
    - Gallery specimens: normal, no deductions, zero deduction, unknown value, 30 rows, selected row, 320 px wrap.
    - Playwright: the accessible name format; amounts never wrap at 320 px; no horizontal scroll.
    - **Property 14: Ledger arithmetic is displayed, not computed** (fixtures test over every verdict fixture not named in `NOT_ENGINE_FAITHFUL`, plus a Playwright check that each rendered amount equals `formatMoney` of the fixture value)
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11, 15.12, 15.13, 23.5**
    - Add the `expectTypeOf` line for `LedgerProps`.
    - Close with Task_Evidence.

  - [ ] 7.6 Build `CheckRow`
    - Pass shows "Passed" with a green check; fail shows "Failed" with a cross; unknown or a non-boolean value shows "Needs your answer" with a question icon. The state word is part of the accessible name. Show `LineItem.label`, the rule id (a button that calls `onOpen(item, element)`), and the optional `detail` line in the Machine voice. While unknown, `question` is supplied and `def.type === "boolean"` (`def` describes `question.fact`, the input the engine asks for, not `item.fact`, which is derived and never asked directly), show `question.text` and an inline boolean `AnswerControl`; answering calls `onAnswer(question.fact, value)`. While unknown and the asked fact is not boolean (no `def` counts as not boolean), show only the word "Needs your answer".
    - Add `preFlightAllPassFixture` and `preFlightUnknownFixture`.
    - Gallery specimens: pass, fail, unknown with inline question, unknown non-boolean fact, with evidence, non-boolean value.
    - Playwright: the three words appear; the rule id opens via keyboard; answering the inline question emits once; the unknown non-boolean specimen shows no question text and no radio group.
    - **Property 10: Colour is never the only signal** (check part: each check state has a word and an icon)
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 26.6, 26.9**
    - Add the `expectTypeOf` line for `CheckRowProps`.
    - Close with Task_Evidence.

  - [ ] 7.7 Build `WhatIfList`
    - One plain-text row per `Alternative`: "If <label> were <value>: <delta>", for example "If room rent per day were ₹5,000: + ₹38,000". The row text lives in `components/whatIfText.ts`. With `amountGoal` and both amounts known and different, show the signed delta. With only `stateGoal`, name the state change from the current to the new state. With a zero delta, name the state change when `stateGoal` is supplied and the state changes, else say "the verdict changes". With an unknown amount, print "amount not known yet", followed by the state change when there is one. If `stateGoal` is supplied but the state does not change, say "the verdict changes". With no alternatives render nothing and no heading. No actions.
    - Add `lowerFirst(label)` to `format/label.ts` with a unit test ("Room rent per day" gives "room rent per day"; "ICU days" is unchanged). Labels go through `lowerFirst`. Only boolean values are lowercased mid-sentence (yes/no). Money, number, date and enum values print as formatted.
    - Write `packages/ui/src/whatIfText.test.ts` for yes/no lowercase, enum "MIT" verbatim, zero delta with the same state, and unknown amount.
    - Add `alternativesFixture` and `alternativesNoMoneyFixture`. Do not add a zero-delta or unknown-amount fixture; the edge cases are built inline.
    - Gallery specimens: money, no money, `whatiflist-edges` (builds its alternatives inline), empty.
    - Playwright: text of each row; the edges specimen shows the zero-delta and unknown-amount rows; the empty specimen has no heading element.
    - Add the `expectTypeOf` line for `WhatIfListProps`.
    - Close with Task_Evidence.
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 8. Proof and application frame
  - [x] 8.1 Build `ProofTree` rendering
    - Render `role="tree"` named "Proof", each node `role="treeitem"` with `aria-level`, `aria-setsize` and `aria-posinset`, parents with a true `aria-expanded`, children in `role="group"`, and a roving `tabindex` with exactly one `0`. Joints (derived with a rule) show the rule id in the Machine voice and the `because` sentence as received; bone ends (answered or collected leaves) show label, value and `SourceBadge`. `undefined` prints "Not known yet". Strokes use `--text-soft`. Initial state comes from `initialTreeState`, or, when the `initialState` prop is supplied, from `normalizeTreeState` (read on mount only; the caller remounts with `key={target}`). Memoise rows by index-path id.
    - When `decidingClause` names a clause that `clauseFor` returns and at least one node cites, show one deciding `ClauseQuote` after the tree, in a wrapper beside the `role="tree"` element and never inside a treeitem. It shows once however many nodes cite the clause, and stays visible when their branches are closed.
    - Branch cue: every parent shows a `Chevron` (glyph swap closed/open, no rotation, no animation) in a 44 px pointer toggle that is not a tab stop; closed parents also show an `aria-hidden` "N hidden" count in the Machine voice, where N is the direct children count (`node.children.length`). Leaves show neither. The toggle calls `toggleNode`.
    - Add `collectedProofFixture` and `unknownValueProofFixture`.
    - Gallery specimens (on Film): collapsed, expanded, deep, shared fact, collected, unknown value, deciding clause, 200 nodes. The branch cue shows in the existing `prooftree-collapsed` specimen. `initialState` is exercised in `prooftree-deep` and `prooftree-shared`.
    - Playwright: ARIA attributes on a sample; one `tabindex="0"`; node ids are unique in the 200-node specimen; the pointer toggle is at least 44 by 44 px and is not a tab stop; the "N hidden" count is `aria-hidden` and equals the direct children count; a click on the toggle changes `aria-expanded` and makes that node active; leaves have no toggle and no count.
    - Playwright: with the deciding-clause specimen, exactly one deciding `ClauseQuote` exists, it is outside `role="tree"`, no treeitem contains one even when three nodes cite the clause, and it stays visible after the citing branches are closed; with no `decidingClause`, none shows.
    - Add the `expectTypeOf` line for `ProofTreeProps`.
    - Close with Task_Evidence.
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.13, 18.14, 18.20, 18.21, 18.22, 18.23, 23.8_

  - [ ] 8.2 Add `ProofTree` keyboard handling and node actions
    - Wire keys to `treeReduce`: Down, Up, Right, Left, Home, End and Enter. Escape calls `onEscape`. Focus follows the active node.
    - Render the "Show the rule" `Disclosure` (when `ruleExpression` returns text, shown in the Machine voice) and the "Change this answer" button on answered facts (when `onChangeAnswer` is supplied) only inside the active treeitem. Inactive treeitems render no actions and no `tabindex` toggling; moving the active node unmounts the previous node's actions.
    - The tree ignores arrow keys, Home, End and Enter whose target is inside an action. Escape still calls `onEscape` from anywhere in the tree, including from inside an action.
    - Gallery specimens: keyboard focus on a joint, on a bone end, and with actions visible.
    - Playwright: drive each key and assert the active node and `aria-expanded`; an inactive treeitem has no action elements; Tab from the active node reaches its actions and then leaves the tree; keys from inside an action do not move or toggle; Escape fires `onEscape`, also from inside an action; collapsing closes the whole branch (reopening the parent shows its children closed).
    - Close with Task_Evidence.
    - _Requirements: 18.7, 18.8, 18.9, 18.10, 18.11, 18.12, 18.15, 18.17, 18.18, 18.19, 18.24_

  - [ ] 8.3 Build `XrayStage`
    - Compose `Sheet` and `Film` with the `XrayTarget` union. At 1280 px and up, lay out the Sheet (up to 680 px) beside a `side` Film and collapse the rail; below 1280, a full-width Sheet and a `sheet` Film. On first open run the develop: a 2 px `--film` scan line crossing once over `--dur-xray` with `--ease`, both read from the tokens at run time and not hardcoded (left to right at 1280 and up, top to bottom below). The `clip-path` reveal applies to the proof content; the Film panel itself appears at once, because the bottom sheet is a Radix Dialog in a portal. Use `LazyMotion` with `domAnimation` and `m` components. Under reduced motion render no scan line and fade the Film in over 120 ms. Changing target swaps content at once with no animation.
    - Focus: record `document.activeElement` as the opener when `target` goes from null to set, before Radix moves focus (the stage takes no opener from `onOpen`); on open or target change focus the Film heading and announce the title; on close return focus to the opener one task later, after the bottom sheet's focus trap releases. An opener that unmounted while the stage was open (focus on `<body>`) counts as gone, and focus goes to the Sheet heading. The Film is hidden in `print` media by its own `print:hidden`.
    - Gallery specimens: closed, open side (1280), open sheet (below 1280), reduced motion. Use `claimVerdictFixture` and `proofFixture` with a small stand-in `Sheet`.
    - Playwright: the open-side state is shown and checked by the 1280 project, the open-sheet state by the 390 and 768 projects, and the reduced-motion state by the reduced-motion project. Rail collapse beside the film is covered by the task 7.2 AnswersRail test, not here. Scan line exists at 1280 (default project) and not in the reduced-motion project; the film's only transition under reduced motion is opacity over 120 ms; focus lands on the Film heading; closing returns focus to the opener; closing after removing the opener lands on the sheet heading; resizing across 1280 does not remount the tree.
    - **Property 15: Focus returns**
    - **Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.6, 20.7, 20.8, 20.9, 20.11, 20.12**
    - **Property 16: Reduced motion removes movement**
    - **Validates: Requirements 20.5, 27.2, 27.3, 27.4, 27.5**
    - Add the `expectTypeOf` line for `XrayStageProps`.
    - Close with Task_Evidence.

  - [ ] 8.4 Build `AppShell`
    - Skip link "Skip to the content" as the first focusable element; it moves focus to `<main>` without changing the URL hash. `<header>` with the "Dead Certain" wordmark and navigation (`aria-current` on the current item); `<main id="content" tabindex="-1">`; an optional rail slot that is a plain wrapper, because `AnswersRail` brings its own `<aside aria-label="Your answers">`; `<footer>` that defaults to "No guesses were made in the production of this verdict." Below 768 px navigation sits behind a "Menu" button (Radix Collapsible) that closes on Escape and on navigation. Below 1024 px the rail stacks above the content. Host the single `LiveRegion` and `useAnnounce()`. Add the shared `useMediaQuery` hook in `packages/ui/src/useMediaQuery.ts`.
    - Gallery specimens: add `apps/site/kit/shell.html` (a second Vite entry) that shows the shell on its own page; the gallery embeds it in three iframes: desktop with rail, phone with menu closed, phone with menu open.
    - Playwright: the skip link is the first Tab stop, moves focus to `main` and leaves the URL hash unchanged; Escape closes the menu; the footer text; one live region on the page; the rail stacks above the content below 1024 px; axe runs on `kit/shell.html` on its own at every width.
    - Add the `expectTypeOf` line for `AppShellProps`.
    - Close with Task_Evidence.
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10, 2.14_

  - [ ] 8.5 Build `StaleLinkNotice`
    - A `Record<ReplayFailure, Copy>` with the exact headings and bodies from the design for `KB_MISMATCH`, `MALFORMED_TOKEN` and `UNSUPPORTED_VERSION`. Primary `Button` "Start the check" calls `onStart`; a quiet link "Read the rules" appears only for `KB_MISMATCH` with `rulebookHref`. Info icon in `--text-soft`, no `--denied` colour. The heading takes focus on mount and is announced. It renders as a state inside `<main>`, not a modal and not `role="alert"`, and never prints the engine's message. The root is a plain `<section>` with no accessible name (no `aria-label`, no `aria-labelledby`), so it is not a landmark. The heading is an `h2`.
    - Gallery specimens: the three failures, `KB_MISMATCH` with and without the rulebook link, and a fifth specimen "Appears" (`data-specimen="stalelinknotice-appears"`) for the focus-on-appear test.
    - Playwright: heading text for each failure; heading is focused; no element has `role="alert"` or `role="dialog"`; the section has no accessible name and is not a landmark; the heading is `h2`; focus lands on the heading when the Appears specimen mounts.
    - **Property 17: Stale link exhaustive** (the compile-time `Record<ReplayFailure, Copy>` plus the `ReplayFailure extends ErrorCode` assertion from task 4.8, and a Playwright check over all three failures)
    - **Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.10, 22.11, 22.12, 5.6**
    - Add the `expectTypeOf` line for `StaleLinkNoticeProps`.
    - Close with Task_Evidence.

- [ ] 9. Gallery completion and static screens
  - [x] 9.1 Audit the fixtures
    - Extend `fixtures.test.ts`: every export is annotated with a contract type (a type-level check where possible); every verdict fixture ledger adds up, except fixtures named in `NOT_ENGINE_FAITHFUL`, which carry a comment saying why; every proof node index path is unique; every `LineItem.rule` and `LineItem.clause` used in a verdict fixture appears in a proof or clause fixture where claimed; the 30-line verdict fixture and the 200-node proof fixture exist; all existing exports (`CLAIMED_AMOUNT`, `questionFixture`, `claimVerdictFixture`, `proofFixture`, `preFlightVerdictFixture`) are still present.
    - Add `claimFormat` and any fixture still missing from the design's fixture table.
    - Close with Task_Evidence.
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8_

  - [x] 9.2 Build static screens 1 to 3
    - Under "Screens" in the gallery, each with its own deep link, `kit/screen.html?screen=<name>`, shown in the gallery in an inert iframe (`&preview=1`, where `focus()` is a no-op): Claim Check start, Claim Check question (money) and Claim Check verdict (reduced, with ledger, proportion bar and what-if). Use only Component_Set components and fixtures, wrapped in `AppShell`. No engine import at run time.
    - Playwright: each deep link loads at the three widths with a clean console and zero axe violations; the verdict screen heading is focusable.
    - Close with Task_Evidence (screenshots of all three screens at all three widths).
    - _Requirements: 25.1, 25.2, 25.3, 24.9_

  - [x] 9.3 Build static screens 4 to 6
    - Claim Check verdict with the X-ray open (side panel at 1280, bottom sheet at 390 and 768); Pre-Flight report (not ready, with an inline question, checks grouped by the first number of the clause id with titles from an app-supplied map); stale link (`KB_MISMATCH`).
    - Playwright: the X-ray screen presents `side` at 1280 and `sheet` at 390 and 768; the Pre-Flight groups are in clause-number order; each deep link passes console and axe at the three widths. Add each screen to `SCREENS` in `screen.tsx` and to the gallery's "Screens" section.
    - Close with Task_Evidence (screenshots of all three screens at all three widths).
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_

  - [x] 9.4 Audit the specimen matrix and deep links
    - Add an Playwright test with the design's specimen matrix as data: for every component and state listed, assert a `[data-specimen]` with the matching id exists, contains a heading and a one-line note, and that `#<id>` scrolls it into view. Assert Film specimens are inside a Film and Paper specimens are on `--lightbox`.
    - Fill any missing specimen found by the audit.
    - Close with Task_Evidence.
    - _Requirements: 24.2, 24.3, 24.4, 24.5, 24.6, 24.7_

  - [ ] 9.5 Add the accessibility and responsive sweep
    - A Playwright sweep over the full gallery and each static screen: every interactive element is at least 44 by 44 px (`boundingBox`); no horizontal scroll at 320 px (set the viewport in the test) and at 200 percent zoom; all form fields have a label tied by `aria-labelledby` or `<label>`; axe reports zero violations at 390, 768 and 1280 and in the reduced-motion project.
    - **Property 10: Colour is never the only signal** (source part: every `SourceBadge` has its word and marker, asserted across the gallery)
    - **Validates: Requirements 8.1, 8.2, 8.3, 26.1, 26.2, 26.3, 26.4, 26.6, 26.7, 26.9, 28.6, 28.7**
    - Close with Task_Evidence.

  - [ ] 9.6 Add the bundle-size and final refusal gates
    - Create `packages/ui/scripts/bundle-size.mjs` (or a Vitest test that builds) that gzips the built kit chunks, excludes React and React DOM, and fails when the total exceeds 50 kB. Confirm `motion` only appears in the XrayStage chunk. Wire the check into `pnpm check` or `pnpm build` through an existing script without editing anything unrelated.
    - Re-run the refusals test on the final Built_CSS and add the Playwright check that no animation starts on scroll.
    - **Property 12: No refused patterns** (final full pass)
    - **Validates: Requirements 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.13, 28.11, 28.12, 29.9**
    - Close with Task_Evidence, and include the measured gzipped size in the pull request.

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Confirm every task above is ticked, the pull request lists the pinned versions from task 1.1, and `packages/engine/src/types.ts` is unchanged by the ui-kit lane.

- [ ] 11. Optional items (build last, drop first if time runs short)
  - [ ]* 11.1 Add the fallback font metric faces
    - Define `Plex Sans Fallback`, `Plex Serif Fallback` and `Plex Mono Fallback` in `fonts.css` on local system fonts with `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override`. Measure the overrides (for example with a Playwright script that compares line boxes with the Plex faces) and record the measured values in a code comment. End each font stack with its fallback face.
    - Add a Playwright check that text in the gallery does not shift more than 1 px in line height when the Plex face swaps in.
    - Close with Task_Evidence.
    - _Requirements: 31.1_

  - [ ]* 11.2 Add the print styles
    - Create `packages/ui/print.css` and import it last in `styles.css`. A printed verdict is one page: verdict headline, ledger and clauses; the rail, nav and buttons are hidden. The Film hides itself through `print:hidden`, not through `print.css`.
    - Add a Playwright test using `page.emulateMedia({ media: "print" })` that checks the Film is hidden (by its own `print:hidden`) and the verdict, ledger and clauses are visible. Do not compare pixels.
    - Close with Task_Evidence (screen screenshots at three widths, plus the print-emulated page).
    - _Requirements: 20.12, 31.3_

  - [ ]* 11.3 Measure `ProofTree` key-to-paint time on 200 nodes
    - Add a Playwright test on the 200-node specimen that records a trace around an arrow-key press and checks key press to next paint is under 50 ms. Keep the 200-node specimen in the gallery either way.
    - Close with Task_Evidence, and attach the trace to the pull request, not the repository.
    - _Requirements: 31.4, 31.5_

## Notes

- Claude Code implements every task. Kiro does not execute any of them and creates no file under `packages/ui` or `apps/`.
- Only the three tasks under item 11 are optional, as the user and the design require. Test sub-tasks are not marked optional in this plan, because each task closes with Task_Evidence and `pnpm check`.
- Properties 1, 2, 3, 5, 6, 7, 8, 9 and 18 are fast-check property tests (`*.props.test.ts`). Property 4 is a unit test plus a source scan. Properties 10 to 17 are checked by unit scans, type-level checks and Playwright, as the design's testing strategy says. Each is tied to a task above.
- No visual-regression gate, no pixel baselines, no Lighthouse run and no forced-state markup anywhere in this plan.
- Screenshots go to the pull request and are never committed.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["2.3"] },
    { "id": 5, "tasks": ["2.4"] },
    { "id": 6, "tasks": ["2.5"] },
    { "id": 7, "tasks": ["2.6"] },
    { "id": 8, "tasks": ["3.1"] },
    { "id": 9, "tasks": ["4.1"] },
    { "id": 10, "tasks": ["4.2"] },
    { "id": 11, "tasks": ["4.3"] },
    { "id": 12, "tasks": ["4.4"] },
    { "id": 13, "tasks": ["4.5"] },
    { "id": 14, "tasks": ["4.6"] },
    { "id": 15, "tasks": ["4.7"] },
    { "id": 16, "tasks": ["4.8"] },
    { "id": 17, "tasks": ["5.1"] },
    { "id": 18, "tasks": ["5.2"] },
    { "id": 19, "tasks": ["5.3"] },
    { "id": 20, "tasks": ["5.4"] },
    { "id": 21, "tasks": ["5.5"] },
    { "id": 22, "tasks": ["5.6"] },
    { "id": 23, "tasks": ["6.1"] },
    { "id": 24, "tasks": ["6.2"] },
    { "id": 25, "tasks": ["6.3"] },
    { "id": 26, "tasks": ["6.4"] },
    { "id": 27, "tasks": ["6.5"] },
    { "id": 28, "tasks": ["7.1"] },
    { "id": 29, "tasks": ["7.2"] },
    { "id": 30, "tasks": ["7.3"] },
    { "id": 31, "tasks": ["7.4"] },
    { "id": 32, "tasks": ["7.5"] },
    { "id": 33, "tasks": ["7.6"] },
    { "id": 34, "tasks": ["7.7"] },
    { "id": 35, "tasks": ["8.1"] },
    { "id": 36, "tasks": ["8.2"] },
    { "id": 37, "tasks": ["8.3"] },
    { "id": 38, "tasks": ["8.4"] },
    { "id": 39, "tasks": ["8.5"] },
    { "id": 40, "tasks": ["9.1"] },
    { "id": 41, "tasks": ["9.2"] },
    { "id": 42, "tasks": ["9.3"] },
    { "id": 43, "tasks": ["9.4"] },
    { "id": 44, "tasks": ["9.5"] },
    { "id": 45, "tasks": ["9.6"] },
    { "id": 46, "tasks": ["11.1"] },
    { "id": 47, "tasks": ["11.2"] },
    { "id": 48, "tasks": ["11.3"] }
  ]
}
```
