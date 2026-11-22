# Design Document: starter-kb-asks-member-type

## Overview

The engine asks for the facts that the goals need. `outcome` needs `days_late` and `waiver_card`, so nothing else is asked. The fix gives the Starter_KB a second goal, the amount of the fine to pay. That goal needs the rate, the cap and the waiver, so the engine asks `member_type` whenever a book is late. `outcome` is unchanged and stays the verdict goal. The two line items stay, and become known for an on-time book as well.

This is the smallest change that makes the rules need the answer. The alternatives were:

| Option | Why not |
| --- | --- |
| Make `outcome` depend on `fine_after_cap` (`OUT-03` with `fine_after_cap > 0`) | Hides the dependency in a condition, and still skips `member_type` when a waiver card is held. |
| Make `cap_deduction` and `waiver_deduction` goals | Line items are not goals in the Reference_Apps, and the verdict screen would list them twice. |
| Add a `fine` goal and show it as the headline | The kit's headline does not know the goal words, and the template uses a plain heading on purpose (requirement 5.6). |

## Changes

### `starter.yaml`

- `goals: [outcome, amount_due]`.
- New fact `amount_due`: `{ type: money, derived: true, label: Fine to pay }`.
- New rules, both citing clause 4:
  - `AMT-01`, `when: days_late <= 0`, `to: 0`, "The book came back on time, so the fine to pay is 0 cents."
  - `AMT-02`, `when: days_late > 0`, `to: fine_after_cap - waiver_deduction`, "The fine to pay is the fine of {fine_after_cap} cents less the {waiver_deduction} cents the waiver card cancels."
- `CAP-04` becomes `if(days_late <= 0, 0, fine_before_cap - fine_after_cap)` and `WAIV-01` becomes `if(days_late <= 0 or not waiver_card, 0, fine_after_cap)`. The `if` is lazy, so an on-time book does not need `member_type` or `waiver_card`, and both lines read 0 and not "Not known". Their sentences are unchanged.
- Clause 4 text gains one sentence, and `rulebook/starter.md` clause 4 says the same.
- Totals: 14 rules, four derived facts that are neither line items nor goals (`daily_rate`, `fine_before_cap`, `fine_cap`, `fine_after_cap`), two line items, two goals.

### `golden/scenarios.yaml`

- `G-01` to `G-04` gain `amount_due` in `expect.goals` (250, 500, 0, 0) and keep their facts and line items. `G-04` (on time) gives only `days_late: 0`, so it checks that no other question is needed. `fires` gains `AMT-01` and `AMT-02` where they fire, and `CAP-04` and `WAIV-01` where they now fire.
- `G-05`: `days_late: 10`, `waiver_card: false`, expects `ask: member_type`.
- `G-06`: `days_late: 10`, `waiver_card: true`, expects `ask: member_type`.

Together the scenarios cover every rule, and `dc golden` still warns `TOO_FEW_SCENARIOS` (accepted, app-template requirement 4.4).

### Effect on the scaffolded app

`config.ts` and the screens are unchanged. `Verdict` lists `amount_due` among the other goals as "Fine to pay: $2.50", and the two line items read an amount on every path. Tests that walk the knowledge base (`names.test.ts`, the session and replay property tests, the smoke spec) read the goal list from the knowledge base, so they take the new goal without edits.

## Correctness Properties

### Property 1: A late book is asked its member type

*For any* answers of `days_late` above 0 and either value of `waiver_card`, `next` is a question for `member_type` until it is answered. Checked by scenarios `G-05` and `G-06` and by the scaffolded app's replay tests, which answer whatever the rules ask.

**Validates: Requirements 2.2, 1.1, 1.3**

### Property 2: A decided verdict has no unknown on its path

*For any* complete path, every goal and line item of the verdict is known, and no rule sentence in the proof of `outcome` or `amount_due` holds "unknown". Checked by the golden expectations (every line item has a number) and by the scaffolded app's smoke spec, which reaches the verdict and opens the proof.

**Validates: Requirements 2.3, 2.4**

### Property 3: Preservation

*For any* scenario that gives all three facts, `outcome`, `cap_deduction` and `waiver_deduction` equal the old values, apart from an on-time book's lines, which are 0.

**Validates: Requirements 3.1, 3.3**

## Testing Strategy

`pnpm dc validate`, `dc build` and `dc golden` on a scaffolded copy, then `pnpm check` and the smoke spec of that copy. The change is rules and scenarios only, so there is no new unit test: the golden scenarios are the regression test, and they now include the ones that check the questions.
