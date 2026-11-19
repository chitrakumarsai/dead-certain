# Design Document: pre-flight-app

## Overview

Pre-Flight (`apps/pre-flight`, package `@dead-certain/pre-flight`) is a React single-page app that audits a public GitHub repository against a checklist. It has two halves with a hard seam between them.

- **The collector** (`apps/pre-flight/collectors`) does the network and the parsing. It turns four GitHub REST responses into a `RepoSnapshot`, then a pure function turns the snapshot into facts and evidence lines. It is written test-first against recorded responses.
- **The report** (`apps/pre-flight/src`) feeds those facts, and the user's inline answers, to the engine's `audit`, and renders the verdict with `@dead-certain/ui`.

The engine and the kit are used as they are. Nothing here changes `packages/ui` or `packages/engine/src/types.ts`. The app decides nothing: pass or fail comes from `audit`, the sentence behind it from `explain`.

This spec is implemented by the Claude Code lane. Kiro writes the spec only.

### Findings from reading the repo

| Finding | Consequence |
| --- | --- |
| `apps/pre-flight/` does not exist, and neither do its `kb/`, `rulebook/`, `golden/` or `collectors/`. `templates/` does not exist, so `pnpm new-app` cannot run. | Task 1 scaffolds the app by hand from `apps/site`. Tasks that need the knowledge base stop if it is absent. |
| `explain` never returns `source: "collected"`. The engine has no way to know where a fact came from, so every non-derived fact comes back as `"answered"`. | The app relabels sources itself (`relabelSources`, below). The kit's `SourceBadge` already shows "Collected". |
| `Session` is `{ kb, answers }`, with no marker for collected facts. `audit` takes a flat `facts` record. | The app builds `{ kb, answers: facts }` for `explain` and keeps its own set of collected fact names. |
| `LineItem` has no group, severity or evidence. `FactDef` has `role` and `label` only. | Groups and severity are app-side data in `checklists.ts`, checked against the knowledge base at start-up. Evidence comes from the collector. Open questions 1 and 2. |
| `CheckRow` takes `item`, `detail`, `question`, `def`, `answerValue`, `onAnswer`, `onOpen`. It asks inline only when `def` is boolean. It prints the state word, the label, the rule id as the "See why" button, and `detail` in the Machine voice. | The report maps each check to one `CheckRow`. Non-boolean questions go in a separate "Needs your answer" list built from `AnswerControl`. |
| `VerdictHeadline` has `size="summary"` (36/44 at every width) and a state of `ready`, `not_ready` or `undecided`. `verdictStateFrom` maps the strings `ready` and `not_ready`. | The knowledge base's single goal must have exactly the values `ready` and `not_ready`. That is settled. |
| `XrayStage`, `ProofTree`, `SourceBadge`, `ClauseQuote` and `AnswersRail` exist. The develop, its reduced-motion fade and focus return live in `XrayStage`. | The app builds no motion. It builds the film content and the target. |
| The build plan routes by URL hash and lets the check route carry a token. | Pre-Flight routes by hash too: `#/` and `#/report?...`. |
| `@dead-certain/kb-tools` has the golden loader. Phase 2 writes pre-flight golden scenarios in audit mode. | The app's e2e does not read them. They prove the engine, not the interface. The e2e expectation files are per snapshot (requirement 13.2). |

## Architecture

```mermaid
graph TD
    subgraph Build["Build time"]
        KB[kb/*.yaml] -->|pnpm dc build| JSON[compiled KB JSON]
        REC[record script, human runs] -->|4 requests per repo| RAW[collectors/recorded/*.json]
        REC --> SNAP[collectors/snapshots/*.json]
    end
    subgraph Collectors["apps/pre-flight/collectors (pure + injected fetch)"]
        PARSE[parseTarget]
        COLLECT["collect(target, deps)"]
        DERIVE["deriveFacts(snapshot, kb)"]
        COLLECT --> SNAPSHOT[(RepoSnapshot)]
        SNAPSHOT --> DERIVE
    end
    subgraph App["apps/pre-flight/src"]
        START[Start screen] --> PARSE
        START -->|route| RUN[run controller]
        RUN --> COLLECT
        RUN -->|sample or fallback| SNAP
        DERIVE --> AUDIT["audit(kb, facts + answers)"]
        AUDIT --> REPORT[Report]
        REPORT --> UI[@dead-certain/ui]
        AUDIT --> EXPLAIN[explain -> relabelSources -> ProofTree]
        REPORT --> MD[toMarkdown]
    end
    API[(api.github.com)] --> COLLECT
    JSON --> AUDIT
    RAW -.->|tests, e2e routing| COLLECT
```

