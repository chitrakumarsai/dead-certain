# Implementation Plan: mcp-server

## Overview

This plan builds the MCP server in `packages/mcp` (package `@dead-certain/mcp`), in TypeScript strict mode, on the finished engine and kb-tools. The order is: package and build, the Node host and discovery, the pure tool handlers one at a time (each test-first), the SDK wiring, the stdio smoke test, the property tests, then the check inside Kiro and the docs.

**This spec is executed by Kiro.** All work stays in the Kiro lane: `packages/mcp`, `.kiro/settings/mcp.json` (task 7 only), `.kiro/steering/tech.md` (the SDK pin) and `docs/kiro-log.md`. The `README.md` section (task 8) is the one file outside the lane. It is Kiro's to write in this spec because the section describes Kiro's package, and the human approves it in the pull request. Nothing under `apps/`, `packages/ui`, `e2e`, `scripts` or `.github` changes.

**Not run in the session that wrote this spec.** The tasks below wait for a separate execution session.

## Working rules for every task

- Run every command under Node 22 (`.nvmrc`). Before the first command in a session, run `nvm use` (or an equivalent) and confirm `node -v` prints `v22.x`.
- Never use watch mode or any long-running process. Run tests with `pnpm vitest run <path>`, `pnpm test:props` or `pnpm check`.
- Tasks run one at a time, in order. Do not start a task while another is in progress.
- Do not edit root configuration (`package.json`, `biome.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.github`). `pnpm install` may change `pnpm-lock.yaml`; report that in the pull request description. The root `tsconfig.json` already includes `packages/*/src`.
- Dependencies: `@dead-certain/engine` and `@dead-certain/kb-tools` (`workspace:*`), `@modelcontextprotocol/sdk` and `zod` at exact versions (no `^`, no `~`), `fast-check` `4.10.2` and `vite` `8.3.8` as dev dependencies. Take `zod` at the version kb-tools pins (`4.6.7`) unless the SDK refuses it. Ask the human before adding any other package, including `@types/node` and `tsx`.
- Check the SDK's current API with context7 before writing `server.ts`. The server code in this plan names no SDK function on purpose.
- Node access (`node:fs`, `node:path`, `node:process`) appears in `src/host.ts` and `src/main.ts` only, with `// @ts-expect-error TS2591` on the import and local `declare` for the few names used, as kb-tools does.
- A tool handler never throws, never logs its arguments, and never writes to standard output.
- Every property test file ends in `.props.test.ts`, runs each fast-check property at least 100 times, and starts each property with a comment of the form `// Feature: mcp-server, Property N: <title>`.
- Test-first: for each handler task, write the test, run it and keep the failing output, write the code, run it and keep the passing output.
- A task is done when `pnpm check` exits with 0 and the task is ticked here.
- Do not edit `requirements.md` or `design.md`. If one is wrong, stop and report it.

## Tasks

- [x] 1. Package, build and launcher
  - [x] 1.1 Create the package
    - Create `packages/mcp/package.json`: `name` `@dead-certain/mcp`, `version` `0.0.0`, `private`, `"type": "module"`, scripts `build` (`vite build`) and `start` (`node bin/start.mjs`), the dependencies in the working rules. Run `pnpm install`.
    - Pick the SDK version: the latest stable release at execution time, found with context7 or the registry. Record it in the task's notes.
    - Create `vite.config.ts` as an SSR build of `src/main.ts` to `dist/server.mjs`: `ssr.noExternal` `["@dead-certain/engine", "@dead-certain/kb-tools"]`, `ssr.external` `["@modelcontextprotocol/sdk", "zod", "yaml"]`, `target` `node22`, `minify` false, `sourcemap` true, `emptyOutDir` true. Mirror `packages/kb-tools/vite.config.ts`.
    - Create stub `src/main.ts` that exits at once, and run `pnpm --filter @dead-certain/mcp build`.
    - Confirm `tsc --noEmit` passes with the SDK imported in a stub. IF it fails for want of `@types/node`, stop and ask the human (decided: declare locally first, then ask). Do not add the package.
    - Run `pnpm check`.
    - Notes: SDK `@modelcontextprotocol/sdk` 1.32.2 (latest stable on the registry, checked with context7). `tsc --noEmit` passes with the SDK imported, so `@types/node` is not needed so far. `pnpm install` changed `pnpm-lock.yaml`.
    - _Requirements: 1.1, 1.4, 7.4_

  - [x] 1.2 Write `bin/start.mjs`
    - Compare the modification time of `dist/server.mjs` with the newest file under `src/` and `package.json`. IF the bundle is missing or older, run `vite build --logLevel silent` with standard output sent to standard error, and exit with its status if it fails. Then `await import` the bundle.
    - Write nothing to standard output itself.
    - Test (`start.test.ts`): in a copy of the package in a temporary directory, delete `dist`, run `node bin/start.mjs` with standard input closed at once, and expect exit 0, empty standard output, and a rebuilt `dist/server.mjs`. Touch a source file and expect a rebuild. Leave the sources and expect none.
    - _Requirements: 1.2, 1.3, 1.5, 1.7_

