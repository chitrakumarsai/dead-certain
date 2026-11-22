# Requirements Document

## Introduction

The landing page is the front door of Dead Certain: the root page of `apps/site`, served at `/dead-certain/`. Its hero is a working verdict. A visitor sees a sample hospital claim already decided by the real engine on the real Claim Check knowledge base, and the first thing they can do is press "See why", which develops the verdict into its X-ray. Below the hero, three numbered steps (rulebook, rules, verdict) show the same claim's clause and rule, then the two apps, and the command that scaffolds a third.

The page is a thin composition. It reads the compiled Claim Check knowledge base, runs `@dead-certain/engine` in the browser, and renders with `@dead-certain/ui` components. It decides nothing itself and invents no number: every amount, clause and rule on the page comes from the knowledge base or the engine.

This spec is implemented by the Claude Code lane in `apps/site`, `e2e` and the root configuration it needs. The Kiro lane writes the spec only. It was written Design-First, with the human's brief for Phase 5, the "Site" paragraph and the component list in section 8 of `docs/BUILD_PLAN.md`, `.kiro/steering/design-system.md` and the `ui-kit` spec as input. Requirement numbers are stable so the design's correctness properties can cite them.

Scope: the root page, its hero, the three steps, the two app cards, the scaffold command, the footer, a 404 page, document metadata, the site's build and test changes, and the budgets. Out of scope: any change to `packages/ui`, `packages/engine` or the apps, the `/kit` gallery (left as it is), an editable hero, a blog, analytics, a video embed, and a link preview image.

## Glossary

- **Landing_Page**: The page built from `apps/site/index.html` and served at `/dead-certain/`.
- **Site**: The package `@dead-certain/site` in `apps/site`.
- **UI_Kit**: The package `@dead-certain/ui`.
- **Engine**: The public API of `@dead-certain/engine`. The page uses `audit`, `explain` and `print`.
- **Claim_KB**: The compiled JSON of `apps/claim-check/kb/policy.yaml`, written by `pnpm dc build apps/claim-check` to `apps/claim-check/kb/dist/policy.json`, typed as `KnowledgeBase`.
- **Hero_Claim**: The fixed set of answers the Landing_Page runs: the facts of golden scenario `G-01` in `apps/claim-check/golden/scenarios.yaml`.
- **Hero_Verdict**: The Engine's `audit(Claim_KB, Hero_Claim)`.
- **Hero**: The top section of the Landing_Page: the headline, a short paragraph, and the verdict sheet with its X-ray.
- **Verdict_Sheet**: The paper part of the Hero: `VerdictHeadline`, `ProportionBar`, `Ledger` and the "See why" control.
- **X-ray**: The proof view, opened through `XrayStage`.
- **Steps**: The ordered list of three: the rulebook, the rules, the verdict.
- **App_Cards**: The two entries that name and link Claim Check and Pre-Flight.
- **Scaffold_Command**: The text `pnpm new-app <name>` and its short explanation.
- **Hero_Module**: The code in `apps/site/src/landing/hero/` that names facts and builds the Hero_Verdict's view model. The only place on the Landing_Page that names a fact.
- **Task_Evidence**: Per task: screenshots at 390, 768 and 1280 px, a clean browser console, a zero-violation axe result and `pnpm check` output.
- **Claude_Code_Lane**: The implementing lane for `apps/site` and `e2e`.
- **Kiro_Lane**: The lane that owns `.kiro/**`, `packages/engine`, `packages/kb-tools`, `packages/mcp`, `apps/*/kb`, `apps/*/rulebook` and `apps/*/golden`.

## Requirements

### Requirement 1: Page, build and run-time boundaries

**User Story:** As a visitor, I want a fast static page that makes no request except to its own host, so that it loads at once and tracks nothing.

#### Acceptance Criteria

