# Bugfix Requirements Document

## Introduction

`validateRaw` throws `TypeError: Do not know how to serialize a BigInt` on `{"facts":{"":{"type":0n}}}`. fast-check found it in Property 1 of `total.props.test.ts` with seed `-646317260` (shrunk path `101:6:2:3:7:6:7:6`, failing in run 102 of 200, roughly one run in 30 across seeds). The generator already offers BigInt leaves, so any seed can reach it.

The throw is in `shown()` in `packages/kb-tools/src/schema.ts`. `describeIssue` calls `shown(value)` to put the bad value into the message "Found '…'" for an enum or format error. `shown` calls `JSON.stringify`, which throws on a BigInt and on any object that holds a BigInt, a cycle, or a throwing `toJSON` or getter. Requirement 17 says validation is total: it returns diagnostics for every input and never throws. `validateRaw` is public, and the MCP server and tests can pass it any value.

The fix changes only `packages/kb-tools/src/schema.ts`, its tests and this spec.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a field that must be one of a fixed list (a fact `type`, a fact `role`, or another enum) holds a BigInt THEN the system throws a `TypeError` from `validateRaw`

1.2 WHEN such a field holds an object or list that contains a BigInt, or that refers to itself, or whose `toJSON` or getter throws THEN the system throws from `validateRaw`

1.3 WHEN the throw happens THEN the system returns no diagnostics, so `dc validate` and the MCP tools cannot report the mistake

### Expected Behavior (Correct)

2.1 WHEN a field that must be one of a fixed list holds a BigInt THEN the system SHALL report the usual `SCHEMA_INVALID` error, with the BigInt shown as its decimal digits followed by `n` (for example `Found '0n'`)

2.2 WHEN such a field holds a value that cannot be written as JSON (a cycle, a nested BigInt, a throwing `toJSON` or getter) THEN the system SHALL report the usual `SCHEMA_INVALID` error with the shown text `[value that cannot be shown]`

2.3 WHEN such a field holds a symbol or a function THEN the system SHALL report the usual `SCHEMA_INVALID` error and SHALL NOT throw

2.4 FOR ALL inputs to `validateRaw`, including every value the Property 1 generator builds, THE system SHALL return diagnostics and SHALL NOT throw

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the bad value is a string THEN the system SHALL CONTINUE TO show it as it is

3.2 WHEN the bad value is a number, boolean, null, list or mapping that JSON can write THEN the system SHALL CONTINUE TO show `JSON.stringify` of it, with the same text as before

3.3 WHEN the bad value is `undefined`, a symbol or a function THEN the system SHALL CONTINUE TO show `?`

3.4 WHEN a diagnostic of any other kind is reported THEN the system SHALL CONTINUE TO use the same code, severity, message, field and order as before

3.5 WHEN the same input is validated twice THEN the system SHALL CONTINUE TO return equal results
