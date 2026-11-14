# Bugfix Requirements Document

## Introduction

`dc validate` and `dc build` accept a knowledge base in which a fact's `role` does not fit its `type`. The schema check requires only that a fact with a `role` is derived. It never compares the role with the type. A `role: check` fact that is not boolean, or a `role: deduction` fact that is not money, passes validation and reaches the compiled JSON. The interface then lists the fact as a line item whose value it cannot show as a pass or fail result, or as an amount of money.

The ui-kit CheckRow already guards the check case at run time (requirement 16.9). This fix adds the same guard at build time, so the author sees the mistake when the knowledge base is validated. The fix changes only `packages/kb-tools`, `docs/kb-format.md` and this spec.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a derived fact has `role: check` and a type other than boolean (number, money, date or enum) THEN the system reports no error for the fact and `dc validate` exits as valid

1.2 WHEN a derived fact has `role: deduction` and a type other than money (boolean, number, date or enum) THEN the system reports no error for the fact and `dc validate` exits as valid

1.3 WHEN a knowledge base holds a role fact of the wrong type and no other error THEN the system lets `dc build` write the compiled JSON

### Expected Behavior (Correct)

2.1 WHEN a derived fact has `role: check` and a type other than boolean THEN the system SHALL report one error with the new code `ROLE_TYPE_MISMATCH` whose message names the fact, the role `check`, the fact's type and the required type `boolean`, and whose `id` is the fact name and `field` is `type`

2.2 WHEN a derived fact has `role: deduction` and a type other than money THEN the system SHALL report one error with the new code `ROLE_TYPE_MISMATCH` whose message names the fact, the role `deduction`, the fact's type and the required type `money`, and whose `id` is the fact name and `field` is `type`

2.3 WHEN a knowledge base holds a `ROLE_TYPE_MISMATCH` error THEN the system SHALL report the diagnostic with the usual `file` and in the usual order for the fact's place in the file, and `dc build` SHALL write no output

2.4 WHEN the diagnostic codes are listed THEN the system SHALL include `ROLE_TYPE_MISMATCH` as an error code in the `ErrorCode` union in `packages/kb-tools/src/diagnostics.ts`, in the codes test, and in the diagnostic code table of `docs/kb-format.md`, with the code counts in that document updated

2.5 WHEN a fact has a role of the wrong type and also is not derived THEN the system SHALL report the existing `SCHEMA_INVALID` error for the missing `derived: true` and SHALL also report `ROLE_TYPE_MISMATCH` for the type, so each mistake is reported once

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a derived fact has `role: check` and type boolean THEN the system SHALL CONTINUE TO accept it without a role diagnostic

3.2 WHEN a derived fact has `role: deduction` and type money THEN the system SHALL CONTINUE TO accept it without a role diagnostic

3.3 WHEN a fact has no `role` THEN the system SHALL CONTINUE TO accept any of its five types without a role diagnostic

3.4 WHEN a fact has a `role` but is not derived THEN the system SHALL CONTINUE TO report the existing `SCHEMA_INVALID` error and its current message

3.5 WHEN a fact has a `role` value other than `deduction` or `check`, or a `type` value outside the five fact types THEN the system SHALL CONTINUE TO report the existing `SCHEMA_INVALID` error and SHALL NOT add a `ROLE_TYPE_MISMATCH`

3.6 WHEN a knowledge base has none of the defects above THEN the system SHALL CONTINUE TO produce the same diagnostics, in the same order, and the same compiled JSON as before

3.7 WHEN a diagnostic of any existing code is reported THEN the system SHALL CONTINUE TO use the same severity, message and field as before

## Bug Condition

```pascal
FUNCTION isBugCondition(F)
  INPUT: F of type FactDef (with a name)
  OUTPUT: boolean

  RETURN (F.role = "check" AND F.type IN {number, money, date, enum})
      OR (F.role = "deduction" AND F.type IN {boolean, number, date, enum})
END FUNCTION
```

```pascal
// Property: Fix Checking - role and type must agree
FOR ALL F WHERE isBugCondition(F) DO
  result ← validate'(KB containing F)
  ASSERT exactly one diagnostic in result has code = ROLE_TYPE_MISMATCH AND id = F.name
     AND that diagnostic has severity = error AND field = "type"
     AND its message contains F.name, F.role, F.type and the required type
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL F WHERE NOT isBugCondition(F) DO
  ASSERT validate(KB containing F) = validate'(KB containing F)
END FOR
```

## Test Expectations

- A unit test for each role: a boolean check passes, a number check fails, a money deduction passes, an enum deduction fails.
- A property-test case: any generated knowledge base with a role fact of the wrong type gets exactly this diagnostic. This case may be marked optional in the task list.
- The existing codes test, catalogue test and diagnostic-shape tests are updated for the new code.