1. THE Landing_Page SHALL be a React page built by Vite from `apps/site/index.html`, served at `/dead-certain/`, and SHALL replace the placeholder page and `src/placeholder.css`.
2. THE Site SHALL keep building the `/kit/` gallery pages exactly as before, and the Landing_Page SHALL link to the gallery.
3. THE Site's `build` script SHALL compile the Claim_KB first (`node ../../packages/kb-tools/bin/dc.mjs build apps/claim-check`) and then run `vite build`, as the apps' build scripts now do, and the Site SHALL declare `@dead-certain/engine` as a dependency and `@dead-certain/kb-tools` as a dev dependency, both `workspace:*`. THE Site SHALL also declare `fast-check` `4.10.2` as a dev dependency, for the property tests (a package of section 7 of the build plan, approved by the human). BECAUSE `pnpm build` runs the Site's and both apps' builds in parallel, and each `dc` call rebuilds kb-tools' `dist`, which deletes `dc.mjs` under a build that is reading it, THE Site's `build` script SHALL compile the Claim_KB without rebuilding kb-tools. (Amended 2026-11-22: the first version named `pnpm -w run dc build`, which made three parallel rebuilds, and the gate's CI run failed with "dist/dc.mjs is missing".)
4. THE Landing_Page SHALL load the Claim_KB from the compiled JSON, SHALL check its shape at start-up, and WHEN the check fails, SHALL still show the headline, the paragraph, the Steps' text without data, the App_Cards and the footer, and a plain notice in place of the Hero verdict that says the sample failed to load. The notice SHALL be a level-2 heading and text, since the page keeps its one level-1 heading.
5. THE Landing_Page SHALL make no network request after the page and its own assets have loaded, SHALL load no third-party font, script or style, and SHALL use no `localStorage`, `sessionStorage`, cookie or analytics.
6. THE Landing_Page SHALL NOT modify `packages/ui`, `packages/engine` or any file under `apps/claim-check` or `apps/pre-flight`.
7. THE Landing_Page SHALL NOT import from `apps/claim-check/src` or `apps/pre-flight/src`. It may read `apps/claim-check/kb/dist/policy.json` only.
8. THE Landing_Page SHALL name a fact or a goal in the Hero_Module only. Every other module SHALL read labels, clauses and rules from the Claim_KB.
9. THE Landing_Page SHALL give the page content in the HTML a `<noscript>` message with the headline and the links to both apps, so that the page is not blank without JavaScript.
10. THE Landing_Page SHALL set the document title to "Dead Certain. LLMs guess. The dead are certain." and a `description` meta of one sentence, and SHALL set `og:title`, `og:description` and `og:type` with the same text and no `og:image`.

### Requirement 2: The Hero and its working verdict

**User Story:** As a visitor, I want to see a real verdict the moment the page opens, so that I believe the claim in the headline.

#### Acceptance Criteria

1. THE Hero SHALL show the level-1 heading "LLMs guess. The dead are certain." and one paragraph in the System voice of at most 40 words that says a model drafts rules once, and a small engine decides from then on, with a proof for each verdict.
2. THE Landing_Page SHALL have exactly one level-1 heading.
3. THE Verdict_Sheet SHALL show the result of `audit(Claim_KB, Hero_Claim)`: a `VerdictHeadline` whose state is `verdictStateFrom` of the outcome goal and whose statement reads "<payable> of <claimed> will be paid", a `ProportionBar`, and a `Ledger` with the claimed amount, each non-zero deduction as a row with its clause, and the payable amount.
4. THE Verdict_Sheet's amounts SHALL be formatted by the UI_Kit in the Claim_KB's currency, and SHALL be the Engine's values. THE page SHALL contain no amount that is not computed from the Engine's result or the Hero_Claim.
5. THE Hero_Claim SHALL equal the `facts` of golden scenario `G-01`, and THE Hero_Verdict SHALL equal that scenario's `expect` block: `payable` 13,200,000 minor units, `outcome` `reduced`, and the eight line items.
6. THE Verdict_Sheet SHALL say, in a line of small text, that this is a sample claim on a sample policy written for this project, and that the verdict was worked out in the visitor's browser.
7. THE Hero SHALL show the Hero_Claim's answers in a `Disclosure` named "Answers used for this claim", as a list of label and value pairs formatted with the kit's `formatEntries`.
8. THE Verdict_Sheet SHALL show a link "Check your own claim" to the Claim Check app, and the link SHALL be a native anchor styled as the kit's secondary button.
9. THE Hero SHALL NOT let the visitor edit the Hero_Claim.
10. THE Hero SHALL render its verdict on the first paint of the page's JavaScript, with no spinner and no placeholder box, and SHALL NOT cause a layout shift larger than the budget in requirement 9.

### Requirement 3: See why

**User Story:** As a visitor, I want my first action to open the proof, so that I see why this page can say "certain".

#### Acceptance Criteria

1. THE Verdict_Sheet SHALL show the control "See why" for the verdict and, on each ledger row, the kit's row control that opens that row's proof.
2. WHEN the visitor activates "See why", THE Hero SHALL develop the verdict into the X-ray through `XrayStage`, titled "Why", with the film showing the proof tree of the outcome goal, and WHEN the visitor activates a ledger row, THE X-ray SHALL show that row's proof, titled "Why: <row label>".
3. THE X-ray film SHALL show a `ProofTree` built from the Engine's `explain` on the Hero_Claim's session, each rule's sentence first and its expression behind "Show the rule", each answered fact with the source "You answered" (kit label), and the cited clause in a `ClauseQuote` with the deciding sentence marked.
4. THE X-ray SHALL follow the kit's behaviour without change: the 500 ms develop and its 120 ms reduced-motion fade, the ARIA tree keys, Escape to close with focus back on the control that opened it, the bottom sheet below 1280 px and the side-by-side layout from 1280 px. (Amended 2026-11-22: Escape closes the X-ray from inside the proof tree at every width, and from anywhere below 1280 px. At 1280 px the side film's "Why" heading does not take Escape. Claim Check behaves the same. This is a kit finding, listed in the review.)
5. THE Hero SHALL NOT offer "Change this answer" in the X-ray, because the Hero_Claim is fixed.
6. THE page SHALL keep every control reachable by keyboard in the reading order, with the visible focus ring of the design system. `VerdictHeadline` takes focus when it mounts, so the Hero SHALL hand focus back to the top of the page once on load, and the first Tab SHALL reach the first navigation entry.
7. THE X-ray SHALL be the only choreographed motion on the page.

