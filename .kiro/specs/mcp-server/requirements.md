# Requirements Document

## Introduction

The MCP server is the package `@dead-certain/mcp` (`packages/mcp`). It exposes the Dead Certain engine over the Model Context Protocol on stdio, so that Kiro (and any other MCP client) can consult a knowledge base, ask the engine why a fact has its value, and validate the rules while the rules are being written. It is the project's own MCP server, named `dead-certain` in `.kiro/settings/mcp.json`.

The server adds no logic. Every answer comes from `@dead-certain/engine` (`start`, `answer`, `next`, `explain`, `encode`) and `@dead-certain/kb-tools` (`compileText`, `validateText`). It reads the YAML knowledge bases in the workspace and compiles them in memory on each call, so it always reflects the file as it was last saved, including a file Kiro is editing.

This spec is executed by the Kiro lane in `packages/mcp`. It was written Design-First, with the human's brief for Phase 5 and section 6 of `docs/BUILD_PLAN.md` as input. Requirement numbers are stable so the design's correctness properties can cite them.

Scope: the four tools `list_kbs`, `consult`, `explain` and `validate`, the stdio server and its `start` script, knowledge-base discovery, errors and limits, and the check that Kiro can call `consult` and `explain`. Out of scope: any write to the workspace, a tool that edits rules or the rulebook, `audit` and `whatIf` as separate tools, HTTP transport, authentication, MCP resources and prompts, and any change to `packages/engine` or `packages/kb-tools`.

## Glossary

- **MCP_Server**: The process started by `pnpm -s --filter @dead-certain/mcp start`, speaking MCP over stdio.
- **Engine**: The public API of `@dead-certain/engine`.
- **KB_Tools**: The public library API of `@dead-certain/kb-tools` (`compileText`, `validateText`, `Diagnostic`). The `dc` command is not called.
- **Workspace_Root**: The nearest ancestor of the process's working directory that holds `pnpm-workspace.yaml`.
- **KB_File**: A file matching `apps/<app>/kb/<stem>.yaml` under the Workspace_Root.
- **KB_Ref**: The string `<app>/<stem>` that names one KB_File, for example `claim-check/policy`. It is the only way a tool names a file.
- **Answers**: A JSON object that maps fact names to values of type `boolean`, `number` or `string`. Money is an integer in minor units. A date is an ISO string.
- **Tool_Result**: What a tool returns: one text content block holding a JSON document (the Payload), plus the same document as `structuredContent`. An error sets `isError: true`.
- **Payload**: The JSON document in a Tool_Result.
- **Tool_Error**: A Payload of the form `{ "error": { "code", "message" } }`, with `isError: true`.
- **Replay_Token**: The string `encode(session)` returns. A Claim Check replay link is `#/?r=<token>`.
- **Proof_Text**: A plain-text outline of a ProofNode tree, one node per line, indented by depth.
- **Kiro_Lane**: The lane that owns `.kiro/**`, `packages/engine`, `packages/kb-tools` and `packages/mcp`.

## Requirements

### Requirement 1: Package, start command and transport

**User Story:** As a Kiro user, I want the server to start with the command already in `mcp.json`, so that I can turn it on without building anything by hand.

#### Acceptance Criteria

1. THE MCP_Server SHALL live in `packages/mcp` as the workspace package `@dead-certain/mcp`, `"type": "module"`, `private`.
2. THE package SHALL define a `start` script, so that `pnpm -s --filter @dead-certain/mcp start` (the exact command in `.kiro/settings/mcp.json`) starts the MCP_Server.
3. WHEN `start` runs and the built bundle is missing or older than the source, THE `start` script SHALL build it first, with no output on standard output, and then run it.
4. THE MCP_Server SHALL speak MCP over stdio using `@modelcontextprotocol/sdk`, and SHALL name itself `dead-certain` with the package version.
5. THE MCP_Server SHALL write only MCP messages to standard output. It SHALL write diagnostics, if any, to standard error, and SHALL write nothing before the client's first message.
6. THE MCP_Server SHALL advertise exactly four tools: `list_kbs`, `consult`, `explain` and `validate`, each with a description, a JSON input schema and an annotation that marks it read-only.
7. WHEN standard input closes, THE MCP_Server SHALL exit with status 0.
8. THE MCP_Server SHALL NOT call `process.exit` while output is pending, and SHALL NOT catch a signal it does not need.

### Requirement 2: Knowledge-base discovery and `list_kbs`

**User Story:** As Kiro, I want to see which knowledge bases exist and whether they compile, so that I can pick one without knowing the repo layout.

#### Acceptance Criteria

