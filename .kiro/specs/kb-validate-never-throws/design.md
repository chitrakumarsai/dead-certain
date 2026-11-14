# Bugfix Design

## Overview

`shown(value)` in `schema.ts` becomes total. It keeps its current output for every value it could already print, and handles the two cases that threw: a BigInt, and a value `JSON.stringify` cannot write.

```ts
function shown(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "bigint") return `${value}n`;
	try {
		return JSON.stringify(value) ?? "?";
	} catch {
		return "[value that cannot be shown]";
	}
}
```

`JSON.stringify` returns `undefined` for `undefined`, symbols and functions at the top level, which `?? "?"` already turns into `?`. Those three are unchanged.

## Bug condition

```text
isBugCondition(v) = typeof v = bigint
                    OR JSON.stringify(v) throws   (nested BigInt, cycle, throwing toJSON or getter)
```

`shown` is reached only from the `invalid_value` and `invalid_format` branches of `describeIssue`. Every other value interpolated into a message there is already a string or a number (`String(value)` on a number), so the fix is confined to `shown`.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Wrap `describeIssue` or `validateRaw` in `try/catch` | Rejected. It would hide this class of bug elsewhere and lose the diagnostic. |
| A JSON replacer that prints nested BigInts as `"1n"` | Rejected. It leaves cycles and throwing getters, so a `catch` is still needed, and nested BigInts are rare. |
| Show symbols and functions with names | Rejected. They do not throw today, and changing `?` would change messages for no gain. |

## Testing strategy

- Exploration: replay Property 1's `validateRaw` test with `seed: -646317260`, `numRuns: 200`. Before the fix it fails with `Counterexample: [{"facts":{"":{"type":0n}}}]`.
- Fix check: that replay passes, and a unit test in `schema.test.ts` covers the counterexample itself plus a nested BigInt, a cycle, a throwing getter, a symbol and a function, each as the fact `type`.
- Preservation: the existing schema unit and property tests pass unchanged, including the messages `Found 'int'`, `Found 'text'` and `Found 'bonus'`.