### Requirement 4: The three steps

**User Story:** As a visitor, I want to see how a rulebook becomes a verdict, so that I understand what I am looking at.

#### Acceptance Criteria

1. THE Landing_Page SHALL show an ordered list of exactly three steps, headed by a level-2 heading, with the titles "The rulebook", "The rules" and "The verdict".
2. THE first step SHALL show the clause that the rule in the second step cites, taken from the Claim_KB and shown in a `ClauseQuote` in the Document voice, with its id and title.
3. THE second step SHALL show one rule from the Claim_KB that appears in the proof of the Hero's `room_rent_deduction` row: the rule's id in the Machine voice, its plain sentence (`because`, with its placeholders left as written), its expression printed with the Engine's `print`, and the id of the clause it cites. The Hero_Module SHALL name the rule's id, and the rule SHALL be one whose printed expression is at most 90 characters, so that it reads on a phone. (Decided at the gate G5 review: `ROOM-03`, "The room rent limit is 1% of the sum insured for each day.", a 36-character expression citing clause 4.2. `ROOM-05`, the first choice, prints at 112 characters.)
4. THE third step SHALL say that the engine applies the rules to the answers and returns the verdict above with its proof, and SHALL link to "See why" in the Hero (an anchor that moves focus to that control).
5. THE text of the clause, the rule's sentence and its expression SHALL be read from the Claim_KB at build or run time, and SHALL NOT be typed into the page.
6. EACH step SHALL be one or two sentences plus its quoted data, and SHALL carry no uppercase label and no caption above its title.
7. THE first step SHALL link to the clause on Claim Check's rulebook page (`claim-check/#/rulebook?clause=<id>`, built from `import.meta.env.BASE_URL`). THE page SHALL make no other deep link into an app, and SHALL NOT link to an address that the apps do not serve.
8. UNDER the Steps, THE Landing_Page SHALL show one sentence in the System voice: "The specs, the engine and the rules were written with Kiro. The interface was built with Claude Code.", with a link named "The .kiro folder" to `https://github.com/chitrakumarsai/dead-certain/tree/main/.kiro`.

### Requirement 5: The two apps and the scaffold command

**User Story:** As a visitor, I want to go to either app and to see how I would build a third, so that I know this is a skeleton.

#### Acceptance Criteria