- [x] 2. Host, workspace and discovery
  - [x] 2.1 Write `host.ts`, `workspace.ts` and `payload.ts`
    - `host.ts`: `readFileSync`, `readdirSync` with types, `lstatSync`, `cwd`. Read only. A symlink is reported as `other`.
    - `workspace.ts`: the `Workspace` interface and `makeWorkspace(host)`. `root()` walks up from `cwd` to the nearest `pnpm-workspace.yaml`. `listKbFiles()` lists `apps/*/kb/*.yaml` as `{ ref, path }`, sorted in code-unit order, regular files only, `kb/dist` ignored.
    - `payload.ts` and `limits.ts`: `ok`, `fail`, the 200,000-character cap, `clip`, the limits of requirement 6.3.
    - Test with an in-memory Host: nested apps, a symlink, a `dist` folder, a file named `x.yml`, a missing `apps/`, no workspace marker.
    - _Requirements: 2.1, 2.2, 2.3, 6.3, 6.4, 7.1_

  - [x] 2.2 Write `kbs.ts`
    - `resolve(ws, ref)` looks the string up in the discovered list and returns the file, or `UNKNOWN_KB` listing the valid refs. `compile(ws, ref)` reads with `readKbFile`, runs `compileText`, and returns the `KnowledgeBase` or `KB_INVALID` with the first 20 diagnostics.
    - Test: a valid KB, a KB with an error, a KB over 1 MiB, an unreadable file, a `kb` of `../../etc/passwd`, `claim-check/../pre-flight/checklist` and the empty string. None reads a file outside the list.
    - _Requirements: 2.8, 3.9, 5.5, 6.6_

- [x] 3. The tools, one at a time
  - [x] 3.1 `list_kbs`
    - Write `tools/list.ts`: the entries of requirements 2.5 to 2.7. `askable` counts facts without `derived: true`.
    - Test: the real workspace lists `claim-check/policy` and `pre-flight/checklist` with their goals; a broken file gives `ok: false` and the error count; an empty workspace gives `[]`.
    - _Requirements: 2.4, 2.5, 2.6, 2.7_

  - [x] 3.2 `consult`
    - Write `tools/consult.ts` with `buildSession` and the two Payload shapes. Sorted answer order. `undefined` becomes `null`. Keys in the fixed order of the design.
    - Test: no answers gives a question with `why` and `clause`; a full set from golden `G-01` gives `status: "verdict"` with `payable` 13,200,000 and `outcome` `reduced`; a wrong type, a float for money, an unknown fact and a bad token give the engine's codes; `answers` over `token`; the token in the Payload replays.
    - _Requirements: 3.1 to 3.10_

  - [x] 3.3 `explain`
    - Write `tools/explain.ts` with `proofText` and the `clauses` map.
    - Test: on `G-01`, `payable` and `room_rent_deduction`: the root value, every leaf `answered`, the text indented two spaces per depth, the clause text present. An unknown fact in the tree prints `unknown`. An unknown fact name gives `UNKNOWN_FACT`.
    - _Requirements: 4.1 to 4.8_

  - [x] 3.4 `validate`
    - Write `tools/validate.ts`: one file or all, `validateText`, counts, diagnostics in the library's order.
    - Test: the clean pre-flight knowledge base passes; a copy with a removed clause gives the same diagnostics as `validateText`; the output equals what `pnpm dc validate` prints for it (run the command in the test through the kb-tools `runCli` with a Host).
    - _Requirements: 5.1 to 5.5_

- [x] 4. Wire the server
  - [x] 4.1 Write `server.ts` and `main.ts`
    - Read the SDK's current docs first. Register the four tools with their zod schemas, descriptions and read-only annotations. Map each handler's result to a Tool_Result: the JSON text, the same object as `structuredContent`, `isError` for a Tool_Error.
    - `main.ts` builds the Workspace over the real Host and connects the stdio transport. It writes `dead-certain mcp: ready` to standard error once.
    - Write the tool descriptions for a model reader, as the design says.
    - Test: `createServer` over an in-memory Workspace, called through the SDK's in-memory transport if it has one, or through the stdio smoke test in task 5: the four tool names, the annotations, an invalid-params error for `consult` with no `kb`, and `.strict()` refusal of an extra argument.
    - _Requirements: 1.4, 1.6, 6.1_

  - [x] 4.2 Source-scan test
    - `source-scan.test.ts` reads `src/**` and fails on `console.log`, `process.stdout`, `child_process`, `fetch`, `writeFile`, `appendFile`, `process.env`, and on a `node:` import outside `host.ts` and `main.ts`. Also check that `bin/start.mjs` is the only file that names `child_process`.
    - _Requirements: 1.5, 7.1, 7.2, 7.3_

