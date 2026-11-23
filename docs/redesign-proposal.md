# Redesign proposal: darkroom and lightbox

Status: proposal, awaiting human approval. Written by Claude Code on 2026-11-23 against `main` at `010734d`.
Nothing under `packages/`, `apps/` or `.kiro/` has changed. Kiro amends steering and specs first (section 4).

## 1. Colour tokens

All values stay in `packages/ui/tokens.css`, the only file that holds a hex colour. Ratios were computed with the WCAG formula. They match the figures in the brief.

### Dark theme (default)

| Token | Value | Use |
| --- | --- | --- |
| `--bg-base` | `#07131A` | The dark room, page background |
| `--bg-surface-1` | `#0B1C26` (`--film`) | Cards, panels, film |
| `--bg-surface-2` | `#10242F` | Inputs, raised elements on film |
| `--bg-surface-3` | `#16303C` | Hover, popovers, menus, command palette |
| `--border-subtle` | bone at 6% | Decorative card edges only |
| `--border-default` | bone at 10% | Decorative dividers only |
| `--border-strong` | bone at 18% | Hovered card edges only |
| `--control-border-dark` | `#8FA6AE` (`--bone-soft`) | **New.** Input, radio card and toggle boundaries |
| `--text-primary` | `#DCE8EB` (`--bone`) | Body text on dark |
| `--text-secondary` | `#B4C6CC` | Secondary text |
| `--text-tertiary` | `#8FA6AE` (`--bone-soft`) | Hints, metadata |
| `--wax` | `#F2C12E` | The single accent |
| `--wax-hover` | `#F6CF55` | Primary button hover |
| `--wax-muted` | wax at 12% | Accent background |
| `--wax-glow` | wax at 25% | Glow only, never a boundary |
| `--on-wax` | `#07131A` | Text on wax |
| `--paid-dark` | `#4CC38A` | Paid state on dark (always with icon and word) |
| `--reduced-dark` | `#E3A03C` | Reduced state on dark |
| `--denied-dark` | `#F0705F` | Denied state on dark |
| `--focus-dark` | wax | Focus ring on dark and on film |

Contrast on the four dark surfaces (base / s1 / s2 / s3):

| Foreground | base | s1 | s2 | s3 | Floor |
| --- | --- | --- | --- | --- | --- |
| text-primary | 15.03 | 13.89 | 12.76 | 11.03 | 4.5 |
| text-secondary | 10.64 | 9.84 | 9.04 | 7.81 | 4.5 |
| text-tertiary | 7.37 | 6.81 | 6.26 | 5.41 | 4.5 |
| wax | 11.14 | 10.30 | 9.46 | 8.17 | 4.5 |
| paid-dark | 8.49 | 7.85 | 7.21 | 6.23 | 4.5 |
| reduced-dark | 8.38 | 7.75 | 7.12 | 6.15 | 4.5 |
| denied-dark | 6.43 | 5.95 | 5.46 | 4.72 | 4.5 |
| hero gradient end (bone at 60%) | 5.95 | – | – | – | 3 (large text) |
| border-subtle / default / strong | 1.13 / 1.25 / 1.59 | | | | **fails 3:1** |

Other pairs: on-wax on wax 11.14, on-wax on wax-hover 12.51, bone on wax-muted 10.91, wax on wax-muted 8.09.

**Gap found in the brief.** The three rgba borders are 1.1 to 1.7:1. That is fine for decorative card edges. It fails WCAG 1.4.11 when a border is the only thing that shows where an input, a radio card or the theme toggle sits. Hence the new `--control-border-dark` (bone-soft, 6.26:1 on surface-2). The paper focus blue `#1F6FEB` also fails on surface-3 (2.98:1), so on dark the focus ring is always wax, as the brief says.

### Paper (both themes, unchanged)

`--paper #FCFEFE`, `--ink #13222C` (16.05), `--ink-soft #4A5A64` (7.06), `--hairline #C9D5D9`, `--paid #1B6E46` (6.16), `--reduced #8A5200` (6.31), `--denied #A8261C` (7.01), `--focus-paper #1F6FEB` (4.58). Wax is never text on paper.

### Light theme

| Token | Value | Ratios for ink / ink-soft / tertiary |
| --- | --- | --- |
| `--bg-base` | `#EDF2F3` (`--lightbox`) | 14.38 / 6.33 / 4.89 |
| `--bg-surface-1` | `#FCFEFE` (`--paper`) | 16.05 / 7.06 / 5.46 |
| `--bg-surface-2` | `#F4F8F9` | 15.19 / 6.69 / 5.17 |
| `--bg-surface-3` | `#E2EAEC` | 13.31 / 5.86 / 4.53 |
| `--text-tertiary` (light) | `#5B6B74` | new; at least 4.5 on every light surface |
| verdict states | today's paper values | at least 5.12 on every light surface |

In both themes, film stays `#0B1C26`.

**Note.** Wax against the lightbox is 1.49:1. In the light theme wax is a fill or a glow only. A wax primary button is still identified by its ink label (9.62:1), and the ring around it is focus blue.

**Material clash to resolve.** In the dark theme, `--film` equals `--bg-surface-1`, so a plain card and the X-ray film would look the same. To keep film meaning proof, film alone gets grain, a `--border-strong` edge and luminous bone strokes. Ordinary cards get none of these.

## 2. Type scale

One family (IBM Plex), three voices. No new font files: Serif and Sans 400 and 600, and Mono 400, are already self-hosted.

