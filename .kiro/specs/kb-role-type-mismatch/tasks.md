# Implementation Plan

Scope: `packages/kb-tools`, `docs/kb-format.md` and this spec only. Do not touch `packages/engine` or `apps/*/kb`. Run tests once, never in watch mode (use `vitest --run`). Every task ends with `pnpm check`.

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Role and type must agree
  - **CRITICAL**: This test MUST FAIL on unfixed code. Failure confirms the bug exists.
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior and validates the fix when it passes after task 3
  - **GOAL**: Surface counterexamples showing that `checkFactFields` has no rule relating `role` to `type`
  - **Scoped PBT Approach**: The bug is deterministic, so scope the property to the finite set of bug-condition pairs: `check` with number, money, date or enum, and `deduction` with boolean, number, date or enum
  - Add `packages/kb-tools/src/role-type.test.ts`. Build each knowledge base with the `kb()` helper pattern from `codes.test.ts`, with one derived fact carrying the role and type (an enum fact also needs `options`)
  - For every pair, assert that `validateText` returns exactly one `ROLE_TYPE_MISMATCH` diagnostic with `id` equal to the fact name, `field` equal to `type`, severity `error`, the right `file`, and a message containing the fact name, role, type and required type (`boolean` for `check`, `money` for `deduction`)
  - Add a case for a non-derived `number` fact with `role: check`: expect both `SCHEMA_INVALID` and `ROLE_TYPE_MISMATCH`, each once, with `ROLE_TYPE_MISMATCH` first
  - Add a case where `dc build` on a mismatched knowledge base exits non-zero and writes no output, using the existing build test setup in `kb-tools`
  - `ROLE_TYPE_MISMATCH` is not yet in the `ErrorCode` union. Reference the code as a string in a way that compiles against unfixed code, so the test fails at the assertion and not at type-check
  - Run once: `pnpm --filter @dead-certain/kb-tools exec vitest --run src/role-type.test.ts`
  - **EXPECTED OUTCOME**: Test FAILS (this is correct and proves the bug exists)
  - Document the counterexamples, for example `number` + `check` gives no diagnostic, and non-derived `number` + `check` gives only `SCHEMA_INVALID`
  - Finish with `pnpm check`. The only failures allowed are the exploration test cases from this task. Record them.
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Everything else is unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code, using `validateText`, for facts where `isBugCondition` is false:
    - A derived boolean `check` fact and a derived money `deduction` fact give no role diagnostic
    - Facts of all five types with no `role` give no role diagnostic
    - A non-derived boolean `check` fact gives only the current `SCHEMA_INVALID` ("has a 'role' but is not derived"), with its current message text
    - `role: bonus` (any invalid role value) and `type: text` with `role: check` (any invalid type value) give only the current `SCHEMA_INVALID`
  - Write property-based tests in `packages/kb-tools/src/role-type-preservation.props.test.ts` with fast-check and the existing `kbArb` testkit. Draw role and type so that the pair agrees, or the role is absent, or a value is invalid. Assert that no `ROLE_TYPE_MISMATCH` is reported and that the diagnostics equal the snapshot observed on unfixed code (same codes, severity, message, field, order)
  - Include a fixed example that records the exact `SCHEMA_INVALID` message for the non-derived role fact
  - Run once: `pnpm --filter @dead-certain/kb-tools exec vitest --run src/role-type-preservation.props.test.ts`
  - **EXPECTED OUTCOME**: Tests PASS on unfixed code (this confirms the baseline to preserve)
  - Finish with `pnpm check`. It must pass apart from the task 1 failures.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for role/type mismatch accepted by `dc validate` and `dc build`

  - [x] 3.1 Implement the fix in source
    - In `packages/kb-tools/src/diagnostics.ts`, add `"ROLE_TYPE_MISMATCH"` to the `ErrorCode` union. Leave `WARNING_CODES` unchanged.
    - In `packages/kb-tools/src/schema.ts`, define `ROLE_REQUIRED_TYPE` as `{ check: "boolean", deduction: "money" }`, keyed by the values of `ROLES`
    - In `checkFactFields`, after the "role but not derived" check, push one `makeError("ROLE_TYPE_MISMATCH", file, message, { id: name, field: "type", at })` when `entity.role` is the string `check` or `deduction`, `entity.type` is one of `FACT_TYPES`, and the type differs from the required type
    - Message: `Fact '<name>' has role '<role>' but its type is '<type>'. A <role> fact must have type <required>. Change the type or remove the role.`
    - Guard with a string check and `Object.hasOwn` on both values, so an invalid role or type is skipped and left to the existing `SCHEMA_INVALID` path. Do not condition on `derived`.
    - Do not change `compareDiagnostics`. The same-fact order (`ROLE_TYPE_MISMATCH` before `SCHEMA_INVALID`) comes from the existing code ordering.
    - _Bug_Condition: isBugCondition(F) where (F.role = check AND F.type IN {number, money, date, enum}) OR (F.role = deduction AND F.type IN {boolean, number, date, enum})_
    - _Expected_Behavior: exactly one ROLE_TYPE_MISMATCH error per such fact, id = fact name, field = type, message names fact, role, type and required type; dc build writes no output_
    - _Preservation: facts outside the bug condition keep the same diagnostics, order, severity, message, field and compiled JSON_
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 3.8 Make the test generators and fixtures respect the role/type rule
    - In `packages/kb-tools/src/testkit` (the `kbArb` generator), draw a derived fact's type from its role: a `check` fact is always boolean and a `deduction` fact is always money. Facts with no role keep any type.
    - Keep the fault generators in `testkit/faults.ts` unchanged unless a fault deliberately relies on a mismatch. If one does, report it.
    - Correct the fixtures in `packages/kb-tools/src/warnings.test.ts` and `cli.test.ts` (and any other shared fixture the failures point to) so every check fact is boolean and every deduction fact is money, without changing what each test asserts.
    - Known failing tests after 3.1 (24 across 15 files): `warnings.test.ts` (3), `cli.test.ts` (3), `cli-output.props.test.ts` (1), `fallback.props.test.ts` (2), `cycles.props.test.ts` (3), `compile-json.props.test.ts` (1), `compile-render.props.test.ts` (1), `print-parse.props.test.ts` (1), `no-cascade.props.test.ts` (1), `refs.props.test.ts` (1), `schema.props.test.ts` (1), `diagnostic-shape.props.test.ts` (2), `testkit.test.ts` (1, "kbArb renders to YAML that passes the full validator"). After this task all of these pass, except code-list count failures left for 3.2 and doc-row failures left for 3.3.
    - `role-type-preservation.props.test.ts` strips mismatched roles from `kbArb` output. That stripping becomes a no-op and the test must keep passing. Do not change its assertions.
    - Run the kb-tools suite once: `pnpm --filter @dead-certain/kb-tools exec vitest --run`. Never use watch mode.
    - Finish with `biome check packages/kb-tools` and `tsc` for kb-tools. Full `pnpm check` fails for unrelated missing dependencies in `packages/ui`, `apps/site` and `e2e`.
    - _Requirements: 3.6, 3.7_

  - [x] 3.2 Update the code lists in tests
    - `packages/kb-tools/src/codes.test.ts`: add `ROLE_TYPE_MISMATCH: row("error", kb({ facts: <FACTS plus a derived number fact with role: check> }), "<fact name>")` to `TABLE`. Change the count in the test title and assertion from 22 to 23. Keep the rest of the base knowledge base valid.
    - `packages/kb-tools/src/catalogue.test.ts`: change errors 20 to 21 and totals 22 to 23 in both places and in the test title
    - `packages/kb-tools/src/diagnostics.test.ts`: add `"ROLE_TYPE_MISMATCH"` to `ERRORS` and change "has 20 error codes" to 21
    - `packages/kb-tools/src/diagnostic-shape.props.test.ts`: add `"ROLE_TYPE_MISMATCH"` to `ALL_CODES` and to `FACT_SCOPED`. If the test treats unlisted codes differently, add the code to the set where it belongs.
    - Leave `refs.props.test.ts` and `testkit/faults.ts` unchanged, except for any change task 3.8 requires
    - _Requirements: 2.4_

  - [x] 3.3 Update `docs/kb-format.md`
    - Add a code table row after `MONEY_NOT_ROUNDED`, on one line in the format `` | `ROLE_TYPE_MISMATCH` | error | fact name | <example> | ``. Example: `Fact 'room_rent_excess' has role 'deduction' but its type is 'number'. A deduction fact must have type money. Change the type or remove the role.`
    - Change "There are 22 codes. 20 are errors and 2 are warnings." to "There are 23 codes. 21 are errors and 2 are warnings."
    - In the `role` row of the fact properties table, state that `deduction` requires type `money` and `check` requires type `boolean`
    - In the notes on codes, state that a role fact that is not derived gets both `SCHEMA_INVALID` and `ROLE_TYPE_MISMATCH` when its type is also wrong
    - _Requirements: 2.4_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Role and type must agree
    - **IMPORTANT**: Re-run the SAME test from task 1. Do NOT write a new test.
    - Run once: `pnpm --filter @dead-certain/kb-tools exec vitest --run src/role-type.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms the bug is fixed)
    - Finish with `pnpm check`
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Everything else is unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2. Do NOT write new tests.
    - Run once: `pnpm --filter @dead-certain/kb-tools exec vitest --run src/role-type-preservation.props.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Finish with `pnpm check`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 3.6 Add the fix-checking property test (optional)
    - Add `packages/kb-tools/src/role-type.props.test.ts` using fast-check and `kbArb`. Generate a valid knowledge base, add one fact whose role and type form a mismatch, and assert the Fix Checking property: exactly one `ROLE_TYPE_MISMATCH` for that fact, severity `error`, `field` equal to `type`, and a message with the fact name, role, type and required type
    - Build the fact in the test. Do not add a fault to `testkit/faults.ts`, so existing consumers stay unchanged.
    - Run once: `pnpm --filter @dead-certain/kb-tools exec vitest --run src/role-type.props.test.ts`
    - Finish with `pnpm check`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.7 Check the real knowledge bases with `pnpm dc validate`
    - Run `pnpm dc validate` once on every knowledge base under `apps/*/kb`
    - **EXPECTED OUTCOME**: No `ROLE_TYPE_MISMATCH` is reported
    - If any is reported, do NOT edit the file. `apps/*/kb` is outside this fix's scope. Record the app, file, fact name and diagnostic, and report it to the human.
    - Run `pnpm dc build` on a temporary knowledge base with a mismatch. Confirm a non-zero exit code and no JSON written. Delete the temporary files afterward.
    - Finish with `pnpm check`
    - _Requirements: 1.3, 2.3, 3.6_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `pnpm check` once and confirm that Biome, `tsc` and all Vitest unit and property tests pass
  - Confirm that the only changed paths are under `packages/kb-tools`, `docs/kb-format.md` and `.kiro/specs/kb-role-type-mismatch`
  - Report any `apps/*/kb` hit from task 3.7 to the human. Ask if questions arise.