Live data and snapshots meet at `RepoSnapshot`. After that point there is one code path: `deriveFacts`, then `audit`. A bundled snapshot is a stored `RepoSnapshot`, so a sample report and a live report differ only in where the snapshot came from.

### Modules

| Module | Responsibility | Pure? |
| --- | --- | --- |
| `collectors/target.ts` | `parseTarget(text)` returns `{ ok: true, target } or { ok: false, reason }` | yes |
| `collectors/types.ts` | `Target`, `RepoSnapshot`, `StepEvent`, `CollectError`, `CollectDeps` | yes |
| `collectors/collect.ts` | `collect(target, deps)`: four requests, progress events, error classification | no (fetch injected) |
| `collectors/parse.ts` | Field-by-field validation of each response body into the snapshot's types | yes |
| `collectors/derive.ts` | `deriveFacts(snapshot, kb)` giving `{ facts, evidence, unseen }` | yes |
| `collectors/extractors.ts` | The table `fact name -> (snapshot) => { value, evidence } or undefined`. Names facts. | yes |
| `collectors/gitignore.ts` | `ignores(text, path)` for the one question "is this path ignored", with the line number | yes |
| `collectors/recorded/*.json` | Real API responses with URL, status, a safe subset of headers and body | data |
| `collectors/snapshots/*.json` | The three bundled snapshots | data |
| `collectors/record.ts` | The recording script. Run by a human. Task 2 writes `recorded/` only. Task 18 adds `snapshots/`, because a snapshot needs the collector | no |
| `src/main.tsx` | Mount, hash router, `AppShell`, load the knowledge base | no |
| `src/kb.ts` | Import the JSON, shape check, `labelFor`, `defFor`, `clauseFor`, `ruleExpression` | yes |
| `src/checklists.ts` | `GOAL`, the name of the knowledge base's single goal, and the Checklist: title, groups, checks with severity. With `extractors.ts`, the only file that names facts. | yes |
| `src/run/controller.ts` | A reducer for the run: `idle`, `collecting`, `error`, `report` | reducer yes |
| `src/report/audit.ts` | `buildReport(kb, checklist, snapshotFacts, answers)` giving the view model | yes |
| `src/report/summary.ts` | The state and the sentence | yes |
| `src/report/evidence.ts` | `evidenceFor(proof, evidence)` | yes |
| `src/report/sources.ts` | `relabelSources(proof, collectedFacts)` | yes |
| `src/report/questions.ts` | `questionFor(check, proof, needed)`, and the list of non-inline questions | yes |
| `src/report/markdown.ts` | `toMarkdown(report)` and `escapeMd`, `codeSpan` | yes |
| `src/screens/*.tsx` | Start, Steps, Report, Xray, Errors, LoadFailure | no |

Pure modules carry the logic and are covered by Vitest and fast-check. Screens only connect them to the kit.

## Components and Interfaces

### Routing

| Fragment route | Screen |
| --- | --- |
| `#/` and anything unknown | Start |
| `#/report?repo=<owner/name>` | Run a live collection for the target, then the Report |
| `#/report?sample=<id>` | Report from a bundled snapshot, no request |

Reloading a live report runs the collection again. That costs four requests. The reload is a deliberate act and the rate-limit fallback exists for it. The user's inline answers are not in the fragment and do not survive a reload (requirement 6.7).

### Target parsing

```ts
interface Target { owner: string; name: string }
type ParseResult = { ok: true; target: Target } | { ok: false; reason: "empty" | "not_github" };

function parseTarget(input: string): ParseResult
```

Steps, in order: trim; empty gives `empty`. If the text contains `://` or starts with `github.com/` or `www.github.com/` (any case), parse the URL (adding `https://` when absent). Require scheme `http` or `https` and host `github.com` or `www.github.com`, with the host read from the text as typed, up to the first `/`, `?`, `#` or `\`, and compared without regard to case. A port or credentials therefore fail, even where `new URL` would drop a default port. Take the first two path segments. The owner and name keep the case the user typed. Otherwise require exactly `owner/name` (one slash, no more). Strip a `.git` suffix from the name. Validate owner against `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$` and name against `^[A-Za-z0-9._-]{1,100}$` and not `.` or `..`. Anything else gives `not_github`. The function never throws and never reads the network.

Strict validation is the injection defense. A validated owner and name contain no `/`, `?`, `#` or `%`, so the request URL cannot be bent to another path. The collector still percent-encodes (belt and braces).

### The collector contract