1. THE Landing_Page SHALL show a level-2 heading and two App_Cards. Each card SHALL hold the app's name as a link, one sentence on what it does, and its mode: Claim Check (consultation: a policyholder answers questions and gets the amount paid) and Pre-Flight (audit: a developer submits a public GitHub repository and gets pass or fail for each checklist item).
2. THE card links SHALL go to `/dead-certain/claim-check/` and `/dead-certain/pre-flight/`, built from Vite's `import.meta.env.BASE_URL`, so that they stay correct if the base path changes.
3. THE Landing_Page SHALL show a level-2 heading and the Scaffold_Command: the text `pnpm new-app <name>` in the Machine voice, a sentence that says it creates a third app from the template, and a link to the README section "Add a third app" in the repository.
4. THE Scaffold_Command SHALL have a "Copy command" button that copies `pnpm new-app my-app` to the clipboard, and SHALL announce "Copied" through a polite live region. WHEN the clipboard is unavailable, THE page SHALL show the text selected for copying and say so in words.
5. THE Landing_Page SHALL link to the source repository and the component gallery (`/dead-certain/kit/`), as plain links in the shell navigation or a short line of text.
6. EACH link text SHALL name its destination in words, with no "click here" and no arrow glyph.

### Requirement 6: Shell, footer and the 404 page

**User Story:** As a visitor, I want the same shell and tone as the apps, so that the page feels like part of the product.

#### Acceptance Criteria

1. THE Landing_Page SHALL render inside the UI_Kit `AppShell` with the app name "Dead Certain" and the navigation entries "Claim Check", "Pre-Flight", "Component kit" and "Source". The "Source" entry SHALL link to the repository. (Amended 2026-11-22: THE `AppShell` SHALL be given an empty `appName`, because the shell prints "Dead Certain" itself and the app name after it, so the name "Dead Certain" read twice.)
2. THE footer SHALL be the shell's default: "No guesses were made in the production of this verdict."
3. THE Site SHALL build `404.html` as an additional page. It SHALL render in the same shell, show a level-1 heading and one dry sentence (no money is at stake there, section 8), and a link back to the Landing_Page.
4. THE 404 page SHALL load every asset by an absolute path under the base, so that it renders at any depth under `/dead-certain/` (GitHub Pages serves it for an unknown path).
5. THE Landing_Page and the 404 page SHALL follow the copy rules of section 8: sentence case, active voice, no exclamation mark, a control keeps one name through a flow.

### Requirement 7: Design system and accessibility

**User Story:** As a visitor using a keyboard, a screen reader or a phone, I want the page to work for me, so that no part of it is out of reach.

#### Acceptance Criteria

1. THE Landing_Page SHALL use the UI_Kit's tokens and components, and SHALL define no colour, font or spacing value of its own. It SHALL use no global dark mode, no uppercase label or `text-transform: uppercase`, no `box-shadow` other than `none`, no gradient, no scroll-triggered entrance animation, and no arrow or chevron glyph in a button label.
2. THE Landing_Page SHALL have no pumpkin, bat, blood or other Halloween ornament.
3. THE Landing_Page SHALL meet WCAG 2.2 AA: text contrast of at least 4.5:1 and interface parts of at least 3:1, touch targets of at least 44 px, layout that holds from 320 px wide and at 200% zoom, and colour never alone for meaning.
4. THE Landing_Page SHALL have one `main` landmark, a `nav` named "Main", a `contentinfo` landmark, and a heading order with no skipped level.
5. THE Landing_Page SHALL announce the opening and closing of the X-ray through the kit's live region, and SHALL give the Verdict_Sheet an accessible name.
6. WITH `prefers-reduced-motion`, THE Landing_Page SHALL show no scan line and no movement.
7. THE text column SHALL be at most 680 px wide, and the page SHALL use the kit's breakpoints 390, 768, 1024 and 1280.
8. AT 1280 px and wider, WHEN the X-ray is open, THE Hero SHALL show the sheet and the film side by side with the layout of section 8. BELOW 1280 px, THE film SHALL be a sheet that slides up, as in the kit.
9. THE Landing_Page SHALL have print styles that print the Verdict_Sheet and the Steps and hide the navigation and the controls.

### Requirement 8: Data fidelity

**User Story:** As a maintainer, I want the page to fail loudly when the knowledge base changes under it, so that the front door never shows a wrong verdict.

#### Acceptance Criteria

