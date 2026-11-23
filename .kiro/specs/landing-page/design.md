# Design Document: landing-page

## Overview

The landing page is one React page in `apps/site`, built from the real thing. At start-up it runs the engine's `audit` once, on the compiled Claim Check knowledge base and the facts of golden scenario `G-01`. It shows the result with the kit's verdict components and opens the proof with the kit's `XrayStage`. The three steps below the hero quote the same knowledge base. The page types no amount, clause or rule.

Three decisions shape it.

1. **A still frame of a real computation.** The claim is fixed. The page is a demonstration, not a form, and it has no state beyond "which proof is open".
2. **The page owns no domain code.** Everything it needs from Claim Check (ledger rows, proportion parts, statement, proof sentences with money printed as money) is a small copy in one module, `landing/hero/`, and a test forbids importing from `apps/claim-check/src`. The apps stay deletable, and the site stays buildable if one of them changes its internals.
3. **It fails loudly at build and test time, not in front of a visitor.** A unit test pins the hero's numbers to the golden scenario, another pins every quoted clause and rule to the knowledge base, and the page shows a plain notice instead of a wrong verdict if the data stops fitting.

This spec is implemented by the Claude Code lane. Nothing here touches `packages/ui`, `packages/engine` or the apps.

### Findings from reading the repo

| Finding | Consequence |
| --- | --- |
| `apps/site/index.html` is a static placeholder: an `<h1>` with the tagline, two paragraphs, a link and a footer line, styled by `src/placeholder.css`. `e2e/site.spec.ts` checks only the `<h1>`. | The page is replaced, not extended. The `<h1>` text is unchanged, so that assertion survives, and the new suite replaces the file (requirement 9.4). |
| `apps/site/vite.config.ts` has `base: "/dead-certain/"` and four Rolldown inputs: `index.html` and the three `kit/*.html` pages. The site's `package.json` has `@dead-certain/ui`, React and Tailwind, and no engine. | Add `404.html` as an input. Add `@dead-certain/engine` and `@dead-certain/kb-tools`, both `workspace:*` (kb-tools only so that `dc` is on the path, as in the apps). |
| The apps' `build` was `pnpm -w run dc build apps/<name> && vite build`, which rebuilds kb-tools' `dist` on every call. Since the gate G5 review it is `node ../../packages/kb-tools/bin/dc.mjs build apps/<name> && vite build`, in the apps, the site and the Template. The site's was `vite build`. CI already runs `pnpm dc build apps/claim-check` before `pnpm check`, but Playwright's web server runs `pnpm --filter @dead-certain/site build` on its own. | The site's build compiles the Claim_KB first, so it works from a clean checkout. It must not rebuild kb-tools: three parallel `dc` rebuilds delete `dist/dc.mjs` under each other (the gate's CI run failed that way). |
| The gallery's static screens, `apps/site/src/kit/claimScreens.tsx`, build Claim Check screens from the kit's fixtures with no engine. | The gallery is unchanged. The landing page is the first site page that runs the engine. |
| `AppShell` takes `appName`, `nav`, `rail`, `footer`, `children`, and defaults the footer to "No guesses were made in the production of this verdict." | The page passes no footer. The nav has four entries. |
| `VerdictHeadline` renders a heading at level 1 or 2 (`headingLevel`). The page's one `<h1>` is the tagline. | The hero passes `headingLevel={2}` so that the page has one level-1 heading (requirement 2.2). |
| `XrayStage` takes `sheet`, `film(target)`, `target`, `title(target)`, `onClose`, `rail`. It owns the develop, the reduced-motion fade, focus return, the bottom sheet below 1280 px and the side-by-side layout above. It loads Motion on demand. | The hero is a `XrayStage` with the Verdict_Sheet as `sheet`. The page builds no motion. |
| `Ledger` takes `claimed`, `items`, `payable`, `format`, `selectedFact`, `onOpen(item, opener)`. `ProofTree` takes the root, `labelFor`, `formatValue`, `ruleExpression`, `clauseFor`, `decidingClause`, `onEscape`. | The page supplies those from the Claim_KB, as `apps/claim-check/src/screens/Xray.tsx` does. |
| The engine fills a rule's `{fact}` placeholders with raw values, so money reads as minor units. Claim Check re-fills each sentence with printed values (`xray/because.ts`). | The hero copies that function (requirement 3.3, "money printed as money"). |
| `G-01` in `apps/claim-check/golden/scenarios.yaml`: 12 facts, `payable` 13,200,000, `outcome` `reduced`, eight line items (four non-zero: annexure 1,200,000, room rent 500,000, other charges 2,800,000, co-payment 3,300,000). Claimed 21,000,000. | The statement is "₹1,32,000 of ₹2,10,000 will be paid". `ROOM-05` sets `room_rent_deduction` and cites clause 4.2. |
| `policy.json` is 45 kB raw. | It fits the 200 kB gzipped budget with room. A test checks it. |
| Claim Check routes by hash, and its rulebook is `#/rulebook?clause=<id>`. | Step 1 links there (requirement 4.7). |
| `README.md` has no "Add a third app" section yet (the `app-template` spec adds it). | Requirement 5.3's link goes to the README root until then (open question 7). |

