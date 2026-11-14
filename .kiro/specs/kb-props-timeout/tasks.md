# Implementation Plan

- [x] 1. Reproduce the timeout
  - Run `compile-json.props.test.ts` with 40 busy loops running. Record the duration of each test and whether it times out.
  - _Requirements: 1.1, 1.2_

- [x] 2. Give both tests an explicit 60 s limit
  - Add `60_000` as the third argument of both `it` calls in `packages/kb-tools/src/compile-json.props.test.ts`. Leave `numRuns`, the generators and the assertions as they are.
  - _Requirements: 2.1, 2.2, 3.1, 3.2_

- [x] 3. Verify
  - [x] 3.1 Repeat the load run five times. No test times out.
    - _Requirements: 2.1, 2.2_
  - [x] 3.2 Run the file alone and `pnpm check`. Both pass, and the file still runs 200 and 100 cases.
    - _Requirements: 3.1, 3.2, 3.3_