```ts
interface CollectDeps {
  fetch: typeof fetch;                 // injected; never the global inside collect
  now: () => Date;                     // injected clock
  onStep: (event: StepEvent) => void;  // real progress only
  timeoutMs?: number;                  // default 10_000
}

type StepId = "metadata" | "tree" | "gitignore" | "readme";
type StepEvent =
  | { step: StepId; status: "reading" }
  | { step: StepId; status: "done" | "not_found" | "failed" };

type CollectError =
  | { kind: "not_found" }                              // metadata 404
  | { kind: "rate_limited"; resetAt?: number /* epoch seconds */ }
  | { kind: "unreachable" }                            // fetch rejected, timeout, abort
  | { kind: "unreadable" };                            // other status, bad JSON, failed field check

type CollectResult =
  | { ok: true; snapshot: RepoSnapshot }
  | { ok: false; error: CollectError; steps: Record<StepId, StepStatus> };

function collect(target: Target, deps: CollectDeps): Promise<CollectResult>
```

```ts
interface RepoSnapshot {
  version: 1;
  target: Target;
  takenAt: string;                       // ISO, from deps.now()
  metadata: {
    fullName: string; defaultBranch: string; private: boolean; archived: boolean;
    description: string | null;          // used only by extractors that need it
    license: { spdxId: string | null } | null;   // GitHub's own detection
    size: number; pushedAt: string | null;
  };
  tree: { entries: { path: string; type: "blob" | "tree" }[]; truncated: boolean; empty: boolean };
  gitignore: { text: string; clipped: boolean } | null;   // null = absent
  readme: { text: string; clipped: boolean; name: string } | null;
  rate?: { remaining: number; resetAt: number };           // from the last response
}
```

Request plan (each with `Accept: application/vnd.github+json` for JSON, `application/vnd.github.raw+json` for the two file bodies, `X-GitHub-Api-Version: 2022-11-28`, `credentials: "omit"`, `cache: "no-store"`, an `AbortSignal` from an `AbortController`):

| Step | Request | 200 | 404 | 409 | other |
| --- | --- | --- | --- | --- | --- |
| metadata | `GET /repos/{o}/{n}` | parse, require `private === false` | `not_found` | n/a | classify |
| tree | `GET /repos/{o}/{n}/git/trees/{branch}?recursive=1` | parse entries, `truncated` | tree absent: empty tree | empty repository: `empty: true` | classify |
| gitignore | `GET /repos/{o}/{n}/contents/.gitignore` | raw text, clip at 65,536 bytes | `null` (absent) | n/a | classify |
| readme | `GET /repos/{o}/{n}/readme` | raw text, clip | `null` | n/a | classify |

**Timeout.** Each request has its own `AbortController` and a `setTimeout` of `timeoutMs`. When the timer fires it aborts the signal and rejects a race against the request, so a `fetch` that ignores the signal still ends `unreachable` at `timeoutMs`. The timer cannot be driven by the injected `now`, so tests of the timeout use Vitest's fake timers.

**Step results.** A `.gitignore` or README 404 ends its step as `not_found` and the run goes on. A tree 404 gives `{ entries: [], truncated: false, empty: false }` and the step is `done`. A 409 gives the same with `empty: true`. An unexpected exception inside `collect` is caught and returned as `unreadable`; `collect` never rejects.

The first request runs alone. The tree needs `default_branch`. Then the tree, `.gitignore` and README requests are sent one after another, so the step list shows an honest order and a failure stops the run with the later steps "Not run". Four sequential requests over HTTP/2 take well under a second each.

**Classification** (used by every step, in one function `classify(response)`):

1. A response with status 429, or status 403 with header `x-ratelimit-remaining: 0`, or a `retry-after` header on a 403, is `rate_limited`. `resetAt` comes from `x-ratelimit-reset` (epoch seconds) when it parses as a positive integer, else from `retry-after` seconds added to `now()`, else absent.
2. A 404 is `not_found` for metadata, and "absent" for the other three.
3. A fetch that rejects, an abort or a timeout is `unreachable`.
4. Any other non-2xx status, a body that is not JSON, or JSON that fails the field check is `unreadable`.

A private repository returns 404 to an unauthenticated request, so it falls under rule 2 with no extra case. A metadata body with `private: true` cannot occur without a token, and if it does it is treated as `not_found`.

**Response shape.** `parse.ts` works on `RawResponse { status: number; headers: Record<string, string> /* lower-case names */; body: string }`. The recorded files map onto it directly, and `collect` converts a `fetch` Response into it. The classifier is `classify(step, response, now)`: the step tells it whether a 404 is `not_found` (metadata) or absent, and whether a 409 is an empty tree. It returns `ok`, `absent`, `empty` or a `CollectError`. The README's raw response carries no file name, so `collect` sets `readme.name` from the root README entry of the tree, and to `README` when the tree is truncated or holds none.

