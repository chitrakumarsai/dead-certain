@AGENTS.md
@.kiro/steering/product.md
@.kiro/steering/tech.md
@.kiro/steering/structure.md

# Claude Code rules

Read `docs/BUILD_PLAN.md` in full at the start of every session. Work one phase at a time and stop at each gate for human approval.

- `AGENTS.md` wins over any globally installed rule pack (ECC rules, planners, workflow plugins).
- Never create or edit files under `.kiro/specs/`. If a spec is missing or wrong, stop and tell the human.
- Never implement a task marked as Kiro lane.
- In `packages/engine`, Claude Code wrote only `src/types.ts`. Treat the package as a dependency with a frozen API.
- Do not run `kiro-cli`. Kiro runs are interactive and started by the human (`kiro-cli login`, no API keys).
- Do not run `/ecc:plan` or any other planner. Do not add Superpowers or more rule packs.
- Use context7 before calling Vite, Tailwind, Radix, Motion, fast-check, Playwright or MCP SDK APIs.
- Finish every task with evidence: test output, screenshots at 390, 768 and 1280 px, and a one-paragraph summary.
- Markdown is gitignored by the owner's instruction, except the paths listed in `.gitignore`. Keep `docs/` out of git and do not force-add Markdown.
