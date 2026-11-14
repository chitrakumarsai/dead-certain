# Implementation Plan: inference-engine

## Overview

This plan builds the eight engine functions (`start`, `next`, `answer`, `audit`, `explain`, `whatIf`, `encode`, `decode`) in `packages/engine/src`, in TypeScript strict mode, on top of the finished rule language in `src/lang`. The order is: contract and docs groundwork, validation, the rule Resolver, the consultation core, test tooling, proofs, what-if, the replay codec, final wiring, and the benchmark. Each step builds on the one before it and ends with the code wired into `api.ts` and `index.ts`, so no code is left unused.

All work stays in the Kiro lane (`packages/engine`, plus `docs/kb-format.md` for the approved `label` change). Items for the Claude Code lane are listed under "Handoff notes for Claude Code" and are not tasks.

## Working rules for every task

- Run every command under Node 22 (`.nvmrc`). Before the first command in a session, run `nvm use` (or an equivalent) and confirm `node -v` prints `v22.x`. If it does not, stop and fix the shell first.
- Never use watch mode or any long-running process. Run tests only with `pnpm vitest run <path>`, `pnpm test:props` or `pnpm check`.
- Tasks run one at a time, in the order listed. Do not start a task while another is in progress, and do not run tasks in parallel.
- The engine has zero runtime dependencies. `packages/engine/package.json` keeps no `dependencies` entry. `fast-check` stays under `devDependencies` only.
- Every property test file ends in `.props.test.ts`, and every fast-check property runs at least 100 times (`{ numRuns: 100 }` or more).
- No non-test file under `packages/engine/src` may import a Node module (`node:*`, `fs`, `path`, `crypto`), use `process` or `Buffer`, read a clock, or import a path outside `packages/engine/src`. Only `consultation-step.perf.test.ts` reads the clock.
- The only change this spec allows in `packages/engine/src/types.ts` is the optional `readonly label?: string` on `FactDef`. The `Expr` union, `BinaryOp`, `BuiltinFn`, `Unknown` and `UNKNOWN` were added by the `rule-language` spec (Requirement 6) with Claude Code's consent ([PR #4, comment 6865345893](https://github.com/chitrakumarsai/dead-certain/pull/4#issuecomment-6865345893)) and are the baseline. Any other change to it is written up as a proposal and not applied (Requirement 23, criterion 9).
- A task is done when `pnpm check` exits with 0 (Biome, `tsc --noEmit`, Vitest unit and property tests) and the task is ticked in this file.
- Do not edit `requirements.md` or `design.md`.

## Tasks

- [x] 1. Groundwork: tooling pin, contract change, docs, errors and helpers
  - [x] 1.1 Pin fast-check to an exact version
    - In `packages/engine/package.json`, change `"fast-check": "^4.10.2"` to `"fast-check": "4.10.2"` (the installed version). Keep it under `devDependencies` only and keep `dependencies` absent.
    - Run `pnpm install` under Node 22 so the lockfile matches, then run `pnpm check`.
    - _Requirements: 1.5, 23.1, 23.7_

  - [x] 1.2 Add `label` to `FactDef` in `types.ts`
    - Add `/** Display name for ledger lines. Falls back to a name derived from the fact. */ readonly label?: string;` to `FactDef` in `packages/engine/src/types.ts`. Change nothing else in the file.
    - Run `pnpm check` to confirm the rule-language code and tests still compile.
    - _Requirements: 23.8, 23.11, 23.12, 7.5_

  - [x] 1.3 Add `label` to the fact properties table in `docs/kb-format.md`
    - Add a row to the "Fact properties" table: property `label`, type string, optional, constraint "Display name shown on ledger lines. When absent, the engine derives one from the fact name: underscores become spaces and the first letter is capitalised."
    - Optionally add `label` to one fact in the existing example if it keeps the example valid.
    - _Requirements: 23.13, 7.5, 7.6_

  - [x] 1.4 Record the notes for the kb-tools spec
    - Add a section "Notes for the kb-tools schema and validator" at the end of `docs/kb-format.md` with three numbered notes: (1) the schema accepts the optional `label` string on a fact, matching `FactDef.label`; (2) the validator warns when a fact with `role: deduction` has no unguarded fallback rule, because the engine reports `undefined` for it when every guard is false; (3) kb-tools tests fail on any `money` rule that lacks an explicit `round(...)`, so `NON_INTEGER_MONEY` is caught at build time. Add a fourth note that every `cite` must name a clause, which the engine assumes.
    - _Requirements: 23.14, 4.14, 4.7_

  - [x] 1.5 Create `errors.ts` and `util.ts`
    - `errors.ts`: the `ErrorCode` union of the ten codes and the `EngineError` class (`code`, `message` clipped to 500 characters, `toJSON()` returning `{ name, code, message }`).
    - `util.ts`: `deepEqual` (structural, treating an `undefined` property and an absent one as equal), `deriveLabel` (each `_` becomes one space, first code point upper-cased with `toUpperCase()`, rest unchanged) and `clip`.
    - Use `Object.hasOwn` for every own-key lookup helper. No Node imports.
    - _Requirements: 13.1, 13.2, 13.3, 13.6, 7.6, 7.7_

  - [x] 1.6 Write unit tests for errors and helpers
    - `labels.test.ts`: `room_rent_excess` gives `Room rent excess`; `FactDef.label` wins over the derived label.
    - Cover `EngineError` JSON round trip, the 500-character clip, and `deepEqual` with `undefined` versus absent properties.
    - Run with `pnpm vitest run packages/engine/src/labels.test.ts`.
    - _Requirements: 7.5, 7.6, 7.7, 13.3, 13.6_

