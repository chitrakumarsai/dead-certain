# Implementation Plan: seo

## Overview

This plan makes the three public pages findable and previewable, in four pull requests: the head, structured data, sitemap, icons and `seo:check` (tasks 1 to 7); the OG images (8 and 9); prerender and hydration (10 to 13); the static rulebook pages (14 and 15). It takes over `landing-page` requirement 12 and task 9.4.

**This spec is implemented by Claude Code, not Kiro.** Kiro wrote the spec and creates no file outside `.kiro/` and `docs/kiro-log.md`. Do the tasks one at a time, in order. Do not start a task while another is in progress.

**Prerequisites.**
- Tasks 1 to 9 need nothing else. The kit (`ui-kit` tasks 1 to 15) exists.
- Tasks 10 to 13 start only after all of these are ticked: `landing-page` 9.1 to 9.3, `claim-check-app` 17 to 22, `pre-flight-app` 22 to 28, and `ui-kit` task 17 (server rendering). If one is not, stop and report.
- Task 14 starts only after task 13 is merged.

## Working rules for every task

- Run every command under Node 22 (`.nvmrc`). Before the first command in a session, run `nvm use` (or an equivalent) and confirm `node -v` prints `v22.x`.
- Never use watch mode or any long-running process. Run tests with `pnpm vitest run <path>`, `pnpm test:props`, `pnpm e2e`, `pnpm seo:check` or `pnpm check`. For screenshots use `vite build` plus `vite preview` in a background process you stop afterwards.
- **Dependencies.** None. `react-dom/server` is part of `react-dom`, and the image script uses the pinned Playwright. If a task seems to need another package, stop and ask the human.
- **Lanes.** Stay in `packages/ui/src/site.ts` and its tests, `scripts`, `apps/*` (config, `index.html`, `public`, `src`, `kit`), `e2e`, `.github` and the root configuration you need. Do not touch `.kiro/**`, `packages/engine`, any `kb`, `rulebook` or `golden` folder. Do not edit `packages/engine/src/types.ts`.
- **Owner decisions (fixed).** The JSON-LD author is the `Organization` "Dead Certain", with no `Person` and no personal name. The `home` title keeps its full stop. Prerender waits for the redesigns. The rulebook pages are last and apart.
- **Copy.** Use the exact strings in requirement 3. Sentence case, no exclamation mark, no apology.
- **Design system.** Load `.kiro/steering/design-system.md`. Use the kit's components and tokens in the OG fixture. Define no colour of your own, and no hex outside `tokens.css` (the committed PNGs are pixels, not source).
- **Refusals.** The kit's refusals still hold on every page and fixture: no uppercase labels, no caption above a heading, no arrow in a button label, no `dangerouslySetInnerHTML`, no new storage, no request, no analytics, no emoji.
- **Tests.** Pure logic in Vitest with no DOM. Pages in Playwright against the built site. Every property test file ends in `.props.test.ts`, uses fast-check `4.10.2`, runs each property at least 100 times, and starts each with `// Feature: seo, Property N: <title>`.
- **Task_Evidence.** Before you ask for review, attach to the pull request: (1) where a page changed, screenshots at **390, 768 and 1280 px** (not committed); (2) a clean browser console read; (3) a zero-violation axe result for each page touched; (4) `pnpm check` output, passing, and from task 6 `pnpm build` then `pnpm seo:check`. Test-first tasks add the failing and the passing runs.
- **Marking tasks.** You do not tick boxes in this file. Kiro marks a task complete after reviewing it against the spec.
- **Commits and branches.** Keep tool attribution on commits. The first pull request is on `cc/phase7-seo`. Each later group uses `cc/phase7-seo-<topic>`: `og`, `prerender`, `rulebook`. One pull request per group.

## Tasks

- [x] 1. The configuration module
  - Write `packages/ui/src/site.test.ts` and `site.props.test.ts` first, then `packages/ui/src/site.ts` with `ORIGIN`, `BASE`, `REPO`, `PageSeo`, `PAGES` (the strings of requirement 3), `absolute`, `headTags`, `jsonLd`, `sitemapXml` and `robotsTxt`. It imports nothing and is not exported from `src/index.ts`. Check that the kit's `boundary`, `deps` and `contract` tests accept the new file.
  - Tests: lengths, uniqueness, `absolute` throws on `#`, `?` and a path outside `BASE`, the head list for each key, JSON-LD content and escaping, sitemap and robots text.
  - **Property 1: Head tags are complete and single**, **Property 2: JSON-LD round-trips and cannot close the script**, **Property 3: The sitemap lists exactly the indexable pages**, **Property 4: `absolute` stays inside the base**
  - _Requirements: 1.3, 1.4, 2.1 to 2.5, 3.1, 3.2, 4.2, 4.3, 5.1, 5.3, 6.1 to 6.4_

