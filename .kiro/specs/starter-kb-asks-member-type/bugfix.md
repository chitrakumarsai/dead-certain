# Bugfix Requirements Document

## Introduction

The Starter_KB of the `app-template` spec (`templates/app/kb/starter.yaml`, the library fine) decides its verdict without the answer that sizes the fine. Rule `OUT-03` sets `outcome` to `fine_due` from `days_late` and `waiver_card` alone. The engine asks only for the facts a goal needs, and `outcome` is the only goal, so on a late return without a waiver card it never asks `member_type`. The daily rate, the fine, the cap and the amount stay unknown. The verdict screen of a scaffolded app shows "Cut by the cap: Not known", and the proof of `OUT-03` reads "a fine of unknown cents is due".

Gate G5's review of PR #19 found it, and the Claude Code lane reported it. The golden scenarios did not catch it, because each one gives all three facts up front, and a golden scenario that gives every fact never shows which facts the engine would ask for.

The fix changes only the Starter_KB: `templates/app/kb/starter.yaml`, `templates/app/rulebook/starter.md` and `templates/app/golden/scenarios.yaml`. The human allowed the Kiro lane to edit them once more for this fix (the `AGENTS.md` table gives `templates/` to Claude Code). The knowledge-base `id` stays `__APP_NAME__`, and `outcome` stays the verdict goal, so `config.ts` does not change.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a book is late (`days_late` above 0) and the member holds no waiver card THEN the engine decides `outcome` as `fine_due` and reports no further question, so `member_type` is never asked

1.2 WHEN the engine has decided that outcome THEN `daily_rate`, `fine_before_cap`, `fine_cap`, `fine_after_cap` and the line item `cap_deduction` are unknown, and the verdict shows "Not known" for the cap line and the proof of `OUT-03` prints "unknown" for the fine

1.3 WHEN a book is late and the member holds a waiver card THEN the engine decides `waived` without `member_type`, so the line item `waiver_deduction` is unknown and the amount the card cancels is never shown

1.4 WHEN a golden scenario gives every askable fact THEN `dc golden` passes, whatever the engine would have asked

### Expected Behavior (Correct)

2.1 THE Starter_KB SHALL have a second goal, `amount_due` (type `money`, derived, label "Fine to pay"), and `outcome` SHALL stay the first goal and the verdict goal

2.2 WHEN `days_late` is above 0 THEN the engine SHALL ask for `waiver_card` and `member_type` before it reports a verdict, whether or not a waiver card is held, and the verdict SHALL give `amount_due` as the fine after the cap less the amount the waiver card cancels

2.3 WHEN `days_late` is 0 or below THEN the engine SHALL ask only for `days_late`, and the verdict SHALL give `outcome` `no_fine`, `amount_due` 0, `cap_deduction` 0 and `waiver_deduction` 0, with no "Not known" on the page

2.4 WHEN the engine reports a verdict for a late book THEN every derived fact on the proof path of `outcome` and `amount_due` SHALL be known, and no rule's sentence SHALL print "unknown"

2.5 THE rulebook (`rulebook/starter.md`) and the clause texts in `starter.yaml` SHALL say the same thing, and the new rules SHALL cite a clause that says it (clause 4)

2.6 THE golden scenarios SHALL include scenarios that check what the engine asks: one for a late book that expects `ask: member_type` after the other answers, and one for an on-time book that gives only `days_late` and expects a verdict. Every rule SHALL still fire in at least one scenario, and every goal SHALL be checked in every verdict scenario

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a scaffolded app runs THEN `outcome` SHALL CONTINUE TO be the verdict goal, with the values `no_fine`, `fine_due` and `waived`, and `src/config.ts` SHALL CONTINUE TO set `verdictGoal: "outcome"`

3.2 WHEN `pnpm dc validate` runs on a scaffolded app THEN it SHALL CONTINUE TO report 0 errors and 0 warnings, and `dc build` SHALL CONTINUE TO write `kb/dist/starter.json`

3.3 WHEN a scenario gives days late, a member type and a waiver card THEN the values of `outcome`, `cap_deduction` and `waiver_deduction` SHALL CONTINUE TO be the ones of golden scenarios `G-01` to `G-04` (apart from the on-time lines, which become 0), and the rates and caps SHALL CONTINUE TO be 10, 25 and 15 cents and 500 and 1000 cents

3.4 THE Starter_KB SHALL CONTINUE TO meet requirement 4 of `app-template`: 3 to 5 askable facts, at least one derived fact, at least two line items with a role, at least two clauses, every rule citing an existing clause, and one scenario for each verdict the rules can reach

3.5 THE KB `id`, the fact names and labels other than the additions, and the placeholders `__APP_NAME__` and `__APP_TITLE__` SHALL CONTINUE TO be as they are

3.6 THE scaffolded app's own tests (`names.test.ts`, the session and replay tests, the smoke spec) SHALL CONTINUE TO pass, since they read the knowledge base and name no fact

## Bug Condition

```pascal
FUNCTION isBugCondition(S)
  INPUT: S, answers of days_late and waiver_card, with member_type unanswered
  OUTPUT: boolean

  RETURN S.days_late > 0
END FUNCTION
```

```pascal
// Property: Fix Checking - a late book needs the member type
FOR ALL S WHERE isBugCondition(S) DO
  step ← next'(S)
  ASSERT step is a question for member_type
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL S WHERE NOT isBugCondition(S) DO
  ASSERT next'(S).outcome = next(S).outcome
END FOR
// and for every S that gives all three facts: outcome, cap_deduction and waiver_deduction are unchanged
```

## Test Expectations

- A consult scenario `ask: member_type` after `days_late: 10` and `waiver_card: false`, and the same with `waiver_card: true`.
- An on-time scenario with only `days_late: 0` that reaches `no_fine` with every goal and line item known.
- On a scaffolded copy (`pnpm new-app probe-app` in a throwaway worktree): `dc validate`, `dc build`, `dc golden`, `pnpm check` and the smoke spec, and the cap line shows an amount, not "Not known".