- [x] 2. Knowledge-base and answer validation
  - [x] 2.1 Implement `graph.ts`
    - `factRefs(expr)`: distinct fact names in first-reference order, left to right (binary left then right, call arguments in order, unary operand).
    - `findCycle(kb)`: edges from `rule.set` to every fact in `factRefs(rule.when)` and `factRefs(rule.to)`; an iterative depth-first search from each fact in `Object.keys(kb.facts)` order with white, grey and black marks; self-edges are cycles; returns the facts on the cycle.
    - _Requirements: 2.4, 5.3_

  - [x] 2.2 Implement `check.ts`
    - `validateKb`: goals first, then rule `set` names (both `INVALID_KB`, naming the goal or rule id), then `findCycle` (`CYCLE`, naming every fact on it).
    - `checkValue`: accept exactly the combinations of Requirement 3, criterion 7, using `isValidDate` for dates and `options.includes` for enums; refuse `undefined`, `null`, symbols and `UNKNOWN`; throw `UNKNOWN_FACT`, `NOT_ANSWERABLE`, `INVALID_ANSWER` in that order.
    - `validateAnswers`: three passes over the answer names in code-unit order (unknown names, then derived names, then bad values).
    - `normaliseValue`: store `-0` as `0`.
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 12.6, 12.7, 12.8, 13.7_

  - [x] 2.3 Write unit tests for graph and check
    - Cases: the three `INVALID_KB` and `CYCLE` conditions and their priority; self-cycle; a cycle through two derived facts naming both; `2025-02-30`, `NaN`, `Infinity`, an unsafe integer, a wrong-case enum option; `__proto__` and `constructor` as fact names.
    - Run with `pnpm vitest run packages/engine/src/check.test.ts`.
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Rule Resolver
  - [x] 3.1 Implement `resolve.ts`
    - The `Resolver` class: `fact(name)` returns a memoised `Resolution` (`known`, `unknown` or `inapplicable`, with `deciding` and `tried`); `expr(e, ruleId)` calls the Rule_Language `evaluate` through an environment of lazy getters, memoised by expression-node identity; `guard(rule)`; `wasRead(name)`.
    - Try the rules of a derived fact in `kb.rules` order. Stop at the first deciding rule, the first Unknown guard, or exhaustion (`inapplicable`).
    - Throw `EVALUATION_ERROR` (message holds rule id and language code) when `evaluate` fails. Throw `NON_INTEGER_MONEY` (message holds rule id and fact name) only when the deciding rule's `to` value for a `money` fact is a finite non-integer.
    - An undeclared fact name resolves as Unknown with no rules.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 12.3_

  - [x] 3.2 Write `money.test.ts`
    - Assert a rule of the form `sum_insured * 0.01` that yields a fraction throws an Engine_Error with code `NON_INTEGER_MONEY` whose message names the rule id and the fact.
    - Assert the same rule written as `round(sum_insured * 0.01)` succeeds and gives an integer.
    - Assert no error when the deciding `to` value is Unknown, and none when the guard is unmatched or the fractional rule is skipped or not reached.
    - Run with `pnpm vitest run packages/engine/src/money.test.ts`.
    - _Requirements: 4.14, 4.15, 4.16, 4.17_

  - [x] 3.3 Write unit tests for the Resolver
    - Cases: Kleene results (`false and Unknown`, `true or Unknown`), first-matching-rule-wins, Unknown guard stops later rules, deciding rule with Unknown `to`, all guards false gives `inapplicable`, `EVALUATION_ERROR` from an evaluated division by zero, and `evaluate` called at most once per guard and per `to` (count calls through a spy on a wrapped expression).
    - Run with `pnpm vitest run packages/engine/src/resolve.test.ts`.
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.10, 4.11, 4.12_