**Field checks** (`parse.ts`) read each used field with a type guard. A wrong type is `unreadable`, never a coerced value. Strings from GitHub are clipped when stored (paths 1,024 characters, descriptions 500). Tree entries keep `path` and `type` only. Submodule entries (`commit`) are skipped. The tree is capped at 100,000 entries (GitHub's own limit for `recursive=1`), and a longer one keeps the first 100,000 and is marked truncated. A `default_branch` that is empty or holds a lone surrogate, and a `size` that is negative or not finite, are `unreadable`, so URL encoding cannot throw. Nothing from the body is ever interpreted as code or markup.

**Rate-limit bookkeeping.** `rate.remaining` and `rate.resetAt` are read from the last response's headers. They are stored in the snapshot but never trigger a request.

### From snapshot to facts

```ts
interface Derived {
  facts: Record<string, FactValue>;      // collected, typed
  evidence: Record<string, string>;      // fact name -> one Evidence_Line
  unseen: string[];                      // non-derived facts left out
}
function deriveFacts(snapshot: RepoSnapshot, kb: KnowledgeBase): Derived
```

`extractors.ts` is a table keyed by fact name:

```ts
interface Extractor {
  reads: "metadata" | "tree" | "gitignore" | "readme";   // "tree": a truncated tree makes the fact unseen
  read: (s: RepoSnapshot) => { value: FactValue; evidence: string } | undefined;
}
const EXTRACTORS: Readonly<Record<string, Extractor>>;
```

`deriveFacts(snapshot, kb, extractors = EXTRACTORS)` takes the table as an optional third argument, so a test can pass its own.

Return `undefined` when the snapshot cannot say (for example, any tree-based fact when `tree.truncated`). `deriveFacts` then:

1. loops over the knowledge base's non-derived facts;
2. runs the extractor if there is one; keeps the value only when its type matches the fact's type (a boolean fact gets a boolean, an enum fact an option);
3. otherwise adds the fact to `unseen`.

Examples of extractors the knowledge base will need (names are placeholders until Phase 2): a license file exists at the root, from GitHub's own license detection plus a root `LICENSE*` path ("LICENSE not found at the root"); `.kiro` exists at the root as a directory; `.kiro` is not ignored, from `ignores(gitignore.text, ".kiro/")` returning the matching line ("`.gitignore` line 12: `.kiro/`"); a README exists. A fact such as "the demo video is under 3 minutes" has no extractor and is always asked.

`ignores` is deliberately narrow: it answers one question for one path, by reading `.gitignore` lines with the gitignore rules a root file needs (comments, blank lines, trailing slash for directories, leading slash anchoring, `!` negation, `*` and `**` globs). It returns `{ ignored: boolean; line?: number; text?: string }`. A construct it does not understand makes the extractor return `undefined`, so the fact is asked and not guessed. This keeps the "never guess" rule of requirement 3.16.

**The real table (task 6).** The knowledge base existed when task 6 ran, so `extractors.ts` holds the real extractors, one for each collected fact of `apps/pre-flight/kb`, and no test table exists. `demo_video_seconds` has none and is always asked. The meanings follow the facts' `ask` text and `kb/open-questions.md`:

- `license_detected` is false when GitHub reports no licence or `NOASSERTION` (question 1).
- `kiro_dir_has_file` counts a file anywhere under `.kiro/` (question 3).
- `gitignore_ignores_kiro` follows requirement 3.21 (question 4). The six lines are compared as text after trailing spaces are removed; the matcher is then asked about `.kiro/` and `.kiro/x`, and a disagreement makes the fact unseen.
- `readme_has_run_heading` follows requirement 3.22 (questions 6 and 7). The README is whatever file the tree names as the root README.

The "today" case: the knowledge base declares no such fact (requirement 3.23). If it ever declares a date fact the app supplies, `extractors.ts` reads it from the snapshot's `takenAt`, so that an audit of a stored snapshot is the same on any day.

### The audit

```ts
function buildReport(input: {
  kb: KnowledgeBase; checklist: Checklist; snapshot: RepoSnapshot;
  derived: Derived; answers: Record<string, FactValue>;
}): ReportView
```

Steps:

1. `facts = { ...answers, ...derived.facts }`. Collected values win (requirement 6.9).
2. `verdict = audit(kb, facts)`.
3. For each check in the checklist's groups, find the `LineItem` with `item.fact === check.fact`. A check missing from `lineItems` is an invariant failure that the start-up check should have caught. It renders as unknown.
4. For each check: `proof = explain({ kb, answers: facts }, check.fact)`, then `relabelSources`, then `evidenceFor`.
5. Build the summary from the goal's value (`verdict.goals[GOAL]`) and the failed checks' severities.

`audit` and `explain` are both called on every change. Each is under 10 ms (engine benchmark), and a checklist has about twenty checks, so a change takes under about 50 ms, which is not perceived as loading.

### Source relabelling

```ts
function relabelSources(node: ProofNode, collected: ReadonlySet<string>): ProofNode
```

Walks the tree. A node with `source: "answered"` becomes `"collected"` when its fact is in `collected` (the keys of `derived.facts`). All other nodes are copied unchanged. The function is pure and returns a new tree. The kit's `ProofTree` then shows "Collected" or "You answered" correctly. The `collected` set is the set of fact names, not the answers record, so a user answer for a fact that the collector also read is shown as "Collected" (requirement 6.9, 7.4).

### Evidence

`evidenceFor(proof, evidence)` collects the leaves of the proof with `source === "collected"`, takes `evidence[fact]` for each, drops missing and repeated lines, keeps the tree order, and joins with a line break. The line is a plain string. For paths, the kit's `CheckRow` already sets `detail` in the Machine voice.

### Summary

```ts
function summarize(goalValue, checks: CheckView[] /* the checklist */, repo: string): { state: VerdictState; sentence: string }
```

- `state = verdictStateFrom(goalValue, needed)`.
- `not_ready`: count failed checks with severity blocker and warning from `checks`. Sentence "2 blockers and 1 warning in owner/name"; a zero part is dropped; "1 blocker".
- `ready`: "All 14 checks passed in owner/name".
- `undecided`: "3 checks need your answer in owner/name".

The counts only count failed rows that the engine already decided. The state and the sentence's shape come from the goal.

There is one goal and one checklist that holds every check, so the state is always the goal's and the counts cover every check.

### Inline questions

For each check with `item.value === undefined`:

```ts
function questionFor(check, proofLeaves, needed: readonly Question[], defs): Question | undefined
```

Take the first question in `verdict.needed` whose `fact` is a leaf of the check's proof. If its `FactDef.type` is boolean, pass `question`, `def` and `answerValue` to `CheckRow`, with `onAnswer` dispatching `answer`. A needed question that no check owns, or whose type is not boolean, goes in the "Needs your answer" list under the groups, with `AnswerControl` and the question text as its label.

`answer` stores `{ fact, value }` in the run's `answers` and calls `buildReport` again in the same render. There is no async step, so the Summary and rows change together. The live region announces the new Summary sentence.

The answers rail (`AnswersRail`) lists `answers` as "Your answers". `onChange(fact)` sets `reopened = fact`. While `reopened` is set, the row whose proof contains that fact shows its question again with `answerValue` set. Submitting clears `reopened`.

### Run controller and steps

```ts
type Run =
  | { phase: "idle" }
  | { phase: "collecting"; target: Target; steps: Record<StepId, StepStatus> }
  | { phase: "error"; target?: Target; error: CollectError; steps: Record<StepId, StepStatus> }
  | { phase: "report"; snapshot: RepoSnapshot; origin: "live" | "snapshot"; answers: Record<string, FactValue>; reopened?: string };
```

`StepStatus` is `"waiting" | "reading" | "done" | "not_found" | "failed" | "not_run"`. The controller moves a step to `reading` on `onStep({status:"reading"})` and to its final status on the final event. Nothing else changes a step. The steps list renders `steps` and nothing is animated except the kit's own focus and press styles. Real elapsed time is not shown (YAGNI); the list is the progress.

The Report appears when `collect` resolves with `ok: true`. To avoid layout shift, the steps list and the Report share a container whose minimum height is the steps list's height until the Report mounts.

A stale run must not overwrite a newer one: each run gets an incrementing id, and the controller ignores events with an older id. The run's `AbortController` aborts when the route changes.

### Errors

| `CollectError` | Heading and body | Actions |
| --- | --- | --- |
| `not_found` | "This repository is private or does not exist. Pre-Flight reads public repositories only." | "Check another repository" |
| `rate_limited` | "GitHub's limit for this browser is used up." + "Try again after 14:32." (or "Try again in about an hour.") | Sample buttons; and, when the target matches a bundled snapshot, "Use the snapshot of owner/name taken <date>" |
| `unreachable` | "Pre-Flight could not reach GitHub. Check your connection and try again." | "Try again" |
| `unreadable` | "GitHub sent a response Pre-Flight could not read. Try again later." | "Try again" |

Each error screen keeps the steps list above it, with the failed step marked. The time is formatted from `resetAt` with `Intl.DateTimeFormat` in the user's locale. GitHub's own message text is never read, so it cannot be shown. Focus goes to the error heading, and the polite live region announces it.

### Bundled snapshots and the fallback

`collectors/snapshots/` holds three `RepoSnapshot` JSON files and an index: `{ id, target, takenAt, title }`. They load through `import()` so Vite puts them in their own chunk. Rules:

- A sample button routes to `#/report?sample=<id>`. The controller loads the snapshot and goes straight to `report` with `origin: "snapshot"`. No request is made.
- The rate-limit error offers the same route when the failed target matches a snapshot's target.
- The app never swaps a failed live run for a snapshot silently (requirement 9.6).
- The Report for a snapshot shows "Using a snapshot of owner/name taken <date>." and "Snapshot taken <date>" in place of "Checked <time>".
- `pnpm record:snapshots` (a root script added by the Claude Code lane) runs `collectors/record.ts` with `node --experimental-strip-types`, so no TypeScript runner is added. The script writes the raw responses to `recorded/`. From task 18 it also builds each snapshot with the collector and writes it to `snapshots/`. Only a human runs it.

Snapshot choice (answered by the human, 2026-11-18): this repository (shows `.kiro` present and not ignored), `chitrakumarsai/dc-sample-not-ready` (fails R-02, R-04, R-05 and R-06) and `chitrakumarsai/dc-sample-warnings` (fails only the warnings R-06 and R-07). Together they should show ready, not ready, and a repository where one fact is unseen and asked. Task 18.1 checks that against the recorded data.

### X-ray

```text
<XrayStage
  sheet={<Report />}
  target={open}                    // { kind: "line"; fact: <check fact> } | null
  title={t => `Why: ${labelFor(t.fact)}`}
  film={t => <FilmBody fact={t.fact} />}
  onClose={close} />
```

`FilmBody` calls `explain({ kb, answers: facts }, fact)`, then `relabelSources`, and renders `ProofTree` keyed by the fact, with `labelFor`, `formatValue`, `ruleExpression` (using `print`), `clauseFor`, `decidingClause` (the root node's `clause`) and `onChangeAnswer` set only for answered facts: the callback is built to be a no-op for collected facts, and the tree's "Change this answer" button appears only where the node's source is `"answered"`, which after relabelling means the user's own answers. Evidence lines are shown beside collected leaves. This is done with the tree's own `formatValue` hook: for a collected fact it returns the printed value, and the evidence appears as a `detail` paragraph under the tree, grouped by fact (the kit has no per-node slot, and the app does not edit the kit). The grouped list is headed "Evidence" and uses the Machine voice.

The develop, the sheet presentation below 1280 px, the reduced-motion fade and the focus return are all inside `XrayStage`. Answering while the film is open updates `facts` and the film re-renders with the new proof (requirement 7.13).

### Markdown export

```ts
function toMarkdown(report: ReportView): string
```

Output shape:

```text
# 2 blockers and 1 warning in owner/name

Checklist: Submission checklist
Checked 14:02

## Repository

- Passed: Public repository (`R-01`)
- Failed: License file GitHub can detect (`R-02`)
  - `LICENSE not found at the root`

## Kiro usage

- Needs your answer: Is the demo video under 3 minutes? (`R-09`)

Checked with Pre-Flight.
```

- Text from the knowledge base (labels, group names, checklist title) goes through `escapeMd`, which backslash-escapes `\ ` * _ { } [ ] ( ) # + - . ! | < > ~` and `&`, and replaces a line break with a space.
- Text from GitHub (paths, `.gitignore` lines, `owner/name`) goes in a code span: the span uses a fence of backticks one longer than the longest run inside, padded with a space when the text starts or ends with a backtick, and line breaks become spaces. A repository name cannot hold a backtick, but a path can.
- No HTML, no emoji, no links, no images.
- The text is a pure function of the report. The clock is read once, at collection, not at export.

Copy uses `navigator.clipboard.writeText` in a try block; failure shows a read-only `<textarea>` with the text selected and "Copy this text by hand."

### Page chrome

`AppShell` with `appName="Pre-Flight"`, one nav entry, the kit's default footer, and a rail only on the Report, holding "Your answers" when there are any. Print styles hide the rail and the buttons. The footer line is the kit's.

## Data Models

```ts
// checklists.ts (open questions 1 and 2: names are filled in from the knowledge base)
export const GOAL: string;           // kb.goals[0]; values "ready" | "not_ready"
interface CheckSpec { fact: string; severity: "blocker" | "warning" }
interface GroupSpec { title: string; checks: readonly CheckSpec[] }
interface Checklist {
  title: string;
  groups: readonly GroupSpec[];
}
export const CHECKLIST: Checklist;
```

Start-up validation (`validateChecklists(kb)`, pure): `kb.goals` holds exactly one goal and it equals `GOAL`, every fact with `role: "check"` appears in exactly one group of the checklist, and every listed fact exists and has `role: "check"`. A failure shows the load-failure notice and names the fact in the console in development only.

All money is absent; this app has no currency. Dates print with `formatDate` from the kit.

## Error Handling

| Condition | Behaviour |
| --- | --- |
| Knowledge base or checklist mismatch | `LoadFailure` notice |
| Bad repository text | Message under the field, no request |
| Metadata 404 | "Private or does not exist" screen |
| Rate limit | Reset time (or an hour), samples, and a snapshot offer when one matches |
| Unreachable, timeout, abort by navigation | "Could not reach GitHub" (an abort by navigation shows nothing) |
| Other status, bad JSON, field check failure | "Could not read" screen |
| `.gitignore` or README 404 | Not an error. File recorded as absent. |
| Tree truncated | Tree facts become questions. A note under the Summary: "GitHub returned a partial file tree, so some checks ask you instead." |
| Empty repository | Empty tree. Checks fail on their own rules. |
| `audit` or `explain` throws `EngineError` | The Report shows "Pre-Flight could not run the checks on this data." and a "Try again" button. The raw message is never shown. This is a defect signal, and the Report keeps the steps. |
| Clipboard refused | Read-only text area |

## Correctness Properties

*A property holds for every valid input. These are checked with fast-check on the pure modules, against the real knowledge base once Phase 2 delivers it and a small test knowledge base before then.*

### Property 1: Target parsing is total and normalises

*For any* string, `parseTarget` returns a result and never throws. *For any* valid owner and name, every accepted form of that repository (plain, with a host, with a scheme, with `.git`, with a trailing slash, with a subpath, with surrounding spaces) returns the same Target.

**Validates: Requirements 2.3, 2.4, 2.5, 2.6**

### Property 2: A parsed Target cannot bend a URL

*For any* string that `parseTarget` accepts, the owner and name contain none of `/`, `?`, `#`, `%`, `\`, whitespace or a control character, and the four request URLs built from it start with `https://api.github.com/repos/` and contain no extra path segment.

**Validates: Requirements 3.2 to 3.6**

### Property 3: Derivation is pure and typed

*For any* snapshot, `deriveFacts` called twice returns equal results, returns only non-derived facts of the knowledge base, gives each a value of its declared type (and an option for an enum), and puts every non-derived fact it does not return in `unseen`.

**Validates: Requirements 3.14, 3.15, 3.16**

### Property 4: Nothing is guessed from a truncated tree

*For any* snapshot with `tree.truncated` true, no fact whose extractor reads the tree appears in `facts`, and each is in `unseen`.

**Validates: Requirement 3.9**

### Property 5: The gitignore matcher agrees with its own evidence

*For any* `.gitignore` text and path, when `ignores` reports `ignored: true` with a line, that line exists in the text and is not a comment, a blank line or a negation, and when it reports an unsupported construct the extractor returns `undefined`.

**Validates: Requirements 3.14, 3.16**

### Property 6: Collected values win and answers do not leak

*For any* collected facts and answers that overlap, `buildReport` uses the collected value, and removing an answer the engine does not need leaves every check unchanged.

**Validates: Requirements 6.8, 6.9**

### Property 7: Relabelling changes sources only

*For any* proof tree and set of collected facts, `relabelSources` returns a tree with the same shape, facts, values, rules and clauses, in which every node that was `"answered"` is `"collected"` exactly when its fact is in the set, and no node is `"derived"` that was not.

**Validates: Requirements 7.4, 7.8**

### Property 8: The summary is the engine's, not the app's

*For any* report view, the Summary state equals `verdictStateFrom` of the goal's value, the failed counts equal the number of rows with value `false` per severity, and a `ready` Summary has no failed row.

**Validates: Requirements 5.2 to 5.6**

### Property 9: An inline answer changes only what depends on it

*For any* report with an open question and any valid answer, rows whose proof does not contain the answered fact have the same value before and after, and answering and then changing the answer back restores the original report.

**Validates: Requirements 6.2, 6.6**

### Property 10: Collection is faithful to the recorded responses

*For any* recorded scenario with a response order that the collector allows, `collect` makes exactly the requests of the plan, in the plan's order, each once, stops after a failing step, and returns the same snapshot for the same responses.

**Validates: Requirements 3.1, 3.7, 3.12, 3.13, 4.2**

### Property 11: Errors are classified, never thrown

*For any* status, header set and body, `classify` and the parsers return a result or one of the four `CollectError` kinds, never throw, and a rate-limit response is never reported as `not_found` or `unreadable`. The property is proved in two steps: task 4.2 for `classify` and the parsers, and task 5.2 for `collect`, which resolves and never rejects.

**Validates: Requirements 8.1, 8.2, 8.6, 8.7, 3.18**

### Property 12: Markdown cannot be injected into

*For any* report whose paths, `.gitignore` lines and labels hold any characters, the exported text contains no HTML tag from GitHub data, no line that starts a heading, list, table or quote that the exporter did not write, and every code span from GitHub data parses back to the original text with its line breaks as spaces. The same report always exports the same text.

**Validates: Requirements 10.4 to 10.9**

## Testing Strategy

| Layer | Tool | What |
| --- | --- | --- |
| Collector | Vitest, written first, with an injected `fetch` that replays `collectors/recorded/*.json` | `collect`, `parse`, `classify`, `deriveFacts`, `ignores`, `parseTarget` |
| Properties | Vitest and fast-check 4.10.2, files `*.props.test.ts`, at least 100 runs, tagged `// Feature: pre-flight-app, Property N: <title>` | Properties 1 to 12 |
| Report logic | Vitest | `buildReport`, `summarize`, `evidenceFor`, `relabelSources`, `questionFor`, `toMarkdown`, `validateChecklists` |
| Screens | Playwright, against the built app with `page.route` answering `api.github.com` from the recorded files | Requirement 13 |
| Accessibility | `@axe-core/playwright` | Zero violations per screen at 390, 768, 1280 |
| Budgets | Build-size test, layout-shift check, `audit` benchmark | Requirement 11.7 to 11.9 |

### Test-first order for the collector

Each collector task runs in three beats and records them in the task's evidence:

1. Write the test against a recorded response. Run it. It fails because the function does not exist or returns the wrong thing (record the failure).
2. Write the least code that passes. Run it (record the pass).
3. Add the property or the edge case (rate limit, 404, truncation, bad JSON) and repeat.

### Recorded responses

`record.ts` stores, per request, `{ url, status, headers, body, recordedAt }`, where `recordedAt` is the ISO time of the request (requirement 12.7), and where `headers` keeps only `content-type`, `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after` and `etag` is dropped. It sends no token and strips cookies. The recorder fails if the body contains the string `"token"` followed by a value longer than 20 characters, as a guard against leaking a credential. Error responses (404 repository, a rate-limit 403) are recorded once from a real run where possible, and otherwise written by hand as small fixtures marked `"synthetic": true` with the status and headers GitHub documents. Synthetic fixtures are named as such in the tests.

### End-to-end

Playwright routes `https://api.github.com/**` to the recorded files and aborts any other host with a failing assertion. Each bundled snapshot's recorded responses run as a live journey. An expectation file `e2e/fixtures/preflight-<id>.json` holds, per check, the expected state, label, rule id and evidence lines, written once by the Claude Code lane and approved by the human. A second pass runs the same repository from its sample button and asserts the same Report with no request.

### Evidence

Every task ends with Task_Evidence: screenshots at 390, 768 and 1280 px (attached, not committed), a clean console, zero axe violations and `pnpm check` output. Collector tasks add the failing-test run and the passing run.

## Design decisions

| Decision | Alternatives | Why this one |
| --- | --- | --- |
| One `RepoSnapshot` shape for live data and bundled data | Separate fixture format | One path after the snapshot means a sample report proves the live path. |
| Sequential requests | Parallel | Honest step order, a failure stops the run cleanly, four requests are fast. |
| `deriveFacts` returns `unseen`, and the engine's `needed` drives the questions | The collector lists questions itself | The engine already knows which unknown facts matter. The collector never asks. |
| Groups and severity in `checklists.ts` | In the knowledge base | The contract has neither, and the lane rules forbid changing it. Start-up validation keeps them honest. |
| Relabel sources in the app | Change the engine to report "collected" | The engine has no notion of origin. The relabel is small, pure and tested. |
| Narrow `ignores` that refuses what it does not understand | A full gitignore library | A new dependency is not on the approved list, and a wrong guess breaks the "never guess" rule. |
| Samples as stored snapshots, not as live calls | Live calls with a cache | A sample must work when the limit is hit. |
| No replay link for reports | Encode answers in the fragment | The report depends on live data. Decided by the human. |
| One goal, one checklist | A goal per checklist; several checklists as views; a picker | The knowledge base has one goal, and the app may not decide. One checklist holds every check, so the state and the counts are the engine's with no special cases. Open question 4, answered. |
| Evidence under the tree | Edit `ProofTree` for per-node detail | The kit stays unchanged. |
