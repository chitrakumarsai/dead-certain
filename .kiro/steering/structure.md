---
inclusion: always
---

# Repo structure

## Layout

```text
dead-certain/
├── .kiro/                  # steering, specs, hooks, agents, settings
├── .claude/                # settings.json, rules/ui.md
├── AGENTS.md               # shared rules loaded by both tools
├── CLAUDE.md               # Claude Code entry point (imports AGENTS.md)
├── LICENSE  README.md
├── docs/                   # BUILD_PLAN.md, kb-format.md, kiro-log.md
├── packages/
│   ├── engine/             # pure TypeScript, zero runtime dependencies
│   ├── kb-tools/           # YAML loader, validator, the dc command
│   ├── mcp/                # MCP server over the engine
│   └── ui/                 # design tokens and React components
├── apps/
│   ├── claim-check/        # app 1 — rulebook/, kb/, src/
│   ├── pre-flight/         # app 2 — rulebook/, kb/, src/, collectors/
│   └── site/               # landing page and component gallery
├── templates/app/          # source for pnpm new-app <name>
└── e2e/                    # Playwright tests and golden scenarios
```

## Directory ownership by lane

| Path | Lane | Notes |
| --- | --- | --- |
| `.kiro/**` | Kiro | Specs come only from Kiro sessions. Never hand-write `.kiro` files. |
| `packages/engine` | Kiro | Public API in `src/types.ts` is the contract between lanes; changes need both lanes' consent |
| `packages/kb-tools` | Kiro | |
| `packages/mcp` | Kiro | |
| `packages/ui` | Claude Code | |
| `apps/*/src` | Claude Code | |
| `apps/site` | Claude Code | |
| `apps/pre-flight/collectors` | Claude Code | |
| `apps/*/kb` | Kiro `knowledge-engineer` agent + human | YAML knowledge bases compiled at build time |
| `apps/*/rulebook` | Kiro `knowledge-engineer` agent + human | Source rulebooks |
| `e2e` | Claude Code | |
| `scripts` | Claude Code | |
| `.github` | Claude Code | |
| `.claude` | Claude Code | |
| `templates` | Claude Code | |
| Root config files | Claude Code | `package.json`, `biome.json`, `tsconfig.json`, etc. |

Each lane stays in its own directories. Each tool reviews the other's lane on pull requests.

## Branches and naming

| Lane | Branch pattern | Example |
| --- | --- | --- |
| Kiro | `kiro/<topic>` | `kiro/inference-engine` |
| Claude Code | `cc/<phase>-<topic>` | `cc/phase1-ui-kit` |

Lanes merge at gates, one pull request per gate.

## Package naming

Workspace packages use the `@dead-certain/` scope:

- `@dead-certain/engine`
- `@dead-certain/kb-tools`
- `@dead-certain/mcp`
- `@dead-certain/ui`
- `@dead-certain/claim-check`
- `@dead-certain/pre-flight`
- `@dead-certain/site`

## Knowledge-base layout

Each app stores its knowledge base under `apps/<app>/kb/*.yaml`. The `dc` command validates and compiles them to JSON at build time. The full grammar is in `docs/kb-format.md`.