- [x] 4. Consultation core: relevance, outcomes and the first four functions
  - [x] 4.1 Implement `relevance.ts`
    - `findRelevant(resolver, kb, goals)`: the walk of Requirement 5, criterion 3 with a `visited` set. Guard operands left to right, then `to` operands; stop descending at settled sub-expressions; for `if`, visit only the selected branch; report each unanswered askable fact once, with the `cite` of the rule through which it was first reached.
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.4, 6.6_

  - [x] 4.2 Implement `outcome.ts`
    - `evaluateSession(kb, answers)`, `buildQuestion` (fresh object, key order `kind`, `fact`, `text`, then `why` and `clause` only when present) and `buildVerdict`.
    - `buildVerdict`: `goals` one key per goal in order (`undefined` kept); `lineItems` one per fact with role `deduction` or `check` in `facts` order, with `label = def.label ?? deriveLabel(name)`, `rule` and `clause` from the deciding rule, else from the first rule whose guard is not false, else `""`; `needed` empty when every goal is decided, otherwise one Question per relevant fact.
    - Convert `UNKNOWN` to `undefined` at this boundary.
    - _Requirements: 5.1, 5.6, 6.1, 6.2, 6.3, 6.5, 6.7, 6.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 8.4, 8.5, 8.6, 8.7, 12.1, 12.5_

  - [x] 4.3 Create `api.ts` with `start`, `answer`, `next`, `audit` and export them from `index.ts`
    - `start`: `validateKb`, then `{ kb, answers: {} }` with a fresh `answers` object each call. `answer`: `validateKb`, `checkValue`, then a new Session whose `answers` is `Object.fromEntries` of the old entries plus the normalised pair, sorted by name. `next`: validate, `evaluateSession`, then a Question or a Verdict. `audit`: validate the facts record as answers, then a Verdict with the full `needed` list.
    - Type-check with `satisfies Pick<EngineApi, "start" | "answer" | "next" | "audit">`; the final wiring task widens it to the full `EngineApi`.
    - Add the new exports to `index.ts` and keep every existing export unchanged. Also export `EngineError` and `ErrorCode`.
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 5.7, 5.8, 5.9, 8.1, 8.2, 8.3, 8.8, 8.9, 8.10_

  - [x] 4.4 Write unit tests for `start`, `answer`, `next` and `audit`
    - `session.test.ts`: `start` returns the same `kb` reference and separate `answers` objects; `answer` replaces an earlier answer and does not mutate its input; `__proto__` and `constructor` work as fact names; a small hand-built Claim Check style knowledge base walks to a verdict.
    - Run with `pnpm vitest run packages/engine/src/session.test.ts`.
    - _Requirements: 2.1, 2.7, 2.8, 3.1, 3.2, 3.3, 5.1, 5.2_

