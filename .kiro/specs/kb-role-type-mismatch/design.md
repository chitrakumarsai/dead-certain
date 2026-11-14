# KB Role/Type Mismatch Bugfix Design

## Overview

`dc validate` and `dc build` accept a fact whose `role` does not fit its `type`. A `role: check` fact must be boolean, because the interface shows it as pass or fail. A `role: deduction` fact must be money, because the interface shows it as an amount. The schema check in `packages/kb-tools/src/schema.ts` tests only that a fact with a `role` is derived. It never compares the role with the type, so a mismatched fact reaches the compiled JSON.

The fix adds one error code, `ROLE_TYPE_MISMATCH`, and one check inside the existing per-fact function `checkFactFields`. It also updates the code lists in the source, the tests and `docs/kb-format.md`. The change is limited to `packages/kb-tools`, `docs/kb-format.md` and this spec. It does not touch `packages/engine`, so `types.ts` is unchanged.

## Glossary

- **Bug_Condition (C)**: A fact with `role: check` and a type in {number, money, date, enum}, or with `role: deduction` and a type in {boolean, number, date, enum}.
- **Property (P)**: For such a fact, validation reports exactly one `ROLE_TYPE_MISMATCH` error with `id` equal to the fact name and `field` equal to `type`. Its message names the fact, the role, the fact's type and the required type.
- **Preservation**: Every knowledge base without a role/type mismatch produces the same diagnostics, in the same order, and the same compiled JSON as before.
- **checkFactFields**: The function in `packages/kb-tools/src/schema.ts` that applies cross-field rules to one fact. It already reports the enum `options` problems and the "role but not derived" problem.
- **ROLE_REQUIRED_TYPE**: A new constant in `schema.ts` mapping `check` to `boolean` and `deduction` to `money`.
- **Located diagnostic**: A diagnostic that still carries its `at` position (section, index) used only for ordering.

## Bug Details

### Bug Condition

The bug manifests when a fact definition has a valid `role` and a valid `type` that do not agree. `checkFactFields` looks only at whether `derived` is true when a role is present. The type is never read for that purpose, so no diagnostic exists for the mismatch.

**Formal Specification:**
```
FUNCTION isBugCondition(F)
  INPUT: F of type FactDef (with a name)
  OUTPUT: boolean

  RETURN (F.role = "check" AND F.type IN {number, money, date, enum})
      OR (F.role = "deduction" AND F.type IN {boolean, number, date, enum})
END FUNCTION
```

The condition does not depend on `derived`. A non-derived fact with a mismatched role is in the bug condition, and it also keeps its existing `SCHEMA_INVALID` error (requirement 2.5).

### Examples

- `room_rent_excess: { type: number, derived: true, role: deduction }`. Expected: one `ROLE_TYPE_MISMATCH` error. Actual: valid.
- `rent_ok: { type: money, derived: true, role: check }`. Expected: one `ROLE_TYPE_MISMATCH` error. Actual: valid.
- `tier_ok: { type: enum, options: [a, b], derived: true, role: check }`. Expected: one `ROLE_TYPE_MISMATCH` error. Actual: valid.
- `loose: { type: number, ask: "How many?", role: check }` (not derived). Expected: both the existing `SCHEMA_INVALID` ("has a 'role' but is not derived") and one `ROLE_TYPE_MISMATCH`. Actual: only `SCHEMA_INVALID`.
- `ok_check: { type: boolean, derived: true, role: check }`. Expected and actual: no role diagnostic.
- `room_rent_excess: { type: money, derived: true, role: deduction }`. Expected and actual: no role diagnostic.
- `x: { type: number, derived: true, role: bonus }`. Expected and actual: the existing `SCHEMA_INVALID` for the role value only, with no `ROLE_TYPE_MISMATCH`.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- A derived boolean `check` fact and a derived money `deduction` fact are accepted without a role diagnostic.
- A fact with no `role` is accepted with any of the five types.
- A fact with a `role` that is not derived keeps the existing `SCHEMA_INVALID` error and its message text.
- A `role` value other than `deduction` or `check`, or a `type` value outside the five fact types, keeps the existing `SCHEMA_INVALID` error and gets no `ROLE_TYPE_MISMATCH`.
- Severity, message and field of every existing code are unchanged.
- A knowledge base with no mismatch gets the same diagnostics in the same order and the same compiled JSON.

