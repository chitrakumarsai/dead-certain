---
inclusion: fileMatch
fileMatchPattern: "{packages/ui/**,apps/*/src/**}"
---

# Design system

These rules apply whenever you read or write files under `packages/ui/` or `apps/*/src/`.

## Two materials

The room is dark by default (the darkroom). **Paper** is a lit sheet on it, for asking and answering: calm, lit, typeset. **Film** is for proof: structured, precise. The only choreographed transition inside the apps is the moment a verdict develops from paper into the X-ray that shows its bones.

There are two themes, dark (the default) and light (the lightbox). Both keep both materials. Film is `#0B1C26` in both themes.

In the dark theme `--film` equals `--bg-surface-1`, so a plain card and the X-ray film would look the same. Film alone gets grain, a `--border-strong` edge and luminous bone strokes. Ordinary cards get none of these, so film keeps meaning proof.

Source: `docs/redesign-proposal.md`, approved by the human on 2026-11-23 (JSON-LD Organization, no new dependencies).

## Color tokens

Define these as CSS custom properties in `packages/ui/tokens.css`, the only file that holds a hex colour, and map them into the Tailwind theme.

### Paper and film (both themes, unchanged)

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#FCFEFE` | Sheets and form surfaces |
| `--ink` | `#13222C` | Text and primary buttons on paper |
| `--ink-soft` | `#4A5A64` | Secondary text on paper |
| `--hairline` | `#C9D5D9` | Decorative borders and dividers on paper. Never text, never a control border |
| `--film` | `#0B1C26` | X-ray surfaces. Same value in both themes |
| `--bone` | `#DCE8EB` | Text and strokes on film |
| `--bone-soft` | `#8FA6AE` | Secondary text on film |
| `--paid` | `#1B6E46` | Verdict state on paper and light surfaces. Always with an icon and a word |
| `--reduced` | `#8A5200` | Same |
| `--denied` | `#A8261C` | Same |
| `--focus-paper` | `#1F6FEB` | Focus ring on paper and light surfaces |
| `--lightbox` | `#EDF2F3` | The light theme's `--bg-base` |

### Dark theme (default)

| Token | Value | Use |
| --- | --- | --- |
| `--bg-base` | `#07131A` | The dark room, page background |
| `--bg-surface-1` | `#0B1C26` (`--film`) | Cards, panels, film |
| `--bg-surface-2` | `#10242F` | Inputs, raised elements on film |
| `--bg-surface-3` | `#16303C` | Hover, popovers, menus, command palette |
| `--border-subtle` | bone at 6% | Decorative card edges only |
| `--border-default` | bone at 10% | Decorative dividers only |
| `--border-strong` | bone at 18% | Hovered card edges, and the film edge |
| `--control-border-dark` | `#8FA6AE` (`--bone-soft`) | Input, radio card and toggle boundaries |
| `--text-primary` | `#DCE8EB` (`--bone`) | Body text on dark |
| `--text-secondary` | `#B4C6CC` | Secondary text |
| `--text-tertiary` | `#8FA6AE` (`--bone-soft`) | Hints, metadata |
| `--wax` | `#F2C12E` | The single accent |
| `--wax-hover` | `#F6CF55` | Primary button hover |
| `--wax-muted` | wax at 12% | Accent background |
| `--wax-glow` | wax at 25% | Glow only, never a boundary |
| `--on-wax` | `#07131A` | Text on wax |
| `--paid-dark` | `#4CC38A` | Paid state on dark |
| `--reduced-dark` | `#E3A03C` | Reduced state on dark |
| `--denied-dark` | `#F0705F` | Denied state on dark |
| `--focus-dark` | `--wax` | Focus ring on dark and on film |

The three rgba borders are 1.1 to 1.7:1 against the dark surfaces. They are fine for decorative card edges. They fail WCAG 1.4.11 when a border alone shows where a control sits, so every input, radio card and toggle uses `--control-border-dark`.

### Light theme

| Token | Value | Use |
| --- | --- | --- |
| `--bg-base` | `#EDF2F3` (`--lightbox`) | Page background |
| `--bg-surface-1` | `#FCFEFE` (`--paper`) | Cards, sheets |
| `--bg-surface-2` | `#F4F8F9` | Inputs, raised elements |
| `--bg-surface-3` | `#E2EAEC` | Hover, popovers, menus |
| `--text-tertiary` | `#5B6B74` | Hints, metadata (light theme only) |
| Verdict states | `--paid`, `--reduced`, `--denied` | At least 5.12:1 on every light surface |