- [x] 5. Test tooling and consultation properties
  - [x] 5.1 Build the test kit generators in `src/testkit/`
    - `kbArb` (cycle-free, layered, all five fact types, roles, optional labels, clauses, guards, `if`, `min`, `max`, `round`, `days_between`, comparisons on number, money and date, inapplicable derived facts, 0 to 30 facts and 0 to 60 rules), `cyclicKbArb`, `sessionArb(kb)` (answered or unanswered per askable fact, valid values per type, includes the empty and the full set, and probes for answered number, money and date facts), `deepFreeze`, and `walkPublic(value, path)` that reports the offending path.
    - Test-only: never imported from non-test source and never re-exported from `index.ts`. Add a small `testkit.test.ts` that checks generated knowledge bases pass `validateKb` and generated sessions pass `validateAnswers`.
    - _Requirements: 16.10, 17.6, 18.7, 21.2, 21.6, 21.7, 21.10_

  - [x] 5.2 Build the oracles in `src/testkit/`
    - `referenceVerdict(kb, answers)`: a naive interpreter that tries rules in order and calls `evaluate` with a fully built environment, sharing no code with `resolve.ts`. `assignments(kb, answers)`: enumerates every assignment of the unanswered askable facts. `readOnceKbArb`: boolean and enum knowledge bases built as trees, each fact referenced from at most one expression position, distinct literal outputs per fact, at most 8 askable facts and at most 3 options each; discard generated knowledge bases that break these limits.
    - _Requirements: 17.2, 17.6, 17.8_

  - [x] 5.3 Write property tests for reference agreement and question content
    - **Property 11: Verdicts agree with an independent reference interpreter**
    - **Property 12: Question content comes from the Knowledge_Base**
    - File `reference-agreement.props.test.ts`. Run with `pnpm vitest run packages/engine/src/reference-agreement.props.test.ts`.
    - **Validates: Requirements 4.1 to 4.10, 5.1, 5.2, 5.6, 6.1 to 6.8, 7.1 to 7.11**

  - [x] 5.4 Write the no-wasted-questions property test
    - **Property 4: No wasted questions**
    - File `no-wasted-questions.props.test.ts`. Use `readOnceKbArb` for the existence check of criterion 2 and the enumeration checks of criteria 3 and 5; run criteria 1 and 4 on `kbArb` as well. At least 100 runs.
    - **Validates: Requirements 5.4, 5.5, 5.6, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8**

  - [x] 5.5 Write the mode-agreement property test
    - **Property 6: Mode agreement**
    - File `mode-agreement.props.test.ts`. Generate answer sets of size 0, size 1 and size equal to the number of askable facts. At least 100 runs per property.
    - **Validates: Requirements 7.12, 7.13, 8.1, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7**

- [x] 6. Checkpoint - consultation core
  - Ensure all tests pass, ask the user if questions arise. Run `pnpm check` and `pnpm test:props` under Node 22.

- [x] 7. Proof trees
  - [x] 7.1 Implement `explain.ts` and add `explain` to `api.ts`
    - Memoised `node(name)`. Non-derived: `source: "answered"`, `children: []`, no `rule`, `clause` or `because`. Derived: `source: "derived"`, then `rule`, `clause`, `because` only with a deciding rule. `children` is the ordered union of `factRefs(when)` for every tried rule and `factRefs(deciding.to)`.
    - For a child referenced only in a Skipped_Branch (`!resolver.wasRead(name)`): try to resolve it and catch `EngineError`; on error return the bare node (`fact`, `value: undefined`, `source`, `children: []`); otherwise return the full node. Any other exception propagates. Never memoise a failed fact.
    - `because` fill: one regular-expression pass over `{name}`; own-key fact names are replaced with `String(value)` or `unknown`; other braces are left unchanged.
    - Export `explain` from `index.ts` and extend the `satisfies` check.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13, 9.14, 9.15, 9.16, 13.9_

  - [x] 7.2 Write `explain-skipped-branch.test.ts`
    - For a derived fact whose deciding rule is `if(a > 0, b / a, 0)` with `a` answered 0: `explain` returns a tree and does not throw; the child for `b` has `value` `undefined`, `children` `[]` and no `rule`, `clause` or `because`.
    - A skipped-branch child whose resolution raises no error is a full node with its resolved `value`.
    - `explain` throws the same code as `next` for an `EVALUATION_ERROR` on an evaluated path, for `UNKNOWN_FACT` and for `INVALID_ANSWER`.
    - Run with `pnpm vitest run packages/engine/src/explain-skipped-branch.test.ts`.
    - _Requirements: 9.14, 9.15, 9.16, 9.17, 13.9_

  - [x] 7.3 Write `proof-because.test.ts`
    - Placeholder fill: known value, Unknown value, a `{name}` that is not a fact left unchanged, and substituted text that contains braces is not expanded again.
    - Run with `pnpm vitest run packages/engine/src/proof-because.test.ts`.
    - _Requirements: 9.6, 9.7_

  - [x] 7.4 Write the sound-proofs property test
    - **Property 3: Sound proofs**
    - File `sound-proofs.props.test.ts`. Use `referenceVerdict` for the value checks. Include generated knowledge bases with an untaken branch that raises `EVALUATION_ERROR`, and assert `explain` returns a tree whenever `next` returns a Verdict. At least 100 runs.
    - **Validates: Requirements 9.1, 9.3 to 9.12, 9.14, 9.15, 9.16, 13.9, 16.1 to 16.13**