- [x] 2. The head plugin
  - Write `scripts/seo-vite.ts` with `seoHead(pageKey)` and use it in the three `vite.config.ts` files and for `404.html` and the three `kit/*.html` pages. Remove the hand-written title, description and Open Graph tags from `apps/site/index.html`, `apps/site/404.html`, `apps/claim-check/index.html` and `apps/pre-flight/index.html`. Read `--bg-base` of both themes from `tokens.css` for the two `theme-color` metas. The plugin throws for a page not in `PAGES`.
  - Until task 8 adds the files, `ogImage` is unset in `PAGES`, so the image tags and the icon links are not written, and the check of task 6 does not require them. Task 8 sets `ogImage` and `ogAlt`, and the requirement applies from then on. State this order in the pull request.
  - Playwright: in each built page the head holds each tag once; the title after load equals the built title for each app's start screen (skip `useTitle` on the start screens); the existing specs pass.
  - _Requirements: 3.3, 4.1 to 4.5_

- [x] 3. Sitemap and robots.txt
  - In the site's plugin, add the `closeBundle` step that writes `sitemap.xml` and `robots.txt` from `PAGES`. `lastmod` comes from `git log -1 --format=%cs -- <folders>` per page and is omitted when `git rev-parse --is-shallow-repository` is true.
  - Tests: the text of both files, and a case with a shallow flag.
  - _Requirements: 5.1 to 5.4_

- [x] 4. Structured data
  - Write the script tag in the plugin from `jsonLd(key)`: the `@graph` on `home`, one `WebApplication` on each app, none on `kit` and `notFound`. Static text, `<` escaped.
  - Playwright or a build test: each script parses, the `@type` values are exactly as in requirement 6, there is no `Person`, every URL is absolute under `ORIGIN + BASE` or `REPO`.
  - _Requirements: 1.3, 6.1 to 6.4_

- [x] 5. Manifests
  - Add the manifest for each app (`name`, `short_name`, `start_url`, `scope`, `display` "browser", `theme_color` and `background_color` from the tokens) and its link in the head. The `icons` member and the icon links are added in task 8 with the files.
  - _Requirements: 4.1, 7.6_

- [x] 6. The SEO check
  - Write `scripts/seo-check.ts` test-first: `checkPage(html, key)` returns `{ page, rule, detail }` items; one test per failure in requirement 8.2 and 8.3. Add `pnpm seo:check` to the root `package.json` and the CI step after `pnpm build` in the `check` job. The check requires the image tags and icon files only for a page whose `ogImage` is set.
  - **Property 5: The checker agrees with the builder**
  - _Requirements: 8.1 to 8.4_

- [x] 7. Checkpoint, head and structured data
  - Run `pnpm check`, `pnpm test:props`, `pnpm build` and `pnpm e2e`. Attach the built head of each page and the sitemap. Open the pull request. Kiro reviews it against this spec.

- [x] 8. OG images and icons
  - The JSON-LD question carried from the review of PR #39 is closed: the `author` carries `@type` and `name` (requirement 6.2). It was not run through an outside validator; a Rich Results run by the human is welcome but not required.
  - Add the fixture `apps/site/kit/og.html` and `apps/site/src/kit/og.tsx` (noindex, key `kit`). Draw the three images of requirement 7.2 from the Hero_Module and the compiled knowledge bases. Write `scripts/og.ts` (build, preview on a free port, Playwright at 1200 by 630, dark theme) that writes the three PNGs, the four icon files (`favicon.ico` as a PNG-in-ICO container written by hand) and `og.json`. Add a root script `pnpm og`. Commit the assets.
  - Tests: the PNG signature, size and header dimensions; `og.json` against the text computed with no browser; every `og:image`, icon and manifest link resolves to a built file.
  - Write the three `og:image:alt` sentences (at most 125 characters), record them in `og.json`, set `ogImage` and `ogAlt` in `PAGES`, and add the icon links and the manifests' `icons`.
  - _Requirements: 7.1 to 7.7_

- [x] 9. Checkpoint, OG images
  - Run `pnpm check`, `pnpm test:props`, `pnpm build`, `pnpm seo:check` and `pnpm e2e`. Attach the three PNGs at full size with their byte sizes. Open the pull request on `cc/phase7-seo-og`. Kiro reviews it against this spec.

