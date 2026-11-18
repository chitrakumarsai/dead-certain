# Design Document: claim-check-app

## Overview

Claim Check (`apps/claim-check`, package `@dead-certain/claim-check`) is a React single-page app. It composes the finished `@dead-certain/ui` components over the engine's consultation API. It holds no decision logic. Every amount, deduction, clause and proof comes from the engine and the compiled knowledge base.

The one source of truth is the **session**: the knowledge base plus the answers. The URL fragment mirrors it, and also carries the route. Everything on screen (the question, the rail, the verdict, the proof) is a pure function of the session and a few pieces of view state (which answer is being edited, which proof is open).

This spec is implemented by the Claude Code lane in `apps/claim-check/src` and `e2e`. Kiro writes the spec only. Nothing here changes `packages/ui` or `packages/engine/src/types.ts`.

### Findings from reading the repo

| Finding | Consequence |
| --- | --- |
| `apps/claim-check/` does not exist. No `kb/`, `rulebook/` or `golden/` yet, and there is no `templates/` directory, so `pnpm new-app` cannot run. | Task 1 scaffolds the app by hand, mirroring `apps/site` (Vite, React, Tailwind). The knowledge base and golden scenarios arrive from Phase 2. Tasks that need them say so and stop if they are absent. |
| `apps/site` is the only app. Its Vite `base` is `/dead-certain/`, and the Playwright config serves only the site on port 4173. | The app builds to `/dead-certain/claim-check/`. The Playwright config needs a second web server or a combined preview. That is root config, in the Claude Code lane. |
| `pnpm dc build` compiles YAML to JSON, but `docs/kb-format.md` names no output path. | Task 2 finds the path with `pnpm dc build` and records it in `config.ts`. Open question 2. |
| `@dead-certain/kb-tools` exports `loadGolden`, `checkGolden`, `duplicateIds`, `runScenario` (the kb-golden handoff). Results serialise. | The golden e2e reads scenarios through the loader and does not parse YAML itself. |
| `Question` carries `fact`, `text`, `why?`, `clause?`. There is no count of questions left. | "Up to M more" is a bound the app computes (see Progress). |
| `Verdict.goals` values are `FactValue | undefined`. `verdictStateFrom(goal, needed)` maps `paid`, `reduced`, `denied` to a state and everything else to `undecided`. | The state goal's value must be one of those strings. The knowledge base is authored that way. Open question 1. |
| `XrayStage` already owns the develop, the scan line, the reduced-motion fade, the sheet presentation and focus return. `ProofTree` owns the ARIA tree keys. | The app supplies the film content and the target. It builds no motion of its own. |
| `Session.answers` keeps every answer, including ones the engine no longer needs. | "Relevant" and "skipped" are computed by the app from the proofs of the goals. |
| `encode(s)` produces a URL-safe token. `decode(kb, token)` throws `EngineError` with `KB_MISMATCH`, `MALFORMED_TOKEN` or `UNSUPPORTED_VERSION`. | The replay layer maps those three to `StaleLinkNotice` and everything else to `MALFORMED_TOKEN`. |

## Architecture

```mermaid
graph TD
    subgraph Static["Build time"]
        KB[kb/*.yaml] -->|pnpm dc build| JSON[compiled KB JSON]
    end
    subgraph App["apps/claim-check/src"]
        JSON --> LOAD[kb.ts: load + shape check]
        LOAD --> STORE[session store]
        URL[URL fragment #/?r=token] <--> STORE
        STORE --> SEL[selectors: step, path, rail, ledger, parts]
        SEL --> SCREENS[screens]
        SCREENS --> UI[@dead-certain/ui components]
        STORE --> ENG[@dead-certain/engine]
        SEL --> ENG
    end
    subgraph Tests["e2e"]
        GOLD[golden/*.yaml via kb-tools] --> PW[Playwright: one test per scenario]
        PW --> App
    end
```

### Modules