## Architecture

```mermaid
graph TD
    subgraph Build["Build time"]
        KBY[apps/claim-check/kb/policy.yaml] -->|pnpm dc build| KBJ[kb/dist/policy.json]
    end
    subgraph Page["apps/site/src/landing"]
        MAIN[main.tsx] --> SHAPE[kbShape check]
        KBJ --> SHAPE
        SHAPE -->|ok| HERO[hero/model.ts: audit + view model]
        SHAPE -->|fail| NOTICE[SampleFailed notice]
        HERO --> SHEET[Hero.tsx: XrayStage]
        SHEET --> UI[@dead-certain/ui]
        HERO --> FILM[hero/film.tsx: ProofTree and ClauseQuote]
        SHAPE --> STEPS[Steps.tsx: clause and rule from the KB]
        MAIN --> APPS[Apps.tsx: two cards]
        MAIN --> SCAFF[Scaffold.tsx: command and copy]
    end
    HERO --> ENG[engine: audit, explain, print]
```

### Files

| File | Responsibility | Pure? |
| --- | --- | --- |
| `apps/site/index.html` | Entry. Title, description, Open Graph text tags, the three font preloads, `<noscript>`, `#root`, the script | n/a |
| `apps/site/404.html` | Entry for the 404 page (absolute asset paths) | n/a |
| `src/landing/main.tsx` | Mount, `AppShell`, compose the sections | no |
| `src/landing/config.ts` | Imports `../../../claim-check/kb/dist/policy.json` as `unknown`. Exports `compiledKb`, the repository URL and the nav. | yes |
| `src/landing/kbShape.ts` | `isKnowledgeBase(value)`: the same shape check as the apps, copied | yes |
| `src/landing/hero/config.ts` | The only file that names facts: `HERO_FACTS` (the `G-01` answers), `AMOUNT_GOAL`, `STATE_GOAL`, `CLAIMED_FACT`, `STEP_RULE` (a rule id) | yes |
| `src/landing/hero/model.ts` | `heroModel(kb)`: runs `audit`, returns `{ session, verdict, ledger, parts, statement, state, answers }` or a `HeroFailure` | yes |
| `src/landing/hero/because.ts` | `withPrintedBecause` and `printValue`, copied from Claim Check | yes |
| `src/landing/hero/Film.tsx` | The proof body for a target: `ProofTree`, then the deciding clause | no |
| `src/landing/Hero.tsx` | Headline, paragraph, `XrayStage` with the Verdict_Sheet, the answers `Disclosure`, the link "Check your own claim" | no |
| `src/landing/Steps.tsx` | The three steps from `steps(kb, stepRule)` | no |
| `src/landing/stepsData.ts` | `steps(kb, ruleId)`: the rule, its clause and expression, or a failure | yes |
| `src/landing/Apps.tsx` | The two App_Cards | no |
| `src/landing/Scaffold.tsx` | The command, its explanation, "Copy command", the live region | no |
| `src/landing/SampleFailed.tsx` | The notice for requirement 1.4 and 8.6, a level-2 heading | no |
| `src/landing/NotFound.tsx` and `404.tsx` | The 404 page | no |
| `src/landing/styles.css` | The print rules only. `main.tsx` imports `@dead-certain/ui/styles.css` once, as the kit pages do: importing it again here built the font faces twice and failed the kit's refusals test. | n/a |
| `vite.config.ts` | Add the `404.html` input | n/a |
| `package.json` | `build` runs `dc.mjs build apps/claim-check` first, without rebuilding kb-tools. Add the two workspace dependencies | n/a |