- [x] 8. What-if
  - [x] 8.1 Implement `calendar.ts`
    - `dayNumber(iso)`, `fromDayNumber(n)` and `addDays(iso, delta)` with the integer civil-calendar algorithm, never `Date`. `addDays` returns `undefined` when the result fails `isValidDate` (before `0001-01-01` or after `9999-12-31`).
    - _Requirements: 10.12, 10.15_

  - [x] 8.2 Write `calendar.test.ts`
    - Leap days, month and year ends, the day before `0001-01-01` rejected, the day after `9999-12-31` rejected.
    - Run with `pnpm vitest run packages/engine/src/calendar.test.ts`.
    - _Requirements: 10.12, 10.15_

  - [x] 8.3 Implement `thresholds.ts`
    - `thresholdCandidates(kb, resolver, answers, fact)`: collect `binary` probes with operators `<`, `<=`, `>`, `>=`, `==`, `!=` where one operand is exactly the answered fact; skip a probe whose other side depends on the answered fact (transitive reference closure); skip an Unknown other side; swallow an `EngineError` while evaluating the other side. For a Known_Value `v` add `v`, `v - 1`, `v + 1` (one minor unit; previous and next day for dates).
    - Remove the current answer, wrong-typed values, duplicates and invalid values (non-finite numbers; money that is negative, non-integer or not a safe integer; dates failing `isValidDate`). Sort ascending, keep the first 6, before any Verdict is computed.
    - _Requirements: 10.10, 10.11, 10.12, 10.13, 10.14, 10.15, 10.16, 10.17_

  - [x] 8.4 Implement `what-if.ts` and add `whatIf` to `api.ts`
    - Validate, return `[]` for a session with no answers, compute the base Verdict (a throw propagates). For each answered askable fact in `facts` order, candidates are `[false, true]`, `options`, or the threshold candidates; drop the current answer; compute each candidate Verdict with only that answer changed; keep it only when it is not `deepEqual` to the base; drop a candidate silently when it throws an `EngineError`.
    - Export `whatIf` from `index.ts` and extend the `satisfies` check.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.18, 10.19_

  - [x] 8.5 Write `what-if-thresholds.test.ts`
    - A `money` fact compared with a Known_Value of 500000 paise: assert the candidates 499999, 500000 and 500001 (current answer excluded) and the Alternatives whose Verdict changes, including a Claim Check style line such as "room rent at or below the limit".
    - Assert the exclusion of negative money (a Known_Value of 0 gives no -1) and of out-of-range dates, the cap of 6, an Unknown other side giving none, and a probe that depends on the answered fact giving none.
    - Run with `pnpm vitest run packages/engine/src/what-if-thresholds.test.ts`.
    - _Requirements: 10.10, 10.11, 10.12, 10.13, 10.14, 10.15, 10.16, 10.20_

  - [x] 8.6 Write property tests for what-if
    - **Property 14: What-if alternatives are exactly the answer changes that alter the verdict**
    - File `what-if.props.test.ts`. Compare against `audit` with one answer changed; check ordering, ascending unique valid candidates, the cap of 6, and independence from answer order.
    - **Validates: Requirements 10.1 to 10.17, 15.6**

- [x] 9. Checkpoint - proofs and what-if
  - Ensure all tests pass, ask the user if questions arise. Run `pnpm check` and `pnpm test:props` under Node 22.