In the light theme wax is a fill or a glow, never text and never a boundary (1.49:1 on the lightbox). A wax primary button is identified by its ink label (9.62:1), and the ring around it is focus blue.

### Contrast (computed with the WCAG formula, checked by `tokens.contrast.test.ts`)

Dark surfaces, base / surface-1 / surface-2 / surface-3. Floor 4.5 for text.

| Foreground | base | s1 | s2 | s3 |
| --- | --- | --- | --- | --- |
| `--text-primary` | 15.03 | 13.89 | 12.76 | 11.03 |
| `--text-secondary` | 10.64 | 9.84 | 9.04 | 7.81 |
| `--text-tertiary` | 7.37 | 6.81 | 6.26 | 5.41 |
| `--wax` | 11.14 | 10.30 | 9.46 | 8.17 |
| `--paid-dark` | 8.49 | 7.85 | 7.21 | 6.23 |
| `--reduced-dark` | 8.38 | 7.75 | 7.12 | 6.15 |
| `--denied-dark` | 6.43 | 5.95 | 5.46 | 4.72 |

Other dark pairs: the hero headline gradient ends at `--text-tertiary` (7.37 on base dark, 4.89 on the lightbox), so it meets the 4.5 text floor and the old figure of bone at 60% (5.95, floor 3) no longer applies; `--on-wax` on `--wax` 11.14; `--on-wax` on `--wax-hover` 12.51; bone on `--wax-muted` 10.91; wax on `--wax-muted` 8.09; `--control-border-dark` on surface-2 6.26 (floor 3). `--border-subtle`, `--border-default` and `--border-strong` on base are 1.13, 1.25 and 1.59 and are decorative only.

Light surfaces, ink / ink-soft / `--text-tertiary`: base 14.38 / 6.33 / 4.89; surface-1 16.05 / 7.06 / 5.46; surface-2 15.19 / 6.69 / 5.17; surface-3 13.31 / 5.86 / 4.53. Paper pairs are unchanged: `--ink` 16.05, `--ink-soft` 7.06, `--paid` 6.16, `--reduced` 6.31, `--denied` 7.01, `--focus-paper` 4.58.

The paper focus blue fails on dark surface-3 (2.98:1), so on dark surfaces and on film the focus ring is always wax.

Focus rings are 2 px wide with a 2 px offset.

Color never carries meaning alone. Every verdict state uses an icon and a word alongside its color.

## Theme

- The toggle (`ThemeToggle`) stores the choice in `localStorage` under one key, `dc-theme`, inside `try/catch`. With no stored value, or when storage throws, the theme follows `prefers-color-scheme`. The theme is the `data-theme` attribute (`light` or `dark`) on `<html>`. Dark applies when the attribute is absent and the system is not light.
- Storage code lives in exactly one file, `packages/ui/src/theme/storage.ts`.
- Dark is the default, so the system fallback is the query `prefers-color-scheme: light`, in `packages/ui/tokens.css` only. `prefers-color-scheme: dark` appears nowhere.
- A small inline boot script, built from `theme/storage.ts` and added at the top of every page's `<head>` by `themeBoot()`, applies a stored choice before first paint. It is the only inline script and holds no third-party code.

## Typography: one family, three voices

Self-host all fonts through `@fontsource` packages. No third-party font requests.

| Voice | Face | Speaks for | Sizes (px) |
| --- | --- | --- | --- |
| Document | IBM Plex Serif | Clause text, verdict statement | 17/28 body · 14/22 fine print · 48/56 verdict headline (36/44 on phones) |
| System | IBM Plex Sans | Questions, controls, explanations | 17/26 body · 24/32 question (21/28 on phones) · 14/20 small |
| Machine | IBM Plex Mono | Rule ids, expressions, file paths, replay tokens | 14/22 · 13/20 for `Kbd` |

No new font family and no new font file. Serif and Sans 400 and 600, and Mono 400, are already self-hosted. Do not add Inter.

