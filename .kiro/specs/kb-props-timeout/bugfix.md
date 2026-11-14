# Bugfix Requirements Document

## Introduction

`packages/kb-tools/src/compile-json.props.test.ts` timed out once, at 7.5 s against Vitest's default 5 s limit, during a full parallel run of `pnpm check` on a loaded machine. It passes alone in about 0.65 s. The test did not find a defect in the compiler. It failed because the machine was busy, so a green gate can turn red with no change to the code.

Reproduction: with 40 busy loops running, the first test took 5.2 s and failed with "Test timed out in 5000ms" in one run, and passed at 4.96 s in the next. The slowdown from contention is roughly eight to eleven times.

Two repairs were considered. Shrinking the generator (`numRuns` 200 down) cuts the cost but weakens Property 5 for a problem that is not in the property. Raising the time limit keeps the property as designed and matches the precedent in `cycles.test.ts` and `dist-smoke.test.ts`, which carry explicit 60 s limits. The fix raises the limit. It changes only the test file and this spec.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the full test suite runs in parallel on a loaded machine THEN the system fails "compiles to byte-identical, well-formed JSON that round-trips" with a timeout although the compiler is correct

1.2 WHEN the machine is busy THEN the test's 5 s default limit leaves about a seven-fold margin over its unloaded run time, which contention can use up

### Expected Behavior (Correct)

2.1 WHEN the machine is busy enough to slow the test eight to eleven times THEN the system SHALL pass "compiles to byte-identical, well-formed JSON that round-trips" with all 200 runs, because the test carries an explicit 60 s limit

2.2 WHEN the second test in the file, "a failed compile has no kb and no json", runs under the same load THEN the system SHALL give it the same explicit 60 s limit, since both tests share the cause

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `compile-json.props.test.ts` runs THEN the system SHALL CONTINUE TO run `numRuns: 200` and `numRuns: 100`, with the same generators and assertions

3.2 WHEN the compiler produces wrong output THEN the system SHALL CONTINUE TO fail the test with fast-check's counterexample, within the new limit

3.3 WHEN the rest of `pnpm check` runs THEN the system SHALL CONTINUE TO use the root Vitest configuration unchanged
