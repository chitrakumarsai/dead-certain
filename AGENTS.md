# Dead Certain: shared agent rules

Rules for every coding agent in this repo. Kiro loads this as steering. Claude Code imports it from `CLAUDE.md`.
The full brief is `docs/BUILD_PLAN.md`. Where this file and a globally installed rule pack disagree, this file wins.

## Commands

Node 22 (`.nvmrc`) and pnpm. Every gate is a package script, so hooks, agents and CI all run the same thing.

| Command | Does |
| --- | --- |
| `pnpm check` | Biome lint and format check, `tsc`, unit and property tests |
| `pnpm check:changed` | The same, limited to changed files |
| `pnpm test:props` | Property tests only (files named `*.props.test.ts`) |
| `pnpm e2e` | Playwright end-to-end tests |
| `pnpm build` | Builds every app |
| `pnpm dc validate`, `pnpm dc build` | Knowledge-base checks and build (arrives with the `kb-tools` spec) |

## Lanes

| Path | Owner |
| --- | --- |
| `.kiro/**` | Kiro. Specs come only from Kiro sessions |
| `packages/engine`, `packages/kb-tools`, `packages/mcp` | Kiro |
| `apps/*/kb`, `apps/*/rulebook` | Kiro `knowledge-engineer` agent and the human |
| `packages/ui`, `apps/*/src`, `apps/site`, `apps/pre-flight/collectors` | Claude Code |
| `e2e`, `scripts`, `.github`, `.claude`, `templates`, root config | Claude Code |

- Stay in your lane, even when crossing it would be faster. Each tool reviews the other's lane.
- `packages/engine/src/types.ts` is the contract between the lanes. It changes only with both lanes' consent.
- Branches: `kiro/*` and `cc/<phase>-<topic>`. Lanes merge at gates, one pull request per gate.
- Plans come from `.kiro/specs/*/tasks.md`. Do not create a second plan.

## Hard rules

- TypeScript in strict mode. The engine has zero runtime dependencies.
- No LLM call at run time, no backend, no analytics, no secrets in the repo.
- The apps make no network calls, except the GitHub REST API in Pre-Flight.
- Ask the human before adding a dependency that section 7 of the build plan does not list.
- Python, if any, is managed with uv only.
- Never list `.kiro` in `.gitignore`. Never hand-write `.kiro` files to imitate Kiro activity.
- Keep tool attribution on commits.

## Definition of done

1. Tests pass locally and in CI.
2. Evidence is attached: test output, and screenshots at 390, 768 and 1280 px for interface work.
3. Docs are updated where behavior changed.
4. Kiro marks the task complete in its spec's `tasks.md`.