- [x] 10. Replay codec
  - [x] 10.1 Implement `codec/sha256.ts`, `codec/base64url.ts` and `codec/bytes.ts`
    - Pure TypeScript SHA-256 (FIPS 180-4) over a `Uint8Array`, base64url without padding (RFC 4648 section 5 alphabet), and canonical minimal unsigned LEB128 varints built with `%` and `Math.floor` (no `BigInt`), big-endian float64, a byte writer and a strict reader.
    - No `crypto`, `Buffer`, `btoa` or `atob`.
    - _Requirements: 1.7, 11.1, 11.3_

  - [x] 10.2 Write unit tests for the codec primitives
    - `sha256.test.ts`: published vectors for the empty string and `abc`, plus a multi-block message. Round-trip and rejection cases for base64url and varints (non-minimal varints, bad spare bits, length 1 modulo 4).
    - Run with `pnpm vitest run packages/engine/src/codec`.
    - _Requirements: 11.1, 11.3, 11.5_

  - [x] 10.3 Implement `codec/encode.ts` and add `encode` and `decode` to `api.ts`
    - Token layout: version byte 1, 16-byte fingerprint (first 16 bytes of SHA-256 over `JSON.stringify(kb)`), answer count, then per answer the index in the sorted fact-name list (strictly increasing), a type tag (0 false, 1 true, 2 number, 3 money, 4 date, 5 enum) and its payload.
    - `decode` checks in this order and stops at the first failure: framing (`MALFORMED_TOKEN`), version (`UNSUPPORTED_VERSION`), payload shape (`MALFORMED_TOKEN`, including repeats), fingerprint (`KB_MISMATCH`, message says the rules have changed), then answers (`UNKNOWN_FACT`, `NOT_ANSWERABLE`, `INVALID_ANSWER`) after `validateKb`.
    - Export `encode` and `decode` from `index.ts` and extend the `satisfies` check to the full `EngineApi`.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.14, 11.15, 11.16, 13.8_

  - [x] 10.4 Write `codec.test.ts`
    - One example per error code; the fault-priority pairs of Requirement 11, criterion 10; the size bound for 64 answers of 64 characters; an empty session round trip; a token for a changed rule gives `KB_MISMATCH`.
    - Run with `pnpm vitest run packages/engine/src/codec.test.ts`.
    - _Requirements: 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.12, 11.13_

  - [x] 10.5 Write the replay property test
    - **Property 7: Replay**
    - File `replay.props.test.ts`. Generators cover every fact type, zero answers and 64 answers of 64 characters; single-character edit, insertion and deletion of tokens; pairs of knowledge bases differing in one rule. At least 100 runs per property.
    - **Validates: Requirements 11.1, 11.4, 11.7, 11.12, 11.13, 11.15, 11.16, 20.1 to 20.10**