### Page layout

```text
desktop (1280, X-ray open)
+-----------------------------------------------------------------+
| Dead Certain        Claim Check  Pre-Flight  Component kit  Source |
+----------------------------------+------------------------------+
| LLMs guess. The dead are certain.| FILM                         |
| A model drafts rules once...     | Why                          |
|                                  | o ROOM-05  tree ...          |
| (icon) Paid in part              |                              |
| ₹1,32,000 of ₹2,10,000 will be   | Clause 4.2                   |
| paid                             | ...deciding sentence in wax  |
| [=====paid=====|cut|cut|cut]     |                              |
| Claimed                ₹2,10,000 |                              |
| Annexure 1 items  −₹12,000       |                              |
| Room rent ...     −₹5,000        |                              |
| Payable                ₹1,32,000 |                              |
| [See why]  Check your own claim  |                              |
| Sample claim, sample policy...   |                              |
+----------------------------------+------------------------------+
| 1 The rulebook   2 The rules   3 The verdict   (one column, 680)  |
| Two apps   Claim Check | Pre-Flight                               |
| Build a third   pnpm new-app <name>   [Copy command]              |
+-----------------------------------------------------------------+
| No guesses were made in the production of this verdict.          |
+-----------------------------------------------------------------+

phone (390): one column. The headline, the paragraph, the sheet. "See why" slides the film up as a sheet.
```

The hero is the only section inside `XrayStage`. When the stage opens at 1280 px, the sheet narrows to make room for the film, as in section 8. The steps and the cards below it are ordinary paper on the page, in a 680 px column.

## Components and Interfaces

### Hero model

```ts
interface HeroModel {
  session: Session;                   // { kb, answers: HERO_FACTS }, built after audit without replaying answer (under 10 ms)
  verdict: Verdict;                   // audit(kb, HERO_FACTS)
  state: VerdictState;                // verdictStateFrom(goal STATE_GOAL, needed.length)
  statement: string;                  // "₹1,32,000 of ₹2,10,000 will be paid"
  ledger: { claimed; items; payable };
  parts: ProportionPart[];            // one paid part, one cut per known deduction
  answers: AnswerEntry[];             // formatEntries(HERO_FACTS, kb.facts, { currency })
}
type HeroFailure = { kind: "failed"; reason: "kb_mismatch" | "engine_error" | "ledger_mismatch" };

function heroModel(kb: KnowledgeBase): HeroModel | HeroFailure
```

`heroModel` never throws. It catches `EngineError`, checks that the goals have the expected types, and checks that `claimed − sum(non-zero deduction rows) = payable` (requirement 8.6). It copies the three Claim Check functions it needs (`ledgerFrom`, `partsFrom`, `statementFor`) and `printValue`. `HERO_FACTS` is the `G-01` record, written as a literal with a comment that names the scenario file.

### The Hero section

```tsx
<XrayStage
  target={open}
  title={(t) => (t.kind === "verdict" ? "Why" : `Why: ${labelFor(kb, t.fact)}`)}
  onClose={() => setOpen(null)}
  sheet={<VerdictSheet model={model} open={open} onOpen={setOpen} />}
  film={(t) => <Film kb={kb} session={model.session} target={t} onClose={() => setOpen(null)} />}
/>
```

