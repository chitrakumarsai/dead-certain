---
inclusion: always
---

# Tech stack

## Pinned versions

| Package | Version |
| --- | --- |
| Node | 22 (see `.nvmrc`) |
| pnpm | 10.9.0 |
| TypeScript | 7.0.2 |
| Vite | 8.3.8 |
| Vitest | 5.1.0 |
| fast-check | (add when installed) |
| Biome | 2.6.7 |
| Playwright | 1.65.0 |
| `@modelcontextprotocol/sdk` | (add when installed) |

Vitest is the unit and integration test runner. fast-check is the property-test library (files named `*.props.test.ts`). Playwright drives end-to-end and accessibility tests.

## Layer choices

| Layer | Choice |
| --- | --- |
| Language | TypeScript in strict mode, Node 22 |
| Workspace | pnpm workspaces (no extra orchestrator) |
| Apps | Vite, React, Tailwind CSS, Radix primitives, Motion |
| Knowledge bases | YAML source → Zod validation → JSON at build time |
| Tests | Vitest (unit/property), fast-check (properties), Playwright (e2e), axe-core (a11y) |
| Lint and format | Biome |
| MCP server | `@modelcontextprotocol/sdk` over stdio |
| Hosting | GitHub Pages via GitHub Actions |
| License | MIT |

## Key constraints

- The engine (`packages/engine`) has **zero runtime dependencies**.
- No LLM call at run time, no backend, no analytics, no secrets in the repo.
- The apps make no network calls except the GitHub REST API in Pre-Flight.
- All Python (if any) is managed with `uv` only: `uv sync`, `uv add`, `uv run`, with a committed `uv.lock`.

## Package scripts (every gate runs these)

| Script | Does |
| --- | --- |
| `pnpm check` | Biome lint + format check, `tsc --noEmit`, Vitest unit + property tests |
| `pnpm check:changed` | Same, limited to changed packages |
| `pnpm test:props` | Property tests only (`*.props.test.ts`) |
| `pnpm e2e` | Playwright end-to-end tests |
| `pnpm build` | Builds every app |
| `pnpm dc validate` | Knowledge-base static checks |
| `pnpm dc build` | Compiles knowledge bases from YAML to JSON |