- [x] 11. Final wiring, remaining properties and the benchmark
  - [x] 11.1 Finalise `api.ts` and `index.ts`
    - Confirm `api.ts` ends with `const _contract = { start, next, answer, audit, explain, whatIf, encode, decode } satisfies EngineApi;` and that `index.ts` exports all eight functions, `EngineError`, `ErrorCode`, and every export it had before this spec (`parse`, `print`, `evaluate`, the re-exported types, `UNKNOWN`).
    - Remove any leftover partial type check from earlier tasks.
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 11.2 Write `api-contract.test.ts`
    - Assert the eight exports and the kept `lang` exports exist; the `satisfies EngineApi` type check compiles; `packages/engine/package.json` has no `dependencies` entry and `fast-check` is exactly `4.10.2` in `devDependencies`; a scan of `packages/engine/src` non-test files (excluding `testkit/`) finds no `node:` specifier, Node built-in import, `process`, `Buffer`, clock or random use, and no import resolving outside `packages/engine/src`; `types.ts` differs from the version left by the rule-language spec (with its `Expr`, `BinaryOp`, `BuiltinFn`, `Unknown` and `UNKNOWN`) only by the `label` property.
    - Run with `pnpm vitest run packages/engine/src/api-contract.test.ts`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 23.1, 23.8, 23.10_

  - [x] 11.3 Write the public-values property test
    - **Property 8: Public values contain no internal symbol and are plain JSON**
    - File `public-values.props.test.ts`. Walk every value returned by `start`, `answer`, `next`, `audit`, `explain`, `whatIf`, `encode` and `decode`; accept only `EngineError` exceptions; make sure the generators reach `undefined` goals, line items and proof values, inapplicable derived facts, and a `whatIf` Alternative for a probed number, money or date fact. At least 100 runs per property.
    - **Validates: Requirements 9.13, 12.1, 12.2, 12.4, 12.5, 21.1 to 21.10**

  - [x] 11.4 Write the determinism property test
    - **Property 1: Determinism**
    - File `determinism.props.test.ts`. Compare Deep_Equal results and identical `JSON.stringify` text for `next`, `audit`, `explain`, `whatIf` and `encode`; rebuild answer and facts records in a different insertion order; check that an earlier call with other inputs changes nothing and that invalid inputs give the same `code` and `message` each time. At least 100 runs.
    - **Validates: Requirements 1.6, 5.7, 5.9, 14.1 to 14.7**

  - [x] 11.5 Write the order-independence property test
    - **Property 2: Order independence**
    - File `order-independence.props.test.ts`. Generate answer sets that include the empty set, a single answer and 2 to 12 answers; apply them in each tested permutation and compare `answers`, `next`, `encode`, `audit`, `explain` for each goal and `whatIf` (including threshold candidates), and the error code when one permutation throws. At least 100 runs.
    - **Validates: Requirements 4.13, 11.11, 15.1 to 15.8, 20.9**

  - [x] 11.6 Write the termination property test
    - **Property 5: Termination**
    - File `termination.props.test.ts`. Use knowledge bases of 0 to 30 facts and 0 to 60 rules, including cyclic ones for `CYCLE`; drive consultations to the end and check at most N `answer` calls, a drop of exactly one unanswered askable fact per `answer`, an immediate Verdict for zero askable facts, and a 5,000 ms bound per call. At least 100 runs per property.
    - **Validates: Requirements 2.4, 18.1 to 18.7**

  - [x] 11.7 Write the contract property tests
    - **Property 9: Inputs are never changed**
    - **Property 10: Invalid input gives a typed error, in a fixed order**
    - **Property 13: Money is whole paise**
    - File `engine-contract.props.test.ts`. Deep-freeze inputs; check typed errors, the fixed error order and an independent per-type oracle for answer validity; check `sum_insured * c` with and without `round(...)`.
    - **Validates: Requirements 1.9, 1.10, 3.1 to 3.10, 4.14, 4.15, 4.16, 8.2, 8.3, 8.10, 10.18, 11.5 to 11.10, 12.3, 12.6 to 12.8, 13.1 to 13.8**

  - [x] 11.8 Write `consultation-step.perf.test.ts`
    - A plain Vitest test, not `vitest bench`. Build the Benchmark_KB (at least 50 facts, 100 rules, 3 goals, with at least one rule each using a guard, `if`, `min`, `max` and `days_between`), answer exactly half (rounded down) of the askable facts with valid values, run at least 20 warm-up Consultation_Steps (an `answer` then a `next`), then time at least 200 steps with `performance.now()`.
    - Fail with a message stating the median and the 10 ms limit when the median is 10 ms or more, and with a message stating the maximum and the 50 ms limit when the maximum is 50 ms or more. Print the median, 95th percentile and maximum to 3 decimal places whether the test passes or fails.
    - The clock is read only in this file. Run with `pnpm vitest run packages/engine/src/consultation-step.perf.test.ts`.
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise. Run `pnpm check` and `pnpm test:props` under Node 22 and confirm exit code 0.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster path. The tests the requirements name by file (`money.test.ts`, `what-if-thresholds.test.ts`, `explain-skipped-branch.test.ts`, the eight `*.props.test.ts` files for Properties 1 to 8, and `consultation-step.perf.test.ts`) are not marked optional, because the requirements say the engine SHALL include them.
- Each task references specific requirements for traceability. Checkpoints give incremental validation.
- Property tests validate universal properties; unit tests validate exact examples and edge cases.
- Tasks run strictly one at a time in the order listed. The dependency graph below therefore has one task per wave.
- Handoff note about `pnpm install` in task 1.1: it may change `pnpm-lock.yaml` at the repository root. Report that change to Claude Code in the pull request description; do not edit other root files.