1. THE MCP_Server SHALL find the Workspace_Root once per call, and IF there is none, THEN every tool SHALL return the Tool_Error `NO_WORKSPACE`.
2. THE MCP_Server SHALL discover KB_Files by listing `apps/*/kb/*.yaml` under the Workspace_Root, sorted by KB_Ref in code-unit order, and SHALL ignore `kb/dist` and every other file.
3. THE MCP_Server SHALL discover again on every call, and SHALL NOT cache a compiled knowledge base across calls.
4. THE `list_kbs` tool SHALL take no arguments and SHALL return `{ "kbs": [...] }` with one entry per KB_File.
5. WHEN a KB_File compiles, THE entry SHALL hold `ref`, `path` (relative to the Workspace_Root), `id`, `currency` (or null), `goals`, `facts` (the count), `askable` (the count of facts the engine may ask), `rules`, `clauses` and `ok: true`.
6. WHEN a KB_File does not compile, THE entry SHALL hold `ref`, `path`, `ok: false` and `errors` (the count of error diagnostics), and SHALL NOT make the call fail.
7. IF no KB_File exists, THEN `list_kbs` SHALL return `{ "kbs": [] }`.
8. THE MCP_Server SHALL accept a KB_Ref only if it equals the KB_Ref of a discovered KB_File. IF it does not, THEN the tool SHALL return the Tool_Error `UNKNOWN_KB` whose message lists the valid KB_Refs, and SHALL read no file named by the argument.

### Requirement 3: `consult`

**User Story:** As Kiro, I want to give a knowledge base some answers and get the next question or the verdict, so that I can walk a consultation without a browser.

#### Acceptance Criteria

1. THE `consult` tool SHALL take `kb` (a KB_Ref, required), `answers` (Answers, optional, default empty) and `token` (a Replay_Token, optional).
2. THE `consult` tool SHALL compile the KB_File, start a session, apply `token` first and then each of `answers` through the Engine's `answer`, and then call the Engine's `next`.
3. WHEN `token` and `answers` give a value to the same fact, THE value in `answers` SHALL win.
4. WHEN `next` returns a Question, THE Payload SHALL be `{ "status": "question", "question": { "fact", "text", "why", "clause", "type", "options" }, "answers", "token" }`, where `type` and `options` come from the fact's definition, `why` and `clause` are omitted when the Question has none, `answers` is the session's answers in key order, and `token` is the Replay_Token.
5. WHEN `next` returns a Verdict, THE Payload SHALL be `{ "status": "verdict", "goals", "line_items", "needed", "answers", "token" }`, where `goals` maps each goal to its value or null when unknown, `line_items` lists each item's `fact`, `label`, `role`, `value` (or null), `rule` and `clause`, and `needed` lists the Questions still open in the form of requirement 3.4.
6. THE `consult` tool SHALL NOT ask a question on its own and SHALL NOT invent an answer: a fact that is not in `answers` or `token` is unknown.
7. THE `consult` tool SHALL return the same Payload for the same arguments and the same file contents, with keys in a fixed order.
8. IF the Engine throws an `EngineError` (for example `INVALID_ANSWER`, `UNKNOWN_FACT`, `NOT_ANSWERABLE`, `MALFORMED_TOKEN` or `KB_MISMATCH`), THEN `consult` SHALL return a Tool_Error with that code and the Engine's message, and SHALL change nothing.
9. IF the KB_File does not compile, THEN `consult` SHALL return the Tool_Error `KB_INVALID` with the error diagnostics (requirement 5.3), and SHALL NOT call the Engine.
10. THE `consult` tool SHALL NOT convert a value: a string where the fact is a number, or a float where the fact is money, is an `INVALID_ANSWER` from the Engine.

### Requirement 4: `explain`

**User Story:** As Kiro, I want the proof of a fact, so that I can check a rule against the clause it cites while I write it.

#### Acceptance Criteria

1. THE `explain` tool SHALL take `kb` (required), `fact` (a fact name, required), `answers` (optional) and `token` (optional), and SHALL build the session as `consult` does (requirement 3.2 and 3.3).
2. THE `explain` tool SHALL call the Engine's `explain` on the session and the fact.
3. THE Payload SHALL be `{ "fact", "value", "proof", "text", "clauses" }`, where `proof` is the ProofNode tree with `fact`, `value` (or null), `source`, `rule`, `clause` and `because` (each omitted when absent) and `children`, `text` is the Proof_Text, and `clauses` maps each clause id cited in the tree to the clause's `title` and `text` from the knowledge base.
4. THE Proof_Text SHALL put one node on each line, indented two spaces per depth, in the form `<fact> = <value> [<source>]`, followed by ` by <rule> (clause <clause>): <because>` when the node has a rule.
5. WHEN a fact in the tree is unknown, THE Proof_Text and `proof` SHALL show it as unknown (`null` in `proof`, the word `unknown` in the text), and SHALL NOT fill it in.
6. THE `explain` tool SHALL accept goals, derived facts and askable facts as `fact`.
7. IF the Engine throws an `EngineError`, including `UNKNOWN_FACT`, THEN `explain` SHALL return a Tool_Error as in requirement 3.8.
8. IF the KB_File does not compile, THEN `explain` SHALL return `KB_INVALID` as in requirement 3.9.