| Style | Voice | Desktop | Phone | Tracking |
| --- | --- | --- | --- | --- |
| Display, hero h1 | Serif 600 | 64/68 | 40/44 | -0.03em |
| H2 | Sans 600 | 40/44 | 30/36 | -0.02em |
| Verdict | Serif 400 | 48/56 | 36/44 | 0 |
| Summary (Pre-Flight) | Serif 400 | 36/44 | 36/44 | 0 |
| Question | Sans 600 | 24/32 | 21/28 | -0.01em |
| Doc body, fine print | Serif 400 | 17/28, 14/22 | same | 0 |
| System body | Sans 400 | 17/26 | 16/26 | 0 |
| UI label | Sans 400/600 | 14/20, 13/18 | same | 0 |
| Mono, `Kbd` | Mono 400 | 14/22, 13/20 | same | 0 |

Every monetary amount uses tabular lining figures.

## Spacing, radius, layout

- Spacing scale (4 px base): 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Border radius: paper 4 px, controls 8 px, film and cards 12 px, pills 999 px (full).
- Text column max-width: 680 px (keeps lines under 80 characters).
- Page max-width: `--page-max`, 1120 px. The header, the main area and the footer are centred at it.
- Margin rail: 240 px, appears from 1024 px wide.
- Breakpoints: 390 (base), 768, 1024, 1280.
- Depth comes only from the tokens `--highlight-inset` (`inset 0 1px 0 rgb(255 255 255 / 4%)`), `--glow-wax-soft`, `--glow-wax-pulse` and `--halo-paper`, used through `@utility` classes in `theme.css`. Nothing suggests elevation.
- Paper has a hairline border and carries `halo-paper` (a glow on the dark room, none on the light theme). Film has a `--border-strong` edge and grain.
- Named gradient tokens, used through `@utility` classes in `theme.css`: `--glow-hero`, `--grid-calibration` (`bg-hero`, the landing hero only) and `--fill-hero-text` (`text-hero-fill`, the landing headline only, `CanvasText` in forced colours). The light-theme `--glow-hero` is focus blue at 8%, because wax is nearly invisible on the lightbox. `grain` and `scan-line` are the other two gradient tokens.

## Motion

All animation uses `cubic-bezier(0.2, 0, 0, 1)` (`--ease`).

| Interaction | Duration | Where | Reduced motion |
| --- | --- | --- | --- |
| Button press | 120 ms (`--dur-press`) | Everywhere | Keeps the 120 ms colour change |
| Hover | 110 ms (`--dur-hover`) | Controls, cards | Colour change only |
| Enter (an element appearing) | 200 ms (`--dur-enter`) | Everywhere | 120 ms fade, no movement |
| Panel open/close | 200 ms (`--dur-panel`) | Everywhere | 0 ms |
| Page change | 250 ms (`--dur-page`) | Everywhere | 120 ms fade |
| Menu, popover, command menu | 150 ms (`--dur-menu`) | Everywhere | 120 ms fade |
| X-ray develop (scan line) | 500 ms (`--dur-xray`) | Apps and landing | 120 ms fade (`--dur-reduced`), no scan line |
| Blur-in | Set in the ui-kit design | Landing hero headline only. It starts at opacity 0.01, not 0, to protect LCP | No blur, no movement |
| Spotlight | Set in the ui-kit design | Landing page and `/kit` only | Static |
| Shine | Set in the ui-kit design | Landing page and `/kit` only | Static |
| Tilt | Scroll-linked with `animation-timeline: view()` where supported | Landing page only. Static where unsupported | Static |
| Success pulse | `--glow-wax-pulse` | A confirmed action (copy link, copy command) | One frame of the final state, no pulse |

Respect `prefers-reduced-motion`: replace the scan line with a 120 ms fade and remove all other movement.

## Layout structure

```
desktop (1024 and up)                           phone (390)
+-----------------------------------------+     +----------------------+
| Dead Certain    Claim Check   Rulebook  |     | Dead Certain    [=]  |
+----------+------------------------------+     +----------------------+
| Your     |                              |     | Your answers (3)  v  |
| answers  |   SHEET (paper, 680 max)     |     +----------------------+
|          |                              |     |                      |
| Stay  4d |   content                    |     |  SHEET               |
| Rent  6k |                              |     |                      |
| Age   64 |                              |     |                      |
+----------+------------------------------+     +----------------------+
```

Content is left-aligned on one sheet. Answers sit in the margin rail like notes on a document.