The headline and paragraph sit above the stage's sheet in the same column, outside `XrayStage`'s film logic. `VerdictSheet` renders a `Sheet` with `aria-labelledby` on its headline, a `VerdictHeadline` (`headingLevel={2}`, size `verdict`), `ProportionBar`, `Ledger` (`onOpen` sets the target to the row's fact and passes the opener to the stage), the small honesty line, the "See why" `Button`, the "Check your own claim" anchor, and the `Disclosure` with the answers.

`Film` is Claim Check's `FilmBody` without `onChangeAnswer`: `withPrintedBecause(explain(session, fact), session)`, `ProofTree` with `labelFor`, `formatValue` (`printValue`), `ruleExpression` (`print(rule.to)` with its `when`), `clauseFor`, `decidingClause`. The proof of the verdict is the proof of `STATE_GOAL`.

### The steps

```ts
interface StepsData {
  clause: Clause;              // kb.clauses[rule.cite]
  rule: { id: string; because: string; expression: string; cite: string };
}
function steps(kb: KnowledgeBase, ruleId: string): StepsData | null   // null when the rule or clause is missing
```

`STEP_RULE` is a rule in the proof of `room_rent_deduction` whose printed expression is at most 90 characters (requirement 4.3). The task picks it by looking at the knowledge base, records the id in `hero/config.ts`, and a test asserts the three conditions: the rule exists, it is in that proof, and its expression is short enough. If `steps` returns null, the step shows its title and its plain sentence and no quoted data (the same fall-back as requirement 1.4).

Step 1 renders `ClauseQuote` in the Document voice and a link "Read clause <id> in the rulebook". Step 2 renders the rule id (Machine voice), the `because` sentence as written, and the expression in a code-style block that wraps (`overflow-wrap: anywhere`) at 390 px. Step 3 is two sentences and an anchor "Open the proof above" that sets the open target to the verdict and moves focus to the stage (the same effect as pressing "See why").

### Apps and scaffold

The cards are `<article>`s with a level-3 heading holding the app link, a sentence and a mode line. Both links use `import.meta.env.BASE_URL` plus `claim-check/` or `pre-flight/`. The command block is a `<code>` in the Machine voice with the text `pnpm new-app <name>`. "Copy command" calls `navigator.clipboard.writeText("pnpm new-app my-app")` inside a try; on success it announces "Copied" through the kit's `useAnnounce`; on a rejection or a missing `navigator.clipboard` it selects the command's text and announces "Copy unavailable. The command is selected." The page writes to no storage.

### Document metadata

`index.html` holds the title, the description and the three Open Graph text tags (requirement 1.10), the three font preloads in the form the apps use, a `<noscript>` block with the headline and the two app links, and the `#root` div. `404.html` is the same without the Hero.

### Build and CI

`apps/site/package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "<compile apps/claim-check without rebuilding kb-tools> && vite build",
  "preview": "vite preview"
},
"dependencies": { "@dead-certain/engine": "workspace:*", "@dead-certain/ui": "workspace:*", "react": "19.3.1", "react-dom": "19.3.1" },
"devDependencies": { "@dead-certain/kb-tools": "workspace:*", ... }
```

`vite.config.ts` adds `notfound: "404.html"` to the Rolldown inputs. CI needs no change: it already builds, copies the two apps into `apps/site/dist` and uploads that folder, which now holds `404.html` too. `pnpm install` changes `pnpm-lock.yaml`, committed with the first task.

## Data Models

```ts
// hero/config.ts: the only file that names facts
export const HERO_FACTS: Readonly<Record<string, FactValue>> = {
  cause: "illness", treatment: "other", treated_outside_india: false,
  policy_start_date: "2025-01-01", illness_start_date: "2025-06-01",
  annexure_items: 1_200_000, room_rent_per_day: 600_000, room_days: 5,
  age: 64, sum_insured: "five_lakh", paid_this_year: 0, claimed: 21_000_000,
};
export const AMOUNT_GOAL = "payable";
export const STATE_GOAL = "outcome";
export const CLAIMED_FACT = "claimed";
export const STEP_RULE = "ROOM-03"; // chosen at the gate review (requirement 4.3)
```

`HERO_FACTS` mirrors `G-01` exactly. The unit test reads `scenarios.yaml` through kb-tools' golden loader and compares, so the literal cannot drift from the scenario. `ROOM-05`, the first choice, prints at 112 characters, so the build chose `ROOM-03` from the same proof (36 characters), and the review accepted it.

## Error Handling

| Condition | Result |
| --- | --- |
| The compiled JSON fails `isKnowledgeBase` | `SampleFailed` replaces the Hero's sheet. The headline, paragraph, steps' text without quoted data, cards, scaffold and footer still render. |
| `audit` throws `EngineError` (a renamed fact, a bad value) | `heroModel` returns `engine_error`. Same notice. |
| The ledger rows do not add up to the payable amount | `ledger_mismatch`. Same notice. |
| `steps` cannot find its rule or clause | The step renders without the quoted data. A unit test makes this a failure in CI, so a visitor never sees it. |
| The clipboard is unavailable | "Copy unavailable. The command is selected." |
| `kb/dist/policy.json` is missing at build | The Vite build fails on the import, which is the intended loud failure (the site's `build` script compiles it first). |
| JavaScript is off | `<noscript>`: the headline and the two app links |

The notice reads: "The sample verdict could not be loaded. Reload the page, or open Claim Check to see a verdict." It is plain words, with no apology and no code.

## Correctness Properties

*A property holds for every valid input. These are checked with fast-check on the pure modules, against the compiled Claim_KB.*

### Property 1: The hero relays the engine

*For any* single-fact perturbation of `HERO_FACTS` that the engine accepts (a different value of the right type for one askable fact), `heroModel` returns either a model whose verdict equals `audit(kb, perturbed)` and whose goals, ledger rows and statement come from that verdict, or a `HeroFailure`, and never throws. For `HERO_FACTS` itself it returns a model equal to `G-01`'s `expect` block.

**Validates: Requirements 2.3, 2.4, 2.5, 8.1, 8.2**

### Property 2: The ledger adds up or the page refuses

*For any* perturbation that gives a model, `claimed − Σ(deduction rows) = payable`. *For any* that does not, `heroModel` returns `ledger_mismatch` and no model.

**Validates: Requirements 2.3, 8.6**

### Property 3: Every ledger row has a proof that agrees

*For any* model, *for each* non-zero deduction row, `explain(session, row.fact)` has a root whose value equals the row's value, and its proof contains at least one rule and one clause that exists in the knowledge base.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Quoted text is the knowledge base's text

*For any* rule id in the knowledge base, `steps(kb, id)` returns a clause equal to `kb.clauses[rule.cite]`, a `because` equal to `rule.because`, and an expression equal to `print(rule.to)` (with `when` as Claim Check prints it). For an id not in the knowledge base it returns null.

**Validates: Requirements 4.2, 4.3, 4.5, 8.3**

### Property 5: Proof sentences print money as money

*For any* proof of the hero session, `withPrintedBecause` leaves the tree's shape, facts, values and rules unchanged and changes only `because`, and no `because` of a money fact contains an unformatted run of seven or more digits.

**Validates: Requirement 3.3**

### Property 6: Links are built from the base

*For any* base path string, the four internal links (two apps, the gallery, the rulebook clause) start with that base and contain no `//` after it, and no link is built from the knowledge base's text.

**Validates: Requirements 4.7, 5.2, 5.5**

## Testing Strategy

| Layer | Tool | What |
| --- | --- | --- |
| Hero model, steps, links | Vitest, with `policy.json` read as the compiled Claim_KB | `heroModel`, `steps`, `withPrintedBecause`, the mismatch cases |
| Golden pin | Vitest, kb-tools golden loader on `scenarios.yaml` | `HERO_FACTS` equals `G-01`'s facts and the model equals its `expect` block (requirement 8.1) |
| Lane scan | Vitest reads `apps/site/src/landing/**` | No import from `apps/claim-check/src` or `apps/pre-flight/src`, no network call, no storage (requirements 1.5, 1.7, 8.4) |
| Properties | Vitest and fast-check 4.10.2, files `*.props.test.ts`, at least 100 runs, tagged `// Feature: landing-page, Property N: <title>` | Properties 1 to 6 |
| Page | Playwright against the built site | Requirement 9.4, at 390, 768, 1280 and reduced motion |
| Accessibility | `@axe-core/playwright` | Zero violations on the page, with the X-ray open, and on `404.html` |
| Budgets | Build-size test, layout-shift check, `heroModel` benchmark | Requirements 9.1 to 9.3 |
| Privacy | Playwright request and storage listeners | Requirement 9.5 |
| Failure path | Playwright with the compiled JSON replaced through a route | Requirement 8.5 |

### End-to-end cases

At each width: the one `<h1>`; the statement text equals "₹1,32,000 of ₹2,10,000 will be paid"; the ledger shows the four deductions with their clause ids; "See why" opens the film titled "Why" (side by side at 1280, a sheet below), Escape closes it and returns focus to "See why"; a ledger row opens "Why: <label>" and Escape returns focus to that row; Tab order follows reading order through the page; each link goes to the expected address (checked by `href`, not by navigation, since the apps are served on other ports in tests); "Copy command" announces "Copied" (the clipboard permission is granted in the test) and, with the permission denied, announces the fallback; `404.html` renders its heading and the link home. With reduced motion, no scan line element is present and the film fades in 120 ms (the kit's own test covers the timing; the page test checks the attribute).

### Evidence

Every task ends with Task_Evidence: screenshots at 390, 768 and 1280 px (attached, not committed), a clean console, zero axe violations and `pnpm check` output.

## Design decisions

| Decision | Alternatives | Why this one |
| --- | --- | --- |
| A fixed claim | An editable room rent, or a small form | The page is the front door. A still frame of a real computation is honest, small and fully testable. Question 1 leaves the door open. |
| Run `audit` in the browser | Precompute the verdict at build time and embed JSON | The visitor's browser does the work, so "this was worked out here" is true. The cost is the engine in the bundle, which fits the budget. |
| Copy about 150 lines from Claim Check | Import from `apps/claim-check/src`; a shared package | Importing couples the site to an app's internals. A shared package needs approval and touches another lane. A copy plus a golden pin and a lane scan costs a few tests. |
| Read `kb/dist/policy.json` | Embed a snapshot of the verdict | A snapshot goes stale silently. The compiled file is rebuilt on every build, and the golden pin fails if it drifts. |
| `audit` over `start` and `answer` | The consultation path | Every fact is known, so the two agree (the mode-agreement property). `audit` is one call and has no order to get wrong. |
| `VerdictHeadline` at level 2 | Let it render the `<h1>` and make the tagline a `<p>` | The tagline is the page's name and the section 8 headline. One `<h1>`, and it is the tagline. |
| Quote one clause and one rule in the steps | Show a diagram | The quoted text is the proof that the page is made of the real rulebook. A diagram would be art. |
| The 404 page as a second Vite input | A client-side route | GitHub Pages serves `404.html` for any unknown path. A client route would need the very rewrite that static hosting lacks. |
| Text-only Open Graph tags | An image | An image is a new binary and a design choice. Open question 5. |
| A `<noscript>` block | None | The page is client-rendered. A visitor without JavaScript still gets the headline and the two links. |
| The site compiles the Claim_KB in its own `build` | Rely on CI's earlier step | Playwright builds the site on its own, and a clean checkout has no `kb/dist`. The apps do the same. |

## Redesign: darkroom and lightbox

Amended 2026-11-23 for the darkroom and lightbox redesign (`docs/redesign-proposal.md`, approved by the human on 2026-11-23: JSON-LD Organization, no new dependencies). Implemented by **Claude Code lane. Not implemented in the Kiro session that wrote this.** Depends on `ui-kit` tasks 12 to 14.

- The page consumes the kit's theme, `ThemeToggle`, `CommandMenu`, `FeatureCard`, `Kbd`, `Pill` and `Illustration`. It adds no token. Landing-only motion (one fade and 16 px rise per section, blur-in on the h1, spotlight, shine, tilt) lives in `apps/site/src/landing` and uses the kit's duration tokens.
- SEO: the `<head>` of `apps/site/index.html` carries the canonical link, `description`, Open Graph and Twitter tags, and one `application/ld+json` script of type `Organization`, written by hand as static text. OG images are PNGs rendered once by a script in `scripts/` from a dedicated page, committed under `apps/site/public`. The script is Claude Code's, and no PNG is made at run time.
- Order of cuts: SEO and OG images first, then the command menu.
- Property 6 (links are built from the base) is unchanged. `lane.test.ts` mirrors the kit's storage exception: no `localStorage` under `apps/site/src/landing`.
