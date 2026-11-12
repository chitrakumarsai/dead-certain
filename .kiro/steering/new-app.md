---
inclusion: manual
---

# Scaffolding a new app (`/new-app`)

Follow these steps to add a third (or fourth) app to the Dead Certain skeleton. Each step is a command or a file to create; complete them in order.

## 1. Run the scaffold command

From the repo root:

```bash
pnpm new-app <name>
```

This copies `templates/app/` to `apps/<name>/` and replaces the placeholder name throughout. It creates:

```
apps/<name>/
├── package.json          # name: @dead-certain/<name>
├── vite.config.ts        # base: "/<name>/"
├── tsconfig.json         # extends root
├── index.html
├── src/
│   └── main.tsx
├── rulebook/             # put the source rulebook here
└── kb/                   # knowledge base lives here after step 4
```

## 2. Register in the pnpm workspace

`pnpm-workspace.yaml` already includes `apps/*`, so the new package is picked up automatically. Verify with:

```bash
pnpm -r ls --depth 0
```

The new app should appear in the list.

## 3. Add the Vite build to the root build script

The root `package.json` builds with `pnpm -r --if-present build`. No change is needed unless you want a custom build order.

Add the app's URL to the GitHub Pages deployment in `.github/workflows/deploy.yml` (Claude Code lane).

## 4. Write the rulebook

Create `apps/<name>/rulebook/<rulebook>.md` with numbered clauses. Each clause should have a unique id (e.g. `1.1`, `2.3`) and a clear, unambiguous statement.

Checklist before continuing:
- Every threshold the rules will use is stated explicitly.
- Every decision branch is covered.
- Ambiguities are resolved or noted for `open-questions.md`.

## 5. Run the knowledge-engineer agent

Start the CLI from the repo root on a clean branch:

```bash
git checkout -b kiro/kb-<name>
kiro-cli chat --agent knowledge-engineer
```

Give it this prompt (substituting your app name and rulebook path):

```
Compile apps/<name>/rulebook/<rulebook>.md into apps/<name>/kb.
Write one rule per clause, each citing its clause id. Put anything the rulebook leaves open into open-questions.md instead of guessing.
Run pnpm dc validate until it is clean.
Then write 12 golden scenarios in apps/<name>/kb/golden.yaml, with every rule firing in at least one.
```

Approve tool calls as the agent asks. When it finishes, review the diff.

## 6. Review every rule

For each rule in `apps/<name>/kb/*.yaml`, confirm:
- The `cite` field matches a real clause id in the rulebook.
- The `to` expression matches what the clause says — no invented thresholds.
- Anything in `open-questions.md` has a decision before the app ships.

Run `pnpm dc validate` to confirm a clean slate.

## 7. Add the app to the site and the CI deploy

- Link to the new app from `apps/site/src/` (Claude Code lane).
- Add a snapshot of a sample audit to `apps/<name>/src/fixtures/` for the rate-limit fallback if the app calls an external API.

## 8. Run the full gate check

```bash
pnpm check
pnpm dc validate
pnpm dc build
pnpm e2e
```

All must pass before merging. Attach the test output and screenshots at 390, 768 and 1280 px to the pull request.
