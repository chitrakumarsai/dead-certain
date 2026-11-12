---
inclusion: fileMatch
fileMatchPattern: "{packages/ui/**,apps/*/src/**}"
---

# Design system

These rules apply whenever you read or write files under `packages/ui/` or `apps/*/src/`.

## Two materials

The interface has two surfaces. **Paper** is for asking and answering: calm, lit, typeset. **Film** is for proof: dark, structured, precise. The only choreographed transition is the moment a verdict develops from paper into the X-ray that shows its bones.

## Color tokens

Define these as CSS custom properties in `packages/ui/tokens.css` and map them into the Tailwind theme.

| Token | Value | Use |
| --- | --- | --- |
| `--lightbox` | `#EDF2F3` | Page background |
| `--paper` | `#FCFEFE` | Sheets and form surfaces |
| `--ink` | `#13222C` | Text and primary buttons on paper |
| `--ink-soft` | `#4A5A64` | Secondary text on paper |
| `--hairline` | `#C9D5D9` | Borders and dividers |
| `--film` | `#0B1C26` | X-ray surfaces only |
| `--bone` | `#DCE8EB` | Text and strokes on film |
| `--bone-soft` | `#8FA6AE` | Secondary text on film |
| `--wax` | `#F2C12E` | Highlight and stroke on the deciding clause. Never as text on paper |
| `--paid` | `#1B6E46` | Verdict state — always paired with an icon and a word |
| `--reduced` | `#8A5200` | Verdict state — always paired with an icon and a word |
| `--denied` | `#A8261C` | Verdict state — always paired with an icon and a word |
| `--focus-paper` | `#1F6FEB` | Focus ring on paper surfaces |
| `--focus-film` | `--wax` | Focus ring on film surfaces |

Focus rings are 2 px wide with a 2 px offset.

Color never carries meaning alone. Every verdict state uses an icon and a word alongside its color.

## Typography: one family, three voices

Self-host all fonts through `@fontsource` packages. No third-party font requests.

| Voice | Face | Speaks for | Sizes (px) |
| --- | --- | --- | --- |
| Document | IBM Plex Serif | Clause text, verdict statement | 17/28 body · 14/22 fine print · 48/56 verdict headline (36/44 on phones) |
| System | IBM Plex Sans | Questions, controls, explanations | 17/26 body · 24/32 question (21/28 on phones) · 14/20 small |
| Machine | IBM Plex Mono | Rule ids, expressions, file paths, replay tokens | 14/22 |

Every monetary amount uses tabular lining figures.

## Spacing, radius, layout

- Spacing scale (4 px base): 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Border radius: paper 4 px, controls 6 px, film 8 px.
- Text column max-width: 680 px (keeps lines under 80 characters).
- Margin rail: 240 px, appears from 1024 px wide.
- Breakpoints: 390 (base), 768, 1024, 1280.
- No shadows. Paper has a hairline border. Film has none.

## Motion

All animation uses `cubic-bezier(0.2, 0, 0, 1)`.

| Interaction | Duration |
| --- | --- |
| Button press | 120 ms |
| Panel open/close | 200 ms |
| X-ray develop (scan line) | 500 ms |

Respect `prefers-reduced-motion`: replace the scan line with a 120 ms fade. Remove all other movement.

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

`Sheet`, `Film`, `QuestionCard`, `AnswerControl`, `AnswersRail`, `ClauseQuote`, `VerdictHeadline`, `Ledger`, `ProportionBar`, `ProofTree`, `SourceBadge`, `CheckRow`, `Button`, `Disclosure`.

Render every component in every state in the `/kit` gallery at `apps/site`. The gallery is the first deliverable of the design phase and the baseline for screenshot tests.

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

No global dark mode. No uppercase labels. No caption above headings. No drop shadows. No gradient washes. No entrance animation on scroll. No arrows in button labels. No pumpkins, bats or blood.

## Accessibility floor: WCAG 2.2 AA

- Everything works by keyboard with a visible focus ring on every interactive element.
- Text contrast at least 4.5:1; interface elements at least 3:1. Automate the check — do not rely on eye.
- Touch targets at least 44 px. Layout holds from 320 px wide and at 200% zoom.
- Questions are real labelled form fields. Results are announced through a polite live region.
- Print styles give a clean one-page verdict with its ledger and clauses.

## Budgets

- JavaScript under 200 kB gzipped per app.
- Lighthouse mobile: performance ≥ 95, accessibility 100.
- Cumulative layout shift < 0.05, including font loading.
- One consultation step computes in under 10 ms in a benchmark.
