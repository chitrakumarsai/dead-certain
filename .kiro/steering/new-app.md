---
inclusion: manual
---

# Scaffolding a new app (`/new-app`)

How to add a third (or fourth) app to the Dead Certain skeleton. The command is `pnpm new-app <name>`. It is the source of truth: `scripts/new-app.ts` and `templates/app/`. The spec is `.kiro/specs/app-template`.

## 1. Run the command

From any folder below the repo root:

```bash
pnpm install
pnpm new-app my-app
pnpm install
```

The name is lower-case words joined by hyphens, 2 to 30 characters. The command refuses a bad name, a name that is taken, and the reserved names `site`, `kit`, `assets`, `templates`, `index` and `404`. It plans everything before it writes anything, and undoes its own writes if a write fails. `--dry-run` prints the plan and changes nothing. It runs no install and makes no network call, so the second `pnpm install` is yours. Commit `pnpm-lock.yaml` with the app, because CI installs with a frozen lockfile.

The README section "Add a third app" holds the same commands. The `scaffold` job in `ci.yml` runs them with the name `ci-probe` on every pull request that changes `scripts/`, `templates/`, `README.md`, `playwright.config.ts` or `ci.yml`, so the README and the command cannot drift apart.

## 2. What it creates

```
apps/<name>/
├── package.json          # @dead-certain/<name>, the same exact pins as Claim Check
├── vite.config.ts        # base: "/dead-certain/<name>/"
├── index.html
├── src/
│   ├── config.ts         # the one file that names a fact: verdictGoal
│   ├── main.tsx, kb.ts, kbShape.ts, route.ts, useTitle.ts
│   ├── session/          # path, progress, replay, store, with their tests
│   ├── screens/          # Start, Consult, Verdict, Xray, CopyLink, Stale, LoadFailure, NotFound
│   └── lanes.test.ts     # the lane guard
├── rulebook/starter.md   # the starter rulebook (a fictional library fine)
├── kb/starter.yaml       # the starter rules; kb/open-questions.md; kb/dist/ after dc build
└── golden/scenarios.yaml # golden scenarios
e2e/<name>-smoke.spec.ts  # answers the questions, opens "See why", runs axe
```

The Template is not a workspace package and is not built or type-checked on its own. The generated app is.

## 3. What it edits

Two shared files, at four marker comments. Each marker occurs once, and the command refuses if one is missing or doubled. Leave the markers in place.

| Marker | File | Line added before it |
| --- | --- | --- |
| `new-app:urls` | `playwright.config.ts` | `export const <NAME>_URL = "http://localhost:<port>/dead-certain/<name>/";` |
| `new-app:servers` | `playwright.config.ts` | A `webServer` entry that builds the app and previews it on its port with `--strictPort` |
| `new-app:dc-build` | `.github/workflows/ci.yml` | `- run: pnpm dc build apps/<name>` |
| `new-app:copy` | `.github/workflows/ci.yml` | `- run: cp -R apps/<name>/dist apps/site/dist/<name>` |

The port is one more than the highest preview port in `playwright.config.ts` (4176 for the third app). It is not `deploy.yml`: the workflow is `ci.yml`.

The command does not edit `apps/site`. Add the link to the new app by hand in `apps/site/index.html`, beside the other apps (Claude Code lane).

## 4. Write the rulebook

Replace `apps/<name>/rulebook/starter.md` or add a file beside it. Number the clauses (`1`, `2.1`) and state every threshold and every branch. Anything the rulebook leaves open goes to `kb/open-questions.md`, not into a guess.

## 5. Run the knowledge-engineer agent

On a clean branch, from the repo root:

```bash
git checkout -b kiro/kb-<name>
kiro-cli chat --agent knowledge-engineer
```

Prompt (substitute the name and the rulebook path):

```
Compile apps/<name>/rulebook/<rulebook>.md into apps/<name>/kb.
Write one rule per clause, each citing its clause id. Put anything the rulebook leaves open into open-questions.md instead of guessing.
Run pnpm dc validate apps/<name> until it is clean.
Then write at least 12 golden scenarios in apps/<name>/golden/scenarios.yaml, with every rule firing in at least one, and run pnpm dc golden apps/<name> until every scenario passes.
```

The agent's files replace the starter. If the compiled file is no longer `kb/dist/starter.json`, change the import in `src/config.ts` and the module name in `src/json.d.ts`.

## 6. Point the app at the new goal

In `apps/<name>/src/config.ts` set `verdictGoal` to the goal whose value is the verdict word. It is the only file that names a fact. A goal value of `paid`, `reduced`, `denied`, `ready` or `not_ready` gets the kit's headline. Any other value gets a plain heading and the goal values. A test fails if another file names a fact.

## 7. Review every rule

For each rule in `apps/<name>/kb/*.yaml`, confirm that:

- `cite` names a real clause in the rulebook.
- `to` and `when` say what the clause says, with no invented threshold.
- Every question in `open-questions.md` has a decision before the app ships.

## 8. Run the gate

```bash
pnpm dc validate apps/<name>
pnpm dc golden apps/<name>
pnpm dc build apps/<name>
pnpm check
pnpm build
pnpm e2e
```

`pnpm dc golden` prints a `TOO_FEW_SCENARIOS` warning for the starter (4 scenarios, 12 asked for). That is expected until the agent writes the real set. Attach the test output and screenshots at 390, 768 and 1280 px to the pull request.

## Lanes

- `apps/<name>/kb`, `rulebook` and `golden`: the Kiro `knowledge-engineer` agent and the human. Claude Code does not edit them, and the generated lane guard fails a Claude Code commit that does.
- `apps/<name>/src`, `e2e`, `scripts`, `templates` and `.github`: Claude Code.