1. A unit test SHALL run `audit` on the Hero_Claim and the compiled Claim_KB and fail when any value differs from golden scenario `G-01`'s `expect` block.
2. A unit test SHALL fail when a fact the Hero_Module names is missing from the Claim_KB, or has a different type than the Hero_Module assumes, or when the Hero_Claim is rejected by the Engine.
3. A unit test SHALL fail when the clause, rule sentence or expression shown in the Steps differs from the Claim_KB's own text. THE tests MAY compile `policy.yaml` with kb-tools' `compileText`, the compiler that `dc build` runs, so that they do not depend on an earlier `dc build`.
4. A unit test SHALL fail when any file under `apps/site/src/landing` imports from `apps/claim-check/src` or `apps/pre-flight/src`.
5. WHEN the Claim_KB's shape check fails, THE Landing_Page SHALL behave as requirement 1.4 states, and an end-to-end test SHALL cover it with the compiled JSON replaced.
6. THE ledger rows' deductions SHALL add up: the claimed amount minus the sum of the rows equals the payable amount, and IF it does not, THEN the Hero SHALL show the failure notice instead of a verdict (as Claim Check's above-bill refusal does), and a unit test SHALL cover the case.

### Requirement 9: Budgets and tests

**User Story:** As the human, I want the front door to meet the same budgets as the apps, so that the first impression is fast.

#### Acceptance Criteria

1. THE Landing_Page's JavaScript, including the Engine, the Claim_KB and the UI_Kit, SHALL be under 200 kB gzipped, not counting the X-ray develop's on-demand chunk, which the kit loads when the stage mounts.
2. THE Landing_Page's cumulative layout shift SHALL be under 0.05, including font loading, and `index.html` SHALL preload the three above-the-fold font files as the apps' pages do.
3. THE Hero_Verdict SHALL compute in under 10 ms, checked by a benchmark test as in the apps. THE Hero_Module SHALL build the `explain` session as `{ kb, answers }` after `audit` has validated both, and SHALL NOT replay `answer` for each fact: the replay re-validates the knowledge base each time and took 12 ms.
4. THE end-to-end suite SHALL replace `e2e/site.spec.ts`, and SHALL cover at 390, 768 and 1280 px and with reduced motion: the heading, the hero statement and ledger, "See why" opening and Escape closing with focus returned, a ledger row opening its own proof, the keyboard path through the page, the links' targets, "Copy command", the 404 page, and a zero-violation axe result for the page and with the X-ray open.
5. A privacy test SHALL fail when the page requests any URL outside its own host, and when it writes to any storage or cookie.
6. A budget test SHALL read the built assets and fail when requirement 9.1 is broken.
7. THE existing `/kit` end-to-end tests SHALL pass unchanged.
8. EVERY task SHALL end with the Task_Evidence, attached to the pull request and not committed.

### Requirement 10: Deployment

**User Story:** As the human, I want the page live at the end of the phase, so that gate G5 is met.

#### Acceptance Criteria

1. THE CI workflow SHALL keep copying the two apps into `apps/site/dist`, and the Site's `dist` SHALL hold `index.html`, `404.html`, `kit/`, `claim-check/` and `pre-flight/` after the copies.
2. WHEN the pull request merges to `main`, THE deploy job SHALL publish the Landing_Page, and the human SHALL confirm the live URL loads in a private browser window and that "See why" works there.
3. THE Landing_Page SHALL need no change to the deploy job.

## Open questions and decisions

Decided by the brief and the build plan:

- **Hero.** A working verdict sheet with its "See why" control. The headline is "LLMs guess. The dead are certain." Three numbered steps (rulebook, rules, verdict), the two apps, and the command that scaffolds a third.
- **Components.** The kit's, unchanged.
- **Footer and 404.** The dry lines are allowed there only (section 8).

Decided by the human (2026-11-20):

1. **Fixed hero.** The claim is fixed, with no editable answer (requirement 2.9).
2. **Verdict code.** Copy it into the Hero_Module. Do not import from the apps and do not add a shared package (requirement 1.7).
3. **The sample claim.** Golden scenario `G-01` (requirement 2.5).
4. **Mention the tools.** The page carries one sentence under the three steps that says the specs, engine and rules were written with Kiro and the interface with Claude Code, with a link to the `.kiro` folder in the repository (requirement 4.8).
5. **Link preview image.** None. Open Graph tags are text only (requirement 1.10).
6. **The 404 page.** Built now (requirement 6.3).
7. **Repository URL.** `https://github.com/chitrakumarsai/dead-certain`. The link to the README section "Add a third app" uses this address with the `#add-a-third-app` anchor once the `app-template` spec has added the section, and the README's top until then (requirement 5.3).
8. **Lighthouse.** Not in CI. The budgets use the size, layout-shift and axe tests (requirement 9). A manual Lighthouse run for the submission stays the human's choice.

No open question remains.