## Handoff notes for Claude Code

These items belong to the Claude Code lane. They are recorded here so nothing is lost, and they are not tasks in this plan.

1. **Browser-build check (Requirement 1, criterion 8).** Add a CI job (in `.github/workflows/ci.yml`) that runs a Vite build of the `@dead-certain/engine` entry (`packages/engine/src/index.ts`) for a browser target under Node 22 and fails on any error or unresolved Node built-in import.
2. **CI Node version.** Make sure CI runs `pnpm check` and `pnpm test:props` under Node 22 (`.nvmrc`) and never in watch mode.
3. **Root scripts and configs.** `pnpm test:props` already runs `vitest run .props.`. If the root `vitest.config.ts` `include` or Biome settings need a change so that `*.props.test.ts`, `*.perf.test.ts` or `src/testkit/**` are picked up or linted correctly, make that change in the root config; Kiro does not edit root config files.
4. **Lockfile.** Task 1.1 pins `fast-check` to `4.10.2` in `packages/engine/package.json`; review the resulting `pnpm-lock.yaml` change.
5. **Pre-Flight relabelling.** The engine returns `source: "answered"` for every non-derived leaf. The Pre-Flight interface should relabel the facts its collector supplied as `"collected"` itself.
6. **Interface use of `label`.** The Claim Check ledger can show `LineItem.label` directly; it falls back to a derived name when a knowledge base gives no `label`.
7. **Replay links.** A replay link is tied to the exact rules version. When the rules change, `decode` throws `KB_MISMATCH` ("rules have changed"); the interface should show that message instead of a different verdict.
8. **Types contract.** `packages/engine/src/types.ts` changes only by the approved optional `FactDef.label`, on top of the `rule-language` additions approved in [PR #4, comment 6865345893](https://github.com/chitrakumarsai/dead-certain/pull/4#issuecomment-6865345893). Any other change needs a written proposal and consent from both lanes.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["1.5"] },
    { "id": 5, "tasks": ["1.6"] },
    { "id": 6, "tasks": ["2.1"] },
    { "id": 7, "tasks": ["2.2"] },
    { "id": 8, "tasks": ["2.3"] },
    { "id": 9, "tasks": ["3.1"] },
    { "id": 10, "tasks": ["3.2"] },
    { "id": 11, "tasks": ["3.3"] },
    { "id": 12, "tasks": ["4.1"] },
    { "id": 13, "tasks": ["4.2"] },
    { "id": 14, "tasks": ["4.3"] },
    { "id": 15, "tasks": ["4.4"] },
    { "id": 16, "tasks": ["5.1"] },
    { "id": 17, "tasks": ["5.2"] },
    { "id": 18, "tasks": ["5.3"] },
    { "id": 19, "tasks": ["5.4"] },
    { "id": 20, "tasks": ["5.5"] },
    { "id": 21, "tasks": ["7.1"] },
    { "id": 22, "tasks": ["7.2"] },
    { "id": 23, "tasks": ["7.3"] },
    { "id": 24, "tasks": ["7.4"] },
    { "id": 25, "tasks": ["8.1"] },
    { "id": 26, "tasks": ["8.2"] },
    { "id": 27, "tasks": ["8.3"] },
    { "id": 28, "tasks": ["8.4"] },
    { "id": 29, "tasks": ["8.5"] },
    { "id": 30, "tasks": ["8.6"] },
    { "id": 31, "tasks": ["10.1"] },
    { "id": 32, "tasks": ["10.2"] },
    { "id": 33, "tasks": ["10.3"] },
    { "id": 34, "tasks": ["10.4"] },
    { "id": 35, "tasks": ["10.5"] },
    { "id": 36, "tasks": ["11.1"] },
    { "id": 37, "tasks": ["11.2"] },
    { "id": 38, "tasks": ["11.3"] },
    { "id": 39, "tasks": ["11.4"] },
    { "id": 40, "tasks": ["11.5"] },
    { "id": 41, "tasks": ["11.6"] },
    { "id": 42, "tasks": ["11.7"] },
    { "id": 43, "tasks": ["11.8"] }
  ]
}
```