| Module (`apps/claim-check/src/`) | Responsibility | Pure? |
| --- | --- | --- |
| `main.tsx` | Mount, router, `AppShell`, load the knowledge base, show the load-failure notice | no |
| `config.ts` | The only file that names facts and goals: `amountGoal`, `stateGoal`, `claimedFact`, plus the KB JSON path | yes |
| `kb.ts` | Import the compiled JSON, check its shape, expose `kb`, `format`, `labelFor`, `defFor`, `clauseFor`, `ruleExpression` | yes |
| `session/replay.ts` | `readFragment`, `writeFragment`, `decodeFragment` returning `{ ok, session } or { ok: false, failure }` | yes |
| `session/store.ts` | A reducer over `{ session, editing, open, arrivedByAnswer, failure }`, and the `useSession` hook that syncs the fragment | reducer yes |
| `session/path.ts` | `questionPath(kb, answers)`: replay the answers from an empty session to list the facts asked, in order | yes |
| `session/relevance.ts` | `relevantFacts(session)`, `skippedNotes(before, after, changedFact)` | yes |
| `session/progress.ts` | `progress(kb, answers, currentFact)` giving `{ index, moreAtMost }` | yes |
| `verdict/parts.ts` | `partsFrom(verdict)` for the `ProportionBar`; `ledgerFrom(verdict)` giving claimed, items, payable | yes |
| `verdict/statement.ts` | The headline statement and the state from the goal | yes |
| `screens/Start.tsx` | Start screen | no |
| `screens/Consult.tsx` | `QuestionCard`, `AnswersRail`, Back | no |
| `screens/Verdict.tsx` | Headline, bar, ledger, what-if, actions, "That is enough to decide" | no |
| `screens/Xray.tsx` | `XrayStage` wiring, the film content: `ProofTree`, `ClauseQuote` | no |
| `screens/Rulebook.tsx` | Clauses with citing rules, rules with their clause | no |
| `screens/Stale.tsx` | `StaleLinkNotice` wiring | no |
| `screens/NotFound.tsx` | 404 | no |
| `screens/LoadFailure.tsx` | The "rules failed to load" notice | no |
| `rulebook/coverage.ts` | `coverage(kb)` giving `{ byClause, byRule, missing }` | yes |

The pure modules carry the logic and are covered by Vitest and fast-check. The screens only connect them to the components.

### Routing

A fragment router with three routes, no library. Section 7 of the build plan puts routes in the hash so deep links work on static hosting:

| Fragment route (page at `/dead-certain/claim-check/`) | Screen |
| --- | --- |
| `#/` and `#/?r=<token>` | Start, question, verdict or stale-link notice, chosen by the session |
| `#/rulebook` and `#/rulebook?clause=<clause id>` | Rulebook |
| anything else | 404 |

The fragment holds the route and, on the check route, the replay token: `#/?r=<token>`. The rulebook route reads `clause` from its own query: `#/rulebook?clause=4.2`, and moves focus to the clause element with that id. Because routes live in the fragment, the page needs no server rewrite and no `404.html` on GitHub Pages. An unknown route renders `NotFound`.

## Components and Interfaces

### State: one reducer, one hook

```ts
interface ViewState {
  session: Session;
  /** The fact being changed, or null when the engine's next step is shown. */
  editing: string | null;
  /** The open proof, or null. */
  open: XrayTarget | null;
  /** True after an answer got the user to a verdict in this visit. */
  arrivedByAnswer: boolean;
  /** Set by a failed decode. Clears on Start. */
  failure: ReplayFailure | null;
  /** The last change, for the live region and skipped notes. */
  skipped: readonly SkippedNote[];
}

type Action =
  | { type: "start" }
  | { type: "answer"; fact: string; value: FactValue }
  | { type: "edit"; fact: string }
  | { type: "back" }
  | { type: "open"; target: XrayTarget }
  | { type: "close" }
  | { type: "restart" }
  | { type: "fragment"; hash: string };
```

The reducer calls `answer` from the engine and the pure helpers. It is deterministic and has no effects. `useSession` wraps it with two effects: write the fragment after every session change with `history.replaceState`, and listen to `hashchange` and dispatch `fragment`.

### Steps

`step(view)` is a pure selector with four results:

| Result | When |
| --- | --- |
| `{ kind: "start" }` | no answers, no failure, user has not pressed Start |
| `{ kind: "stale", failure }` | `view.failure` is set |
| `{ kind: "question", question, def, editing }` | `view.editing` is set, or `next(session)` returns a question |
| `{ kind: "verdict", verdict }` | `next(session)` returns a verdict and nothing is being edited |