- [x] 5. Stdio smoke test
  - Spawn `node bin/start.mjs` in a temporary workspace with one valid knowledge base. Send `initialize`, `notifications/initialized`, `tools/list`, and one `tools/call` for each tool, over standard input. Read standard output line by line.
  - Expect: every line on standard output parses as JSON-RPC; `tools/list` returns exactly the four names; `consult` and `explain` return the expected Payloads; closing standard input ends the process with status 0 within 2 seconds; nothing was written to the workspace (compare a listing before and after).
  - Run it under a 30-second test timeout. No watch mode.
  - _Requirements: 1.2, 1.5, 1.6, 1.7, 7.1, 7.2_

- [x] 6. Property tests
  - Write them with the task before them if it is quick; otherwise here. Run every one at least 100 times.
  - [x]* 6.1 Property 1: `consult` relays the engine. Use the engine's `testkit` arbitraries for knowledge bases and sessions, and build the workspace in memory.
    - _Requirements: 3.2, 3.4, 3.5, 8.1_
  - [x]* 6.2 Property 2: answer order does not show.
    - _Requirements: 3.7, 8.2_
  - [x]* 6.3 Property 3: the Replay_Token round-trips, and `answers` win over `token`.
    - _Requirements: 3.3, 8.3_
  - [x]* 6.4 Property 4: `explain` agrees with `consult`.
    - _Requirements: 4.2, 4.3, 8.4_
  - [x]* 6.5 Property 5: handlers are total. Generate arbitrary JSON, `__proto__` keys and non-finite numbers.
    - _Requirements: 6.2, 6.5, 8.5_
  - [x]* 6.6 Property 6: a KB_Ref reaches only a discovered file. Wrap the in-memory Host to record every read.
    - _Requirements: 2.8, 6.6, 7.1, 8.6_
  - [x]* 6.7 Property 7: `validate` agrees with `validateText`.
    - _Requirements: 5.2, 5.3, 5.4_
  - [x]* 6.8 Property 8: Payloads are bounded and stable.
    - _Requirements: 3.7, 6.3, 6.4_

- [x] 7. Check inside Kiro
  - [x] 7.1 Turn the server on
    - Run `pnpm check`, `pnpm test:props` and the smoke test. All must pass.
    - In `.kiro/settings/mcp.json`, set `"disabled": false` on `dead-certain`. Change nothing else in the file. Commit this alone, so the change is easy to find.
    - Tell the human that a new Kiro session from the repo root is needed to load the server (decided: a new session does 7.2 and 7.3). Stop the session here unless the human says the server has loaded.
    - _Requirements: 9.1_
  - [x] 7.2 Call it from Kiro
    - In the new session, confirm the four tools are listed. Call `list_kbs`; `consult` on `claim-check/policy` with no answers, with two answers and with the full `G-01` answers; `explain` on `payable` and on `room_rent_deduction`; `validate` on `pre-flight/checklist`.
    - Compare the final `consult` Payload with `G-01`'s `expect` block, goal by goal and line by line. Report any difference as a failure.
    - _Requirements: 9.2, 9.3, 9.4_
  - [x] 7.3 Record it
    - Append a dated entry to `docs/kiro-log.md`: the Kiro surface, the calls and what came back (short), what the server caught or what failed. Do not paste the whole Payloads.
    - _Requirements: 9.5, 10.3_

- [x] 8. Docs and pin
  - Add the "MCP server" section to `README.md` (requirement 10.1): the four tools, the `mcp.json` entry, one `consult` call and its result, read-only and no LLM.
  - Replace "(add when installed)" in `.kiro/steering/tech.md` with the SDK's exact version.
  - _Requirements: 10.1, 10.2_

- [x] 9. Final checkpoint
  - Run `pnpm check`, `pnpm test:props`, `pnpm build` and `pnpm dc validate`. All must pass.
  - Confirm `git diff --stat main...HEAD` shows changes only under `packages/mcp`, `.kiro/settings/mcp.json`, `.kiro/steering/tech.md`, `README.md`, `docs/kiro-log.md`, `pnpm-lock.yaml` and this spec's `tasks.md`.
  - Open the pull request for gate G5. State what was verified inside Kiro and what was not.
  - _Requirements: all_

## Notes

- Tasks marked `*` are property tests. The build plan asks for them in every Kiro-lane spec, so run them all and keep them in CI. They run under `pnpm check` because the root Vitest config includes `packages/**`.
- All six open questions are answered (see the requirements). Task 1.1 still stops and asks if `@types/node` turns out to be needed. Task 7 spans two sessions.
- Task 7.2 is the only part of the build plan's Phase 5 line "Confirm Kiro can call `consult` and `explain`" that a unit test cannot prove. The smoke test proves the protocol, and 7.2 proves the client.
- The Claude Code lane has nothing to do in this spec.