## Components in `packages/ui`

`Sheet`, `Film`, `QuestionCard`, `AnswerControl`, `AnswersRail`, `ClauseQuote`, `VerdictHeadline`, `Ledger`, `ProportionBar`, `ProofTree`, `SourceBadge`, `CheckRow`, `Button`, `Disclosure`, `AppShell`, `CommandMenu`, `ThemeToggle`, `Toast`, `Kbd`, `Pill`, `FeatureCard`, `Illustration`.

`Button` has four variants: `primary`, `secondary`, `quiet` and `wax`. `wax` is a wax fill with `--on-wax` text, the one call to action on a screen, never wax text.

`CommandMenu` is built on the Radix Dialog already installed, with filtering done by hand over at most about 60 items. `AppShell` carries the command trigger and the theme toggle, in the header at every width. `Toast` reuses the single polite live region. `Illustration` and every icon use the kit's own inline SVG set, redrawn at 16 px with a 1.5 px stroke. Add no icon package.

Render every component in every state, in both themes, in the `/kit` gallery at `apps/site`. The gallery is the first deliverable of the design phase and the baseline for screenshot tests.

## Interaction rules

- Controls match the fact type: two large buttons for boolean, radio cards for enum, formatted input with currency unit for money, native picker for date.
- Enter continues. Number keys select options. Escape closes any panel. Focus moves to the new question heading, announced by a polite live region.
- Validation appears under the field in plain words ("Enter an amount above zero"). No apologies.
- The answers rail lists each answer as a button. Changing one recomputes immediately. Questions that no longer matter disappear, with one line explaining why.

## Proof view (X-ray)

Desktop: paper on the left, film on the right. Phone: film slides up as a sheet. A scan line crosses the paper once in 500 ms, and the film appears behind it.

The proof is a tree: rules are joints, facts are bone ends. Each fact shows its source: "You answered", "Collected", or "Worked out". The tree follows the ARIA tree pattern — arrow keys move, Enter expands, Escape returns focus to the row that opened it.

Each rule shows its plain sentence first. The rule expression sits behind "Show the rule". An answered fact offers "Change this answer".

## Copy rules

- Sentence case, active voice, no exclamation marks.
- A control keeps one name through a flow: "See why" opens a panel titled "Why".
- Errors say what happened and what to do next. No apologies.
- Dry humor only where no money is at stake: the footer and the 404 page.

## What this design refuses

Lifted, with limits (decided 2026-11-23):

| Refusal, as it was | Now | Limit |
| --- | --- | --- |
| No global dark mode | A dark default and a light theme | The toggle stores the choice under `dc-theme` only, in `try/catch`, in `packages/ui/src/theme/storage.ts`, and falls back to `prefers-color-scheme` |
| No drop shadows | The inset top highlight, the wax glow and the paper halo | Through the shadow and glow tokens only. Still no shadow that suggests elevation |
| No gradient washes | The hero radial glow, the hero headline fill, the graph-paper grid, film grain and the scan line | Nowhere else. Every gradient value comes from a token. Grain is an inline SVG `feTurbulence` data URI, drawn on film only |
| No entrance animation on scroll | One fade and 16 px rise per section | The landing page only. Never inside the apps |

Still refused: no uppercase labels, no caption above headings, no arrows in button labels, sentence case, no exclamation marks, no apologies in errors, color never alone, and no pumpkins, bats or blood.

Tailwind keeps blocking the words `uppercase`, `ring` and `shadow`. Glows are custom `@utility` classes, so Tailwind's shadow and ring utilities stay out.

## Accessibility floor: WCAG 2.2 AA

- Everything works by keyboard with a visible focus ring on every interactive element.
- Text contrast at least 4.5:1; interface elements at least 3:1, in both themes. Automate the check — do not rely on eye. A border that alone shows where a control sits uses `--control-border-dark` on dark.
- Touch targets at least 44 px. Layout holds from 320 px wide and at 200% zoom.
- Questions are real labelled form fields. Results are announced through a polite live region.
- Print styles give a clean one-page verdict with its ledger and clauses.

## Budgets

- JavaScript under 200 kB gzipped per app.
- Lighthouse mobile: performance ≥ 95, accessibility 100.
- Cumulative layout shift < 0.05, including font loading.
- One consultation step computes in under 10 ms in a benchmark.