| Style | Voice | Desktop | Phone | Tracking |
| --- | --- | --- | --- | --- |
| Display / hero h1 | Serif 600 | 64/68 | 40/44 | -0.03em |
| H2 | Sans 600 | 40/44 | 30/36 | -0.02em |
| Verdict | Serif 400 | 48/56 | 36/44 | 0 (unchanged) |
| Summary (Pre-Flight) | Serif 400 | 36/44 | 36/44 | 0 (unchanged) |
| Question | Sans 600 | 24/32 | 21/28 | -0.01em (unchanged size) |
| Doc body / fine | Serif 400 | 17/28, 14/22 | same | 0 (unchanged) |
| Sys body | Sans 400 | 17/26 | 16/26 | 0 |
| UI label | Sans 400/600 | 14/20, 13/18 | same | 0 |
| Mono, kbd | Mono 400 | 14/22, 13/20 | same | 0 |

I recommend keeping Plex Sans and not adding Inter. The three-voice idea depends on one family, and Inter would add a dependency and a font file.

## 3. Radius, depth, motion tokens

- Radius: paper 4, controls 8 (was 6), film and cards 12 (was 8), pill 999.
- New `--shadow-*` and `--glow-*` tokens, used only through `@utility` classes in `theme.css`. They are `--highlight-inset` (`inset 0 1px 0 rgb(255 255 255 / 4%)`), `--glow-wax-soft`, `--glow-wax-pulse` and `--halo-paper`.
- New durations: `--dur-hover 110ms`, `--dur-enter 200ms`, `--dur-page 250ms`, `--dur-menu 150ms`. These stay as they are: `--dur-press 120`, `--dur-panel 200`, `--dur-xray 500`, `--dur-reduced 120`, `--ease`.

## 4. Steering amendments for Kiro (`.kiro/steering/design-system.md`)

1. **Color tokens.** Add every token in section 1, for both themes. `--film` keeps its meaning of proof, which means grain, a strong edge and bone strokes.
2. **Materials.** The room is dark by default. Paper is a lit sheet on it, and film is proof. Both materials stay.
3. **Radius.** Controls 8, film and cards 12, pills full.
4. **Refusals lifted:**
   - "No global dark mode" becomes: a dark default and a light theme. The toggle stores the choice in localStorage under one key (`dc-theme`), inside try/catch, and falls back to `prefers-color-scheme`.
   - "No drop shadows" becomes: the inset top highlight, wax glow and paper halo, through tokens only. Still no shadows that suggest elevation.
   - "No gradient washes" becomes: allowed only for the hero radial glow, the hero headline fill, the graph-paper grid and film grain, and the scan line, which already uses one.
   - "No entrance animation on scroll" becomes: one fade and 16 px rise per section on the landing page only. Never inside the apps.
5. **Refusals that stay:** no uppercase labels, no caption above headings, no arrows in button labels, sentence case, no exclamation marks, no apologies in errors, colour never alone, and no pumpkins, bats or blood.
6. **Motion table.** Add hover, enter, page, menu, blur-in, spotlight, shine, tilt and success pulse, with their reduced-motion replacements.
7. **Components.** Add `CommandMenu`, `ThemeToggle`, `Toast`, `Kbd`, `Pill`, `FeatureCard` and `Illustration`. `AppShell` gains the command trigger and the theme toggle.
8. **Specs.** `ui-kit`, `claim-check-app`, `pre-flight-app` and `landing-page` need new tasks for this work, because plans come only from `.kiro/specs/*/tasks.md`. Requirement 29 (pinned deps) and the contrast property (Property 11) gain the new pairs. Property 12 (no refused patterns) narrows as above.
9. `.claude/rules/ui.md` (Claude Code lane): I update its refusal line to match once Kiro has amended the steering.

## 5. Test changes

- `refusals.test.ts`:
  - Allow box-shadow and gradients only when their value comes from a token.
  - Drop the dark-mode refusal and add a check that `prefers-color-scheme: dark` appears only in tokens.css.
  - Allow `localStorage` in exactly one file, `packages/ui/src/theme/storage.ts`.
  - Mirror the same storage exception in `apps/site/src/landing/lane.test.ts`.
  - Keep the uppercase, third-party URL and arrow scans.
- Tailwind keeps blocking the words `uppercase`, `ring` and `shadow`. Glows are custom `@utility` classes, so Tailwind's shadow and ring utilities stay out.
- `tokens.contrast.test.ts`: every pair in section 1, for both themes.
- e2e and axe: every screen in both themes, and the `/kit` baseline in both themes.

## 6. Dependencies

None requested. The command menu is built on the Radix Dialog already installed, with filtering done by hand over at most about 60 items. Icons stay in the kit's own set, redrawn at 16 px with a 1.5 px stroke. Toasts reuse the existing live region. Grain is an inline SVG `feTurbulence` data URI, so there is no image request.

## 7. Risks

- **Schedule.** The target is Dec 2. Gate G5 is still open and Phase 6 has not started. The brief rebuilds every screen in three front ends, adds SEO, OG images and a command menu, and doubles the screenshot baseline. Expect several days of Claude Code work, plus Kiro review cycles at each pull request.
- **Lighthouse 95 on mobile.** These all cost paint time: backdrop-blur on the header, blur-in on the LCP headline, a scroll-linked tilt and full-page grain. Mitigations: the h1 starts at opacity 0.01, not 0; the tilt uses `animation-timeline: view()` where supported and is static elsewhere; grain is drawn only on film.
- **OG images** are static PNGs, rendered once with Playwright from a dedicated page and committed.
- **JSON-LD:** Organization (decided 2026-11-23), not Person.

## 8. Decision

Approved by the human on 2026-11-23, with no new dependencies and JSON-LD Organization. If time runs short, cut SEO and OG images first, then the command menu.