When `editing` is set, the question shown is built from `kb.facts[editing]` with the fact's current answer as its value. The `Question` object comes from the engine's own question for that fact if `next` has asked it, and otherwise from `FactDef.ask`, `why` and the clause of the first rule that uses the fact (found by the pure helper `questionFor(kb, fact)`). If `FactDef.ask` is absent, the fact cannot be edited, and the rail renders its answer as text, not a button. This is a real case only for a malformed knowledge base, which `dc validate` rejects.

### The question path and Back

The engine does not return the list of questions asked, and an answer set has no order. The app finds the order by replay:

```ts
function questionPath(kb, answers): string[] {
  let s = start(kb);
  const path: string[] = [];
  for (;;) {
    const step = next(s);
    if (step.kind === "verdict") return path;
    path.push(step.fact);
    if (!(step.fact in answers)) return path;       // the open question is last
    s = answer(s, step.fact, answers[step.fact]);
  }
}
```

It ends because each loop answers one more fact, and the number of facts is finite. The result depends on the answers, not on the order the user gave them, so a reloaded Replay_Link shows the same Back sequence. Back sets `editing` to the fact before the current one in the path. Rail order is the same path, filtered to relevant answers.

Each pass costs one `next` call, and `next` computes in under 10 ms (engine benchmark). A path of at most a few dozen facts is negligible.

### Relevance and skipped notes

```ts
function relevantFacts(s: Session, currentFact?: string): Set<string>
```

For each goal in `kb.goals`, call `explain(s, goal)` and collect every proof node with `source === "answered"` whose fact has an answer in the session (the Engine marks an unanswered leaf `answered` too). Keep only the facts on `questionPath`: a proof names every fact its rules reference, even after an early stop made later answers unnecessary, and proof-only relevance never produced skipped notes. Add `currentFact`. An answered fact outside this set is not relevant.

`skippedNotes(before, after, changed)` compares the relevant sets before and after one answer. A fact relevant before and not relevant after, other than the changed fact, becomes a `SkippedNote` with `reason = "Not needed now that <label(changed)> is <printed value>."` A fact that becomes relevant again leaves the list. The list is held in `ViewState.skipped` and recomputed on every answer. It is reset on `start` and `restart`.

### Progress

`moreAtMost` = the count of facts in `kb.facts` that are not derived, have an `ask`, and have no answer in the session, minus one for the question being asked. It is an upper bound, because the engine may stop early. The bound is never wrong in the unsafe direction: the user never sees "Last question." and then another question. When the bound is 0 the card says "Last question." This matches the ui-kit's `progress` prop.

`index` is the 1-based position of the current fact in `questionPath`.

### Verdict screen

```text
VerdictScreen(verdict)
  state     = verdictStateFrom(verdict.goals[config.stateGoal], verdict.needed.length)
  claimed   = answers[config.claimedFact]      // minor units
  payable   = verdict.goals[config.amountGoal] // minor units
  items     = verdict.lineItems where role === "deduction" and value !== 0
  parts     = [{ kind: "paid", value: payable, label: "Paid" },
               ...items.filter(known).map(i => ({ kind: "cut", value: i.value, label: i.label }))]
```

- `statement` = `"<payable> of <claimed> will be paid"`, built with `formatMoney`.
- `ledgerFrom` passes `claimed`, `items` and `payable` to the kit's `Ledger`. The kit leaves out zero items. The app does not subtract anything.
- An item with `value === undefined` shows "Not yet known", which the kit's `Ledger` already supports, and is left out of `parts`.
- When `claimed` is absent or 0 the bar is omitted. This cannot happen after a verdict, since the claimed fact is needed to decide, but the guard avoids a divide by zero in the bar.
- A `WhatIfList` is shown only when `whatIf(session).length > 0`. Its `labelFor` and `defFor` come from `kb.ts`; `amountGoal` is `config.amountGoal`.
- "That is enough to decide" is shown while `arrivedByAnswer` is true and is cleared by any later navigation.
- Before `answer` is applied on the live session, `deductedAboveBill(answer(session, fact, value))` reads `next(...).lineItems` and refuses the answer when the known deductions exceed the claimed amount (requirement 3.15). It computes nothing the ledger shows.
- `usefulAlternatives` filters `whatIf(session)` to alternatives with a known payable amount and, for money facts, whole-unit values (requirement 7.2).
- The three actions are Buttons: "See why" (primary), "Copy link to this verdict", "Start over" (quiet).