**Scope:**
All facts that do not satisfy `isBugCondition` are unaffected. This includes facts without a role, facts with an invalid role or type value, and facts whose role and type already agree.

The expected correct behavior is defined in Property 1 below.

## Hypothesized Root Cause

1. **Missing cross-field rule**: `checkFactFields` has rules for `options` and for `role` requiring `derived`, but none that relates `role` to `type`. This is the most likely cause, and the existing role rule shows where the new one belongs.
2. **Schema shape only**: `factSchema` types `role` and `type` as independent enums. Zod cannot express the pairing without a refinement, and the file deliberately keeps cross-field rules in `checkFactFields` so that every violation in the file is reported and not only the first.
3. **No later stage covers it**: The later checks (references, types, rounding, goals) look at rules and expressions. They do not read `role`, so nothing downstream catches the mismatch either.
4. **Run-time-only guard**: Only the ui-kit CheckRow guards the check case, at run time (its requirement 16.9). Nothing guards the deduction case anywhere.

## Correctness Properties

Property 1: Bug Condition - Role and type must agree

_For any_ knowledge base containing a fact where the bug condition holds (isBugCondition returns true), the fixed validator SHALL report exactly one diagnostic with code `ROLE_TYPE_MISMATCH` for that fact, with severity `error`, `id` equal to the fact name and `field` equal to `type`, and a message that contains the fact name, the role, the fact's type and the required type (`boolean` for `check`, `money` for `deduction`). The diagnostic SHALL carry the usual `file` and sort at the fact's place in the file, and `dc build` SHALL write no output. A non-derived fact in the bug condition SHALL also keep its `SCHEMA_INVALID` error.

**Validates: Requirements 2.1, 2.2, 2.3, 2.5**

Property 2: Preservation - Everything else is unchanged

_For any_ knowledge base where no fact satisfies the bug condition, the fixed validator SHALL produce the same diagnostics, in the same order and with the same severity, message and field, as the original validator, and `dc build` SHALL produce the same compiled JSON. This includes facts that have a role of the right type, facts with no role, non-derived role facts (existing `SCHEMA_INVALID`), and facts with an invalid `role` or `type` value.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

Property 3: Code catalogue - The new code is listed everywhere

The `ErrorCode` union, the codes test, the catalogue test, the diagnostic tests and the code table in `docs/kb-format.md` SHALL all list `ROLE_TYPE_MISMATCH` as an error code, and the counts SHALL read 23 codes: 21 errors and 2 warnings.

**Validates: Requirements 2.4**

## Fix Implementation

### Changes Required

Assuming the root cause is correct:

**File**: `packages/kb-tools/src/diagnostics.ts`

1. **Add the code**: Add `"ROLE_TYPE_MISMATCH"` to the `ErrorCode` union. `WARNING_CODES` is unchanged, so `severityOf` returns `error` for it.

**File**: `packages/kb-tools/src/schema.ts`

**Function**: `checkFactFields`

2. **Add a lookup**: Define `ROLE_REQUIRED_TYPE` as `{ check: "boolean", deduction: "money" }`, typed so the key is each value of `ROLES`.
3. **Add the check**: After the existing "role but not derived" check, add a check that runs when `entity.role` is the string `check` or `deduction` and `entity.type` is one of `FACT_TYPES`. If the type differs from the required type, push one `makeError("ROLE_TYPE_MISMATCH", file, message, { id: name, field: "type", at })`.
4. **Message**: `Fact '<name>' has role '<role>' but its type is '<type>'. A <role> fact must have type <required>. Change the type or remove the role.` The name appears as written, like the neighbouring messages in the same function.
5. **Guard for invalid values**: Compare with `Object.hasOwn` and a string check on both values, so a role or type that is not one of the allowed values (requirement 3.5) is skipped and left to the existing `SCHEMA_INVALID` path. Do not condition the check on `derived`, so a non-derived fact gets both diagnostics (requirement 2.5).
6. **Ordering**: The diagnostic uses the fact's `at`, so it sorts with that fact. For the same fact, `compareDiagnostics` orders by code, and `ROLE_TYPE_MISMATCH` sorts before `SCHEMA_INVALID`. The order is deterministic and no change to the sorter is needed.

