# Implementation Plan

- [x] 1. Write the bug condition exploration test
  - Add "replays seed -646317260 without a throw" to `packages/kb-tools/src/total.props.test.ts`: the `validateRaw` property with `{ numRuns: 200, seed: -646317260 }`. Run it on the unfixed code. It fails with `Counterexample: [{"facts":{"":{"type":0n}}}]`.
  - _Requirements: 1.1, 1.3, 2.4_

- [x] 2. Fix `shown` in `packages/kb-tools/src/schema.ts`
  - Return a string as is, a BigInt as digits plus `n`, and otherwise `JSON.stringify(value) ?? "?"` inside a `try`, with `[value that cannot be shown]` on a throw.
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

- [x] 3. Add unit tests in `packages/kb-tools/src/schema.test.ts`
  - The counterexample `{"facts":{"":{"type":0n}}}` gives a `SCHEMA_INVALID` error containing `Found '0n'`. A nested BigInt, a cycle and a throwing getter as the fact `type` give `[value that cannot be shown]`. A symbol and a function give `Found '?'`. None of them throws.
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Verify
  - [x] 4.1 The seed replay now passes. _Requirements: 2.4_
  - [x] 4.2 `pnpm check` passes with the other schema tests unchanged. _Requirements: 3.1 to 3.5_