### X-ray

```text
<XrayStage
  sheet={<VerdictSheet />}
  target={view.open}
  title={t => t.kind === "verdict" ? "Why" : `Why: ${labelFor(t.fact)}`}
  film={t => <FilmBody target={t} />}
  onClose={() => dispatch({ type: "close" })}
  rail={rail} />
```

`FilmBody` builds `explain(session, goalOrFact)`, where the fact is the state goal for `{ kind: "verdict" }` and the line item's fact for `{ kind: "line" }`. It renders `ProofTree` keyed by the target, with:

- `labelFor`, `formatValue` from `kb.ts`, using `formatValue(value, def, format)`.
- `ruleExpression(ruleId)` = `print(rule.to)` plus `when` when present, found in `kb.rules` by id. `print` is a value import from the engine, allowed in the app (the ui-kit rule against value imports applies only to `packages/ui`).
- `clauseFor(id)` from `kb.clauses`.
- `decidingClause` = the root node's `clause`.
- `onChangeAnswer(fact)` dispatches `close` then `edit`.
- `onEscape` = `onClose`. `XrayStage` restores focus to the opener.

`withPrintedBecause(node, session)` refills each node's `because` from the rule's template in `kb.rules` with `formatValue`, because the Engine fills `{fact}` with `String(value)`, which prints money as raw minor units ("16500000"). The Engine meets its own contract (inference-engine requirement 9.6) and has no currency or locale, so this stays in the app.

The same proof can show one fact twice: the verdict's proof has `total_deductions` under the outcome rule and again under `payable`, because the Engine returns a tree, not a graph, and gives each occurrence an equal subtree (inference-engine requirement 9.12). The app shows the tree as it is.

Below the tree, `ClauseRef` shows the deciding clause in the "deciding" variant with `mark` set only when a clause names a deciding sentence (open question 3). Without one, the whole clause carries the wax rule.

The develop, its 500 ms scan line, the 120 ms reduced-motion fade, the 200 ms panel and focus handling are all in `XrayStage` and `Film`. The app adds none. Requirement 8.12 is met by a guard in the selector: if `open` names a fact that is no longer a line item or goal, the reducer sets `open` to null after the answer.

### Replay

```ts
// fragment: "#/?r=<token>"
function readFragment(hash: string): string | null
function writeFragment(s: Session): void     // history.replaceState(null, "", url)
function decodeFragment(kb, hash): { ok: true; session: Session } | { ok: false; failure: ReplayFailure }
```

`decodeFragment` wraps `decode` in a try block:

| Thrown | Result |
| --- | --- |
| `EngineError` `KB_MISMATCH`, `MALFORMED_TOKEN`, `UNSUPPORTED_VERSION` | that code |
| any other `EngineError` | `MALFORMED_TOKEN` |
| anything else | `MALFORMED_TOKEN`; the message is never shown |
| no `r` in the fragment's query | `null` (start screen) |

`encode(session)` runs on every session change. The fragment is `#/` when there are no answers. `replaceState` is used so a change adds no history entry; the browser Back button leaves the app, and the in-app Back button moves through questions. The copy button calls `navigator.clipboard.writeText(location.href)` in a try block. On failure it shows the link in a readonly, selectable text field in the Machine voice with "Copy this link by hand."

The same token always replays to the same verdict: `decode` rebuilds the session, `next` and `explain` are deterministic, and the app adds no input of its own (no clock, no randomness, no storage).

### Rulebook page

```ts
function coverage(kb): {
  byClause: Record<string, Rule[]>;     // every clause id, possibly empty
  byRule:   Array<{ rule: Rule; clause: Clause | undefined }>;
  missing:  Rule[];                     // rules whose cite is not in kb.clauses
}
```

The page lists clauses in id order (natural numeric sort, so `4.10` follows `4.9`). Each clause shows its rules, or "Not used in any decision". A second section, "Rules and the clauses they cite", lists every rule with its clause. Rules in `missing` appear under "Cites a missing clause". Together the two lists show coverage both ways. A `{fact}` slot in a rule's sentence is drawn as a marked blank with the fact's label (requirement 9.2). "Open its proof" keeps the open view when the link's fragment equals the session's own fragment (requirement 9.9). A rule's "Open its proof" link appears only when the rule's `set` fact is a goal or a line item the engine can explain with the current session; otherwise the link is left out. With no answers, no proof can open, so the link is omitted and the sentence "Answer the questions to see this rule at work" is not added (YAGNI).

