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
- The design refuses: uppercase labels, a caption above headings, arrows in button labels, exclamation marks, apologies in errors, and colour as the only signal.
- Lifted with limits (steering, What this design refuses): dark default plus a light theme; depth only through the four depth tokens; gradients only in the named gradient tokens; scroll entrance animation on the landing page only.
- Screenshot and run axe in both themes.
