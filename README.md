# dead-certain

## Claim Check

Claim Check works out how much of a hospital bill a sample health policy pays. It asks one question at a time, only the ones that matter, and then shows the amount paid, each deduction and the clause behind it. "See why" opens the proof of any line: the rules that fired, the facts they used and the clause each rule cites. The policy is written for this project; no real insurer's document is used.

The rules come from `apps/claim-check/kb/policy.yaml`, compiled at build time. A deterministic engine decides in the browser. Nothing is sent anywhere and nothing is stored.

### Getting started

```sh
pnpm install
pnpm dc build apps/claim-check   # compiles the knowledge base the app imports
pnpm --filter @dead-certain/claim-check dev
```

`pnpm --filter @dead-certain/claim-check build` builds it for GitHub Pages under `/dead-certain/claim-check/`.

### The replay link

The answers live in the URL fragment: `#/?r=<token>`. The same link always gives the same verdict, and "Copy link to this verdict" copies it. A link made under older rules, or one that cannot be read, shows a notice and offers to start again, never a wrong verdict. The rulebook is at `#/rulebook`, and `#/rulebook?clause=4.2` opens on one clause.

### Not finished

Nothing in the spec is left undone. Two cases are tested only in unit tests, because the interface cannot reach them with the real policy: an answer the engine rejects, and a clause that no rule uses.

## Pre-Flight

Pre-Flight checks a public GitHub repository against a submission checklist of nine checks (R-01 to R-09). Each check passes, fails or waits for your answer, with the rule and the evidence behind it, and "Why" opens its proof. A facts-only collector reads the repository; the same deterministic engine as Claim Check decides. The demo video's length cannot be read from GitHub, so Pre-Flight asks for it, and asks anything else it cannot see.

### Getting started

```sh
pnpm install
pnpm dc build apps/pre-flight   # compiles the knowledge base the app imports
pnpm --filter @dead-certain/pre-flight dev
```

Enter `owner/name` or a GitHub URL, or try one of the three samples. `pnpm --filter @dead-certain/pre-flight build` builds it for GitHub Pages under `/dead-certain/pre-flight/`.

### The four requests

A live run makes four unauthenticated requests to `api.github.com`, one after another, and nothing else:

1. `GET /repos/{owner}/{name}`: public or private, archived, the licence GitHub detects, and the default branch.
2. `GET /repos/{owner}/{name}/git/trees/{branch}?recursive=1`: the file tree (a licence file, `.kiro`, specs, app folders).
3. `GET /repos/{owner}/{name}/contents/.gitignore`: whether `.kiro` is ignored.
4. `GET /repos/{owner}/{name}/readme`: whether the README has run instructions.

No token, cookie or storage is used. GitHub allows 60 such requests an hour per browser; when that runs out, Pre-Flight says when to try again and offers the samples, which make no request.

### Samples and recorded responses

The samples and the collector's tests use real GitHub responses saved in `apps/pre-flight/collectors/recorded/`. A sample is the collector run over those files, so it matches a live run of the same responses. Tests never call GitHub.

- `pnpm record:snapshots` records them: four requests for each of three repositories (this one, `dc-sample-not-ready` and `dc-sample-warnings`), 12 in all. It keeps only the rate-limit and content-type headers.
- A maintainer runs it by hand, and re-runs it when this repository's `.gitignore`, `.kiro` folder, README or app folders change.
- Responses that cannot be recorded safely, such as a rate limit or an empty repository, are hand-written in `recorded/synthetic/` and marked `"synthetic": true`.

### Not finished

Nothing in the spec is left undone. No sample is ready as it stands: the demo video length can never be read from GitHub, so a report is at best undecided until you answer it. The sample of this repository asks only that, and answering under 180 seconds makes it ready.

## MCP server

`packages/mcp` is a Model Context Protocol server over the same engine. An agent such as Kiro can run a knowledge base and read its proofs without opening a browser. It is read-only (it never writes a file), makes no network call and has no LLM in it: every answer comes from the deterministic engine.

| Tool | Does |
| --- | --- |
| `list_kbs` | Lists the knowledge bases in `apps/*/kb/*.yaml`, compiled fresh, with goals and counts. Call it first. |
| `consult` | Takes `kb` and the answers so far. Returns the next question (with why it matters and its clause) or the verdict with line items, and a replay token. |
| `explain` | Takes `kb`, a `fact` and the same answers or token. Returns the proof of that fact as JSON and as an indented outline, with the clauses it cites. |
| `validate` | Runs the same checks as `pnpm dc validate` on the YAML on disk. |

Add it to `.kiro/settings/mcp.json` (other MCP clients take the same command), then start a new session from the repo root:

```json
{
  "mcpServers": {
    "dead-certain": {
      "command": "pnpm",
      "args": ["-s", "--filter", "@dead-certain/mcp", "start"]
    }
  }
}
```

The launcher rebuilds `dist/server.mjs` when the source is newer, so no separate build step is needed.

Example: `consult` on `claim-check/policy` with no answers.

```json
{ "kb": "claim-check/policy" }
```

```json
{
  "status": "question",
  "question": {
    "fact": "claimed",
    "text": "What is the total on the final hospital bill?",
    "why": "The policy pays the hospital bill less its deductions, and never more than the bill.",
    "clause": "1.2",
    "type": "money"
  },
  "answers": {},
  "token": "AatnA4A26XRDn5MfWyyQLVIA"
}
```

Money is an integer in minor units. With all of golden scenario `G-01` the result is `status: "verdict"`, `payable` 13200000 and `outcome` `reduced`.
