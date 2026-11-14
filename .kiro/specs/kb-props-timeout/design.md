# Bugfix Design

## Overview

Give the two tests in `compile-json.props.test.ts` an explicit 60 000 ms time limit, passed as Vitest's third argument to `it`. Nothing else changes. 60 s matches the existing limits in `cycles.test.ts` and `dist-smoke.test.ts` and is about 90 times the unloaded run time, so only a hang can reach it.

## Bug condition

```text
isBugCondition(run) = run.testDuration > 5000 ms AND run.defaultLimit = 5000 ms
                      AND the compiler output is correct
```

Cause: the test's cost is CPU time (200 generated knowledge bases, each rendered, compiled twice and checked). Under CPU contention wall-clock time grows with the load, while the 5 s limit stays fixed.

Fixed behaviour: for every run with `testDuration <= 60 000 ms`, the test result depends only on the compiler's output.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Shrink `numRuns` or the generator | Rejected. It weakens Property 5 and still leaves a fixed limit. |
| Raise `testTimeout` in the root `vitest.config.ts` | Not done here. It is the Claude Code lane (root config) and would be the one-line fix for the other 23 `*.props.test.ts` files in kb-tools that carry the same exposure. Recommended to Claude Code on PR #4. |
| Explicit limit on this test | Chosen. In the Kiro lane, matches precedent, smallest change. |

## Testing strategy

- Exploration: run the file with 40 busy loops. Before the fix it fails with "Test timed out in 5000ms" (seen once in two runs, the other run passed at 4.96 s). A pass or fail of a timing test cannot be a permanent test, so the exploration is recorded in the log, not committed.
- Fix check: the same load, five runs, no timeout.
- Preservation: the file alone passes in about 0.65 s with the same run counts; `pnpm check` passes.