### Requirement 5: `validate`

**User Story:** As Kiro, I want the validation findings for a knowledge base without leaving the chat, so that I can fix rules while I write them.

#### Acceptance Criteria

1. THE `validate` tool SHALL take `kb` (a KB_Ref, optional). WHEN it is omitted, THE tool SHALL validate every discovered KB_File.
2. THE `validate` tool SHALL call KB_Tools' `validateText` on each file, and SHALL NOT call the `dc` command or write a file.
3. THE Payload SHALL be `{ "results": [ { "ref", "path", "ok", "errors", "warnings", "diagnostics" } ] }`, where each diagnostic holds `severity`, `code`, `file`, `message` and, when present, `id` and `field`, in the order KB_Tools returns them, and `ok` is true when there is no error diagnostic.
4. THE `validate` tool SHALL return the same diagnostics, in the same order, as `pnpm dc validate` prints for the same file.
5. WHEN a KB_File cannot be read or decoded, THE result SHALL hold the diagnostic KB_Tools returns (`READ_ERROR` or the decoding code), and SHALL NOT make the call fail.

### Requirement 6: Errors, limits and robustness

**User Story:** As a maintainer, I want the server to survive any input, so that a bad call from a client never takes it down or leaks anything.

#### Acceptance Criteria

1. THE MCP_Server SHALL validate every tool's arguments against its input schema, and IF an argument is missing, of the wrong type or unknown, THEN the SDK's protocol error for invalid parameters SHALL be returned, and no handler logic SHALL run.
2. THE MCP_Server SHALL NOT let an exception leave a tool handler. An unexpected failure SHALL become the Tool_Error `INTERNAL` with a short message that holds no file path outside the Workspace_Root and no stack trace.
3. THE MCP_Server SHALL accept at most 200 keys in `answers`, a fact name of at most 100 characters, a string value of at most 500 characters, a `token` of at most 20,000 characters and a KB_File of at most 1 MiB (the kb-tools limit). IF a limit is exceeded, THEN the call SHALL return the Tool_Error `LIMIT_EXCEEDED` naming the limit.
4. THE MCP_Server SHALL cap a Payload at 200,000 characters. IF a Payload would be longer, THEN the tool SHALL return the Tool_Error `LIMIT_EXCEEDED` instead of a cut-off document.
5. A Tool_Error `message` SHALL be at most 500 characters, and every `code` SHALL be one of the Engine's ten error codes or `NO_WORKSPACE`, `UNKNOWN_KB`, `KB_INVALID`, `LIMIT_EXCEEDED` or `INTERNAL`.
6. THE MCP_Server SHALL treat `answers`, `fact` and `token` as data. It SHALL NOT interpolate them into a path, a command or a regular expression.
7. THE MCP_Server SHALL handle one call at a time per process, or SHALL make every call independent of every other (no shared mutable state), so that two concurrent calls cannot affect each other's result.

### Requirement 7: Read-only and local

**User Story:** As the human, I want an agent-facing server that cannot change my repo or reach the network, so that I can leave it on.

#### Acceptance Criteria

1. THE MCP_Server SHALL only read files, and SHALL read only `apps/*/kb/*.yaml` and `pnpm-workspace.yaml` under the Workspace_Root.
2. THE MCP_Server (the bundle `dist/server.mjs` and the source it is built from) SHALL NOT write a file, run a child process, open a network connection or read an environment variable. The launcher `bin/start.mjs` may run the build, and nothing else.
3. THE MCP_Server SHALL NOT call an LLM, and SHALL contain no analytics or logging of arguments.
4. THE MCP_Server's `dependencies` SHALL be `@dead-certain/engine` and `@dead-certain/kb-tools` (`workspace:*`), `@modelcontextprotocol/sdk` and `zod` at exact versions, and `yaml` only if the build needs it as an external. No other dependency SHALL be added without the human's approval.
5. THE engine SHALL keep zero runtime dependencies and `packages/engine` and `packages/kb-tools` SHALL NOT change in this spec's tasks, except that a defect found in them goes through a Bugfix spec.

### Requirement 8: Agreement with the engine and determinism

**User Story:** As a maintainer, I want proof that the server only relays the engine, so that a verdict seen through MCP can be trusted as the app's verdict.

#### Acceptance Criteria

