---
paths:
  - "packages/ui/**"
  - "apps/*/src/**"
---

# Interface work

Before editing these paths, read `.kiro/steering/design-system.md` and section 8 of `docs/BUILD_PLAN.md`.

- Load the `frontend-design` skill. Refine the section 8 direction. Do not replace it.
- Use the tokens in `packages/ui/tokens.css`. Do not hardcode colors, type sizes or spacing.
- After each task, screenshot at 390, 768 and 1280 px with Playwright, read the console and run axe.
- The design refuses: global dark mode, uppercase labels, shadows, gradients, scroll entrance animation, arrows in button labels.
