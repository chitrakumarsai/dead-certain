---
inclusion: fileMatch
fileMatchPattern: "apps/*/kb/**"
---

# Rule authoring

These constraints apply whenever you read or write files under `apps/*/kb/`.

## One clause per rule

Each rule sets exactly one fact and cites exactly one clause id from the rulebook. If a clause has two effects, write two rules.

```yaml
# correct
- id: ROOM-01
  cite: "4.2"
  set: room_rent_cap
  to: sum_insured * 0.01
  because: The room rent limit is 1% of the sum insured per day.

# wrong — two effects in one rule
- id: ROOM-01
  cite: "4.2"
  set: room_rent_cap
  to: sum_insured * 0.01
  set: rent_over_cap          # second set: not allowed
  to: room_rent_per_day > room_rent_cap
```

## Mandatory citation

Every rule must have a `cite` field containing a clause id from the rulebook. A rule without a `cite` field is invalid and will fail `pnpm dc validate`.

If the rulebook does not support a threshold or condition you want to encode, do not invent it. Add an entry to `open-questions.md` instead and leave the fact un-derived until the rulebook is updated.

## No free-text conditions

Rule conditions use only the expression language: fact names, literals, arithmetic (`+`, `-`, `*`, `/`), comparisons (`>`, `>=`, `<`, `<=`, `=`, `!=`), logical connectives (`and`, `or`, `not`), and the functions `min`, `max`, `round`, `if`, `days_between`.

Natural-language prose is allowed only in `because` (a plain sentence explaining the rule to a user) and `ask` (the question text for a fact). It must not appear in `to`, `when`, or any expression field.

```yaml
# correct
- id: COPAY-01
  cite: "6.1"
  set: copayment_applies
  to: age >= 61
  because: A co-payment applies when the insured is 61 or older at the time of admission.

# wrong — prose in a condition
- id: COPAY-01
  cite: "6.1"
  set: copayment_applies
  to: "if the patient is elderly"   # not a valid expression
```

## Fact types

Declare every fact in the `facts` block before using it in a rule. Use the correct type:

| Type | Use for |
| --- | --- |
| `boolean` | Yes/no facts and derived flags |
| `number` | Counts, ages, percentages |
| `money` | Monetary amounts (integer minor units, e.g. paise for INR) |
| `date` | ISO 8601 date strings |
| `enum` | A fixed set of named values |

Derived facts set `derived: true` and must not appear in `ask`.

## Validation

Run `pnpm dc validate` after every edit. Fix every finding before committing. The hook fires automatically on save, but always confirm a clean run before marking a task done.