1. FOR ANY knowledge base and any valid Answers, THE `consult` Payload SHALL carry the same Question or the same goal values and line items as `next(fold(answer, start(kb), answers))`.
2. FOR ANY two orderings of the same Answers (as JSON objects with the same keys), THE `consult` Payload SHALL be equal.
3. THE Replay_Token in a `consult` Payload SHALL decode, with the Engine's `decode`, to a session with the same Answers as the Payload's `answers`, and calling `consult` with that `token` and no `answers` SHALL return an equal Payload.
4. FOR ANY fact of a knowledge base, THE root of the `explain` proof SHALL have the value that `consult` reports for that fact when it is a goal, and SHALL be unknown when `consult` reports it unknown.
5. FOR ANY arguments whatever (including values that break the schema), THE handlers SHALL return a Tool_Result and SHALL NOT throw.
6. FOR ANY string used as `kb`, THE MCP_Server SHALL read no file other than a discovered KB_File.

### Requirement 9: Kiro can call it

**User Story:** As the human, I want to see Kiro consult and explain inside a chat, so that gate G5 has evidence and the demo has a shot.

#### Acceptance Criteria

1. WHEN the server passes its tests, THE Kiro_Lane SHALL set `"disabled": false` for `dead-certain` in `.kiro/settings/mcp.json` and change nothing else in that file.
2. IN a new Kiro session started from the Workspace_Root after that change, Kiro SHALL list the four tools.
3. IN that session, Kiro SHALL call `list_kbs`, then `consult` on `claim-check/policy` with a partial set of answers and with a full set of answers, then `explain` on a deduction fact and on the `payable` goal, and `validate` on `pre-flight/checklist`.
4. THE results of those calls SHALL match the golden scenario the answers come from: the same goal values and the same line-item values as in `apps/claim-check/golden/scenarios.yaml`.
5. THE Kiro_Lane SHALL record the session in `docs/kiro-log.md`: the calls made, what came back, and anything that failed. IF a call fails, THEN the log SHALL say so, and the gate SHALL NOT be reported as met.

### Requirement 10: Documentation

**User Story:** As a reader of the repo, I want to know what the server does and how to try it, so that the MCP row of the write-up is easy to check.

#### Acceptance Criteria

1. THE `README.md` SHALL gain a short section "MCP server" that names the four tools, shows the `mcp.json` entry, shows one `consult` call and its result, and says the server is read-only and runs no LLM.
2. THE Kiro_Lane SHALL record the SDK's exact version in `.kiro/steering/tech.md` where it now reads "(add when installed)".
3. THE `docs/kiro-log.md` SHALL get a dated entry for the execution session.

## Open questions and decisions

Decided by the brief:

- **Four tools.** `list_kbs`, `consult`, `explain`, `validate`, as in section 6 of the build plan. `audit` and `whatIf` are not tools. By the engine's mode-agreement property, `consult` with all facts equals `audit`, and its `needed` list says what is still open.
- **Design-First.** The build plan lists this spec as Requirements-First. The human asked for Design-First for the Phase 5 specs.

Open, for the human:

1. **The SDK's type needs.** `@modelcontextprotocol/sdk` may need `@types/node` for its stdio transport types, and the repo has none by rule (the engine and kb-tools declare the few Node names they use). If task 1 finds that `tsc --noEmit` fails without it, the choices are: add `@types/node` to `packages/mcp` only, or declare the few names locally and skip library checking for the SDK (`skipLibCheck` is already on). Recommended: declare locally first, and ask before adding a dependency.
2. **Build on every start.** `start` rebuilds the bundle when the source is newer. The alternative, a shim that fails with a message when the bundle is missing (as `bin/dc.mjs` does), is faster but leaves Kiro with a silent failed server on a fresh clone. Recommended: build on start, quietly.
3. **KB_Ref form.** `claim-check/policy` (app and file stem) is proposed over the knowledge base's `id` field (`claim-check`), because an app may hold two files and `id` is not unique by rule. Say if you prefer the bare `id` when it is unique.
4. **Where the Kiro check runs.** Requirement 9 needs a Kiro session that starts after `mcp.json` changes, so the executing session cannot do it alone. Recommended: the executing session stops at task 7 and tells you; you start a new CLI session in the repo root, and the second session does tasks 7.2 and 7.3.
5. **Write tools.** Should a later spec let the server propose a rule or a golden scenario? This spec says no: it is read-only on purpose, and the `knowledge-engineer` agent is the only writer of `kb/`.
6. **Who writes the README section.** `AGENTS.md` does not assign `README.md` to a lane, and Claude Code wrote the two app sections. Task 8 has Kiro write the "MCP server" section, since it describes Kiro's package. Say if Claude Code should write it instead.