### 404 and load failure

`NotFound` shows "Page not found", one dry line ("This page was not in the policy either." is a candidate; the final line is the implementer's, under the copy rules), and two links. `LoadFailure` shows "The rules did not load. Reload the page." and nothing else.

### Page chrome

`AppShell` gets `appName="Claim Check"`, `nav` with the two entries and the rail on the check page. The footer keeps the kit's default line "No guesses were made in the production of this verdict." Print styles come from the kit; the app adds a print rule that hides the Back button, the actions and the rail.

## Data Models

```ts
// config.ts
export const config = {
  amountGoal: "payable",   // open question 1
  stateGoal: "outcome",    // values: "paid" | "reduced" | "denied"
  claimedFact: "claimed",
} as const;

// the only app-side types
type Step =
  | { kind: "start" }
  | { kind: "stale"; failure: ReplayFailure }
  | { kind: "question"; question: Question; def: FactDef; value: FactValue | undefined; editing: boolean }
  | { kind: "verdict"; verdict: Verdict };
```

All money is integer minor units until the moment `formatMoney` prints it. The app never parses a decimal itself; the kit's `moneyAnswer` converts the field's text to minor units.

## Error Handling

| Condition | Behaviour |
| --- | --- |
| KB JSON missing or malformed | `LoadFailure` notice. No blank page. |
| Invalid answer text | Message under the field from `ANSWER_MESSAGES`. No engine call. |
| `EngineError` `INVALID_ANSWER` or `NOT_ANSWERABLE` on submit | `externalError` on the card. Session unchanged. |
| Any other engine error on submit | The card shows "This answer could not be used. Check it and try again." Session unchanged. |
| Stale or damaged fragment | `StaleLinkNotice`. Fragment cleared on Start. |
| Clipboard refused | Link shown as selectable text. |
| Unknown route | 404 page. |
| Proof target gone after an answer | X-ray closes. |

No error shows an engine message or a stack. Copy says what happened and what to do, with no apology.

## Correctness Properties

*A property is a statement that holds for every valid input. These are tested with fast-check on the pure modules, using the real compiled knowledge base once Phase 2 delivers it, and a small test knowledge base in the meantime.*

### Property 1: The question path does not depend on answer order

*For any* complete answer set and any two orders of giving it, `questionPath` returns the same list.

**Validates: Requirements 3.12, 4.1, 10.4**

### Property 2: The path ends and asks nothing twice

*For any* answer set, `questionPath` ends, holds no fact twice, and holds only facts the Engine asked.

**Validates: Requirements 3.14, 5.5**

### Property 3: Replay round trip

*For any* session reached by valid answers, `decodeFragment(kb, "#/?r=" + encode(session))` returns a session whose `next` result equals the original's.

**Validates: Requirements 10.1, 10.3, 10.4**

### Property 4: A damaged fragment never produces a verdict

*For any* string used as a fragment, `decodeFragment` returns a session or one of the three `ReplayFailure` codes. It never throws and never returns a failure outside those three.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

### Property 5: The ledger adds up

*For any* verdict from the knowledge base, the claimed amount minus the sum of the deduction rows shown equals the payable amount, and the proportion bar's parts sum to the claimed amount.

**Validates: Requirements 6.3, 6.4, 6.5**

### Property 6: Relevance is stable

*For any* session, a fact in `relevantFacts` is answered or is the current question, and `relevantFacts` is the same for two sessions with the same answers.

**Validates: Requirements 4.1, 4.5, 4.6**

### Property 7: Changing an answer and changing it back restores the view

*For any* session and any answered, relevant fact, answering it with another valid value and then with the original value returns the original `next` result, rail list and skipped notes.

**Validates: Requirements 4.4, 4.6, 4.7**

### Property 8: Coverage is complete both ways

*For any* knowledge base, every clause appears in `byClause`, every rule appears in `byRule`, and a rule is in `missing` exactly when its cite is not in `clauses`.

**Validates: Requirements 9.2, 9.3, 9.4, 9.5**

### Property 9: Progress never lies the unsafe way

*For any* consultation answered to the end, at every question the number of questions still to come after it is at most `moreAtMost`, and `moreAtMost` is 0 only when the verdict follows this answer.

**Validates: Requirement 3.4**

## Testing Strategy

| Layer | Tool | What |
| --- | --- | --- |
| Pure modules | Vitest | `replay`, `path`, `relevance`, `progress`, `parts`, `statement`, `coverage` against a small fixture knowledge base |
| Properties | Vitest and fast-check 4.10.2, files `*.props.test.ts`, at least 100 runs, each tagged `// Feature: claim-check-app, Property N: <title>` | Properties 1 to 9 |
| Screens | Playwright, against the built app | Behaviour of each screen. No jsdom, no Testing Library |
| Golden | Playwright, generated from `golden/*.yaml` through the kb-tools loader | One test per scenario (Requirement 15) |
| Accessibility | `@axe-core/playwright` | Zero violations per screen at 390, 768, 1280 |
| Budgets | A build-size test, a layout-shift check in Playwright, a step benchmark | Requirement 13.7 to 13.9 |
| Engine refusals | Vitest | `INVALID_ANSWER` and `NOT_ANSWERABLE` are tested at the reducer, because the kit's controls cannot produce a value the Engine rejects (requirement 3.6) |
| X-ray rows | Playwright | Rows are found by the rule ids shown and the "You answered" badges, not by position |
| CI | GitHub Actions | `pnpm dc build apps/claim-check` runs before `pnpm check` (requirement 14.6). `lanes.test.ts` runs only in CI (14.7) |

### The golden e2e

A single file `e2e/claim-check-golden.spec.ts` loads `apps/claim-check/golden/*.yaml` with `loadGolden`, then calls `test(...)` once per scenario. The test:

1. Opens the app and activates "Start the check".
2. Loops: reads the heading of the current question, finds the fact it belongs to through the label of the fact's definition, and enters that fact's value from the scenario with the control for its type. Facts the scenario gives but the app never asks are not entered (the engine may not need them).
3. Stops when a verdict or the expected question appears.
4. Checks the headline state word, the statement, the ledger rows and the payable amount against the scenario's `expect`, with every expected string built by `formatMoney` from the scenario's minor units.
5. Opens "See why" and checks that each id in `fires` is in the proof tree, expanding nodes by keyboard as needed.
6. Copies the Replay_Link, opens it in a second page and checks the same verdict.

A scenario whose `facts` the app asks in a different order is fine, because the loop answers whichever fact the app asks. A scenario that asks a fact the scenario does not give fails with a message naming the fact. A scenario with `mode: audit` is skipped with a visible reason, because Claim Check runs consultation mode only. The skip count is printed, and the suite fails if no consult scenario exists.

The test needs a way to find a field's fact from the screen. The kit's `QuestionCard` labels the field with the question text, so the test maps `FactDef.ask` text to the fact. A duplicate `ask` text in the knowledge base is reported as an error by the test.

### Evidence

Every task ends with Task_Evidence: screenshots at 390, 768 and 1280 px (attached to the pull request, not committed), a clean console, zero axe violations and `pnpm check` output.

## Design decisions

| Decision | Alternatives | Why this one |
| --- | --- | --- |
| Hash routes, with the token in the check route's query (`#/?r=<token>`) | Path routes with a `404.html` copy | Section 7 of the build plan puts routes in the hash so deep links work on static hosting. One fragment carries both. |
| `history.replaceState` on every change | `pushState` | Back would walk through dozens of intermediate states. The app has its own Back. |
| Replay the answers to get the question order | Store the order in the token | The token is the engine's. Replaying needs no new field and keeps the same link giving the same Back path. |
| Keep irrelevant answers in the session | Prune them | Pruning would lose an answer when the user changes a decision back. Property 7 depends on keeping. |
| Progress as an upper bound | Exact count | The engine exposes none, and an exact count needs a second engine run per fact. |
| No state library | Redux, Zustand | One reducer is enough. It also avoids a dependency outside the list. |
| Golden tests drive the real interface | Run the engine in the test | The engine is already proved by `dc golden`. These tests prove the interface agrees with it. |
