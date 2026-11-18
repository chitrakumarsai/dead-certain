# dead-certain

## Claim Check

Claim Check works out how much of a hospital bill a sample health policy pays. It asks one question at a time, only the ones that matter, and then shows the amount paid, each deduction and the clause behind it. "See why" opens the proof of any line: the rules that fired, the facts they used and the clause each rule cites. The policy is written for this project; no real insurer's document is used.

The rules come from `apps/claim-check/kb/policy.yaml`, compiled at build time. A deterministic engine decides in the browser. Nothing is sent anywhere and nothing is stored.

### Run it

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