`checkFactFields` runs for every plain-object fact, whether or not the Zod parse of that fact succeeded. The new diagnostic therefore also appears when the same fact has an unrelated schema error. Because any schema error returns no model, `dc build` writes no output (requirement 2.3).

**File**: `docs/kb-format.md`

7. **Code table**: Add a row for `ROLE_TYPE_MISMATCH` (error, `id` is the fact name) with the example message `Fact 'room_rent_excess' has role 'deduction' but its type is 'number'. A deduction fact must have type money. Change the type or remove the role.` Place it after `MONEY_NOT_ROUNDED` so the row order follows the union. The catalogue test's row pattern needs the row in the same pipe format as the others.
8. **Counts**: Change "There are 22 codes. 20 are errors and 2 are warnings." to "There are 23 codes. 21 are errors and 2 are warnings."
9. **Fact properties table**: In the `role` row, add that `deduction` requires type `money` and `check` requires type `boolean`.
10. **Notes on codes**: Add a note that a role fact that is not derived gets both `SCHEMA_INVALID` and `ROLE_TYPE_MISMATCH` when its type is also wrong.

**Test files that enumerate the codes (what each needs):**

11. `packages/kb-tools/src/codes.test.ts`
    - `TABLE` is typed `Record<DiagnosticCode, Row>`, so it fails to compile until a `ROLE_TYPE_MISMATCH` row exists. Add `ROLE_TYPE_MISMATCH: row("error", kb({ facts: <FACTS plus a derived number fact with role: check> }), "<fact name>")`. The default passing example is `VALID`, which has no role fact, so it raises nothing.
    - Change the test title and the assertion in "has a row for every code in DiagnosticCode, and 22 of them" to 23. The test reads the unions from the source text, so it fails on the count even before the row is added.
    - The failing example must keep the base knowledge base otherwise valid, so the diagnostic found is the one under test.
12. `packages/kb-tools/src/catalogue.test.ts`
    - Reads `ErrorCode` and `WarningCode` from `diagnostics.ts` and the table from `docs/kb-format.md`. Update the three hard-coded counts: errors 20 to 21, total 22 to 23 in both places (declared size and listed rows), and the test title.
    - No other change. It then checks that the table has each code exactly once with the right severity, a non-empty id column and a non-empty example, so the new doc row must follow the `| \`CODE\` | severity | id | example |` format on one line.
13. `packages/kb-tools/src/diagnostics.test.ts`: add `"ROLE_TYPE_MISMATCH"` to `ERRORS` and change "has 20 error codes" to 21.
14. `packages/kb-tools/src/diagnostic-shape.props.test.ts`: add `"ROLE_TYPE_MISMATCH"` to `ALL_CODES` and to the `FACT_SCOPED` set, since its `id` is a fact name. Without the second addition, check how the shape test treats an unlisted code and add it to whichever set it belongs to.

15. **Generators and fixtures (task 3.8)**: The `kbArb` generator in `packages/kb-tools/src/testkit` does produce role/type mismatches, so the fix makes 24 existing tests fail across 15 files. The generator must draw a derived fact's type from its role (`check` is boolean, `deduction` is money; facts with no role keep any type). Fixtures in `warnings.test.ts`, `cli.test.ts` and any other shared fixture the failures point to must use boolean `check` facts and money `deduction` facts, without changing what each test asserts. `testkit/faults.ts` stays unchanged unless a fault deliberately relies on a mismatch; if one does, report it. `refs.props.test.ts` needs no change beyond what its failure points to, apart from the optional fault below.

## Testing Strategy

### Validation Approach

First write tests that fail on the unfixed code and show the missing diagnostic. Then apply the fix and check that those tests pass and that nothing else changed.

### Exploratory Bug Condition Checking

**Goal**: Show the bug on unfixed code and confirm that the missing cross-field rule is the cause.

**Test Plan**: Validate small knowledge bases built with the `kb()` helper from `codes.test.ts`, each with one role fact, and assert that a `ROLE_TYPE_MISMATCH` diagnostic exists. Run them on the unfixed code.

**Test Cases**:
1. **Number check**: A derived `number` fact with `role: check` (will fail on unfixed code)
2. **Enum deduction**: A derived `enum` fact with `role: deduction` and `options` (will fail on unfixed code)
3. **Boolean deduction**: A derived `boolean` fact with `role: deduction` (will fail on unfixed code)
4. **Non-derived mismatch**: A non-derived `number` fact with `role: check` (will fail on unfixed code, because the second diagnostic is missing)