- [ ] 10. Prerender gate and the landing page
  - Confirm the prerequisites listed in the Overview. Add `entry-server.tsx` for the landing page and `scripts/prerender.ts` (SSR build, render, splice into `#root`). Change `main.tsx` to the `hydrateRoot` or `createRoot` choice of the design. Compute the Hero verdict on the server through the Hero_Module. The page holds no `dangerouslySetInnerHTML`.
  - Playwright: with JavaScript disabled the page shows the headline, the verdict, the steps and the app links; no hydration warning at 390, 768 and 1280 px in the dark, light and reduced-motion projects; two builds give byte-identical HTML.
  - _Requirements: 9.1 to 9.6_

- [ ] 11. Prerender Claim Check and Pre-Flight
  - Repeat task 10 for the two apps' start routes. A hash route (`#/report?repo=…`, `#/?r=`) is still client-rendered with `createRoot`, and a Playwright test opens one and checks it renders correctly with no warning. Extend the Seo_Check with the `<h1>` count and a non-empty `#root`.
  - _Requirements: 9.2 to 9.6, 9.8, 8.2_

- [ ] 12. Budgets, accessibility and Lighthouse
  - Run axe on the three prerendered pages in both themes. Re-check the bundle and layout-shift budgets of the landing page and the apps. Run Lighthouse once by hand on the prerendered landing page, and record its LCP element and mobile score in the pull request. Do not add Lighthouse to CI.
  - _Requirements: 9.4, 9.7_

- [ ] 13. Checkpoint, prerender
  - Run `pnpm check`, `pnpm test:props`, `pnpm build`, `pnpm seo:check`, `pnpm dc validate`, `pnpm dc golden` and `pnpm e2e`. Attach the JavaScript-off screenshots of the three pages at the three widths and the Lighthouse result. Open the pull request on `cc/phase7-seo-prerender`. Kiro reviews it against this spec.

- [ ] 14. Static rulebook pages (own pull request, after task 13 is merged)
  - Extract the clause list of each app's Rulebook screen into a component shared by the screen and the static page. Add the keys `policy` and `checklist` to `PAGES` (paths `claim-check/policy/` and `pre-flight/checklist/`, title and description in the form of requirement 3, no counts, the app's `ogImage`), their `WebPage` JSON-LD with `isPartOf` the app's `WebApplication`, the sitemap entries, and the build step that prerenders each. Link each from its app's rulebook screen. If a knowledge base or a rulebook must change, stop and ask.
  - Playwright: each page shows every clause verbatim by id, has one `<h1>`, passes axe in both themes at 390, 768 and 1280 px, makes no request, and the app's hash route still works.
  - _Requirements: 10.1 to 10.5, 6.4, 8.2_

- [ ] 15. Checkpoint, rulebook pages
  - Run `pnpm check`, `pnpm test:props`, `pnpm build`, `pnpm seo:check` and `pnpm e2e`. Attach the two pages in both themes at the three widths. Open the pull request on `cc/phase7-seo-rulebook`. Kiro reviews it against this spec.

## Notes

- Review of PR #43 (Kiro, 2026-11-27): tasks 8 and 9 ticked. Accepted: the inlined JSON-LD author (6.2), the grid-only room on the home image with grain on the film (7.2), the full four-deduction ledger, "Failed" for the warning row, the "DC" icon (7.5), and the site build compiling Pre-Flight's knowledge base (landing 1.3).
- Review of PR #39 (Kiro, 2026-11-26): tasks 1 to 7 ticked. Accepted: no `index.html` change for Claim Check and a pass-through for a page with no entry (requirements 4.1), `PageSeo.name` (2.2), kit titles (3.3), the system-only theme colour (4.4, already accepted) and the refusals exception for `site.ts` (ui-kit 33.3). New apps get their `PAGES` entry from `pnpm new-app`: `app-template` requirement 13 and task 9. Task 8 follows after that is agreed.

- Moved from `landing-page` on 2026-11-26: requirement 12 and task 9.4. See requirement 11 for the mapping. Landing task 9.5's head-tag test is satisfied by tasks 1, 2 and 6.
- If time runs short, drop task 14 and 15 first, then 12's Lighthouse note. Tasks 1 to 7 are small and cost nothing at run time, so they go first.
- The `robots.txt` is inert on the project URL (requirement 5.4). The sitemap is submitted to the search console by the human.
- The Kiro lane's review of each pull request checks every requirement against the evidence, and amends this spec if it accepts a deviation.