**Expected Counterexamples**:
- `validateText` returns no diagnostic for cases 1 to 3, and only `SCHEMA_INVALID` for case 4.
- Cause: no rule in `checkFactFields` compares `role` with `type`.

### Fix Checking

**Goal**: For every input in the bug condition, the fixed validator gives the expected diagnostic.

**Pseudocode:**
```
FOR ALL F WHERE isBugCondition(F) DO
  result := validateText'(KB containing F)
  ASSERT count(d IN result WHERE d.code = ROLE_TYPE_MISMATCH AND d.id = F.name) = 1
  ASSERT d.severity = error AND d.field = "type"
  ASSERT d.message contains F.name, F.role, F.type and requiredType(F.role)
END FOR
```

### Preservation Checking

**Goal**: For every input outside the bug condition, the fixed validator gives the same result as the original.

**Pseudocode:**
```
FOR ALL F WHERE NOT isBugCondition(F) DO
  ASSERT validateText(KB containing F) = validateText'(KB containing F)
END FOR
```

**Testing Approach**: Property-based testing suits preservation because the generator covers many fact shapes, role values and type values that hand-written cases would miss. The existing generated knowledge bases (`kbArb`) can produce a role fact of the wrong type, so task 3.8 first makes the generator respect the rule. After that, the whole existing property suite acts as a preservation check.

**Test Plan**: Run the full existing `kb-tools` suite on the fixed code and confirm that only the intended count and table changes were needed. Record the diagnostics of a role-free knowledge base and a correct-role knowledge base on the unfixed code, and compare them with the fixed code.

**Test Cases**:
1. **Correct roles**: A boolean `check` and a money `deduction` raise no role diagnostic.
2. **No role**: Facts of all five types without a role raise no role diagnostic.
3. **Non-derived role**: A boolean `check` that is not derived keeps exactly the current `SCHEMA_INVALID` message and no `ROLE_TYPE_MISMATCH`.
4. **Invalid values**: `role: bonus`, and `type: text` with `role: check`, keep the current `SCHEMA_INVALID` and gain no `ROLE_TYPE_MISMATCH`.

### Unit Tests

- One test per role as the bug file asks: a boolean check passes, a number check fails, a money deduction passes, an enum deduction fails.
- A test that the diagnostic has `id` equal to the fact name, `field` equal to `type`, severity `error`, the right `file`, and a message with the fact name, role, type and required type.
- A test that a non-derived mismatched fact yields both `SCHEMA_INVALID` and `ROLE_TYPE_MISMATCH`, each once, and that `ROLE_TYPE_MISMATCH` comes first.
- A test that two mismatched facts give two diagnostics in file order.
- A test that `dc build` on a knowledge base with a mismatch writes no output and reports the error (using the existing build test setup in `kb-tools`).
- The `codes.test.ts`, `catalogue.test.ts`, `diagnostics.test.ts` and `diagnostic-shape.props.test.ts` updates listed above.

### Property-Based Tests

- Generate a valid knowledge base, add one fact with a role and a type drawn so that the pair is a mismatch, and assert Property 1. This case is optional in the task list, as the bug file allows. It goes in a new file such as `role-type.props.test.ts` using the existing `kbArb` testkit and `fast-check`.
- Generate a role and a type that agree, or no role, and assert that no `ROLE_TYPE_MISMATCH` is reported (Property 2).
- If a fault is added to `testkit/faults.ts` for the property above, add it as a new `SchemaFaultName` and keep the existing fault list unchanged so `refs.props.test.ts` and the other consumers keep working. Adding it is optional; the new property test can build its own fact instead.

### Integration Tests

- Validate the real knowledge bases under `apps/*/kb` through `pnpm dc validate` and confirm that none gets a `ROLE_TYPE_MISMATCH` (they must already follow the rule, or the fix would break their build). If one does, report it to the human instead of editing the file, because `apps/*/kb` is outside this fix's scope.
- Run `pnpm dc build` on a temporary knowledge base with a mismatch and check that the exit code is non-zero and no JSON is written.
- Run `pnpm check` to confirm that Biome, `tsc` and the full test suite pass.
