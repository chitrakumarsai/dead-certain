# Requirements Document

## Introduction

This spec makes the three public pages of Dead Certain findable and previewable: the landing page, Claim Check and Pre-Flight. It covers the head of every built page (title, description, canonical, robots, Open Graph, Twitter, theme colour, icons, manifest), structured data, the sitemap and `robots.txt`, three committed OG images, a check that fails the build on a bad page, prerendering with hydration, and, last, two static rulebook pages.

It takes over `landing-page` requirement 12 and task 9.4, which are marked as moved there. There is one plan.

The source is `docs/seo-proposal.md` (decided by the owner on 2026-11-26; the file is git-ignored, so the decisions are repeated here) and the owner's SEO brief. Four owner decisions bind this spec:

1. The JSON-LD author is an `Organization` named "Dead Certain". No `Person` and no personal name appear anywhere.
2. The landing title keeps its full stop: "Dead Certain. LLMs guess. The dead are certain." (landing requirement 1.10 is unchanged).
3. Prerender and hydration come after the landing page (tasks 9.1 to 9.3) and the Claim Check and Pre-Flight redesigns.
4. Static rulebook pages are the last task and their own pull request, after prerender.

This spec is implemented by the Claude Code lane in `packages/ui/src/site.ts`, `scripts`, `apps/*` (config, `index.html`, `src`), `e2e`, `.github` and the root configuration it needs. Kiro writes the spec only. Requirement numbers are stable so the design's properties can cite them.

Scope: the five page keys (`home`, `claimCheck`, `preFlight`, `kit`, `notFound`), the build steps, the OG and icon assets, the checks, and the later prerender and rulebook pages. Out of scope: analytics, a search box, a blog, per-repository or per-verdict pages (a verdict link is a hash and is never indexed), `hreflang`, AMP, an RSS feed, a custom domain (the config keeps one place to change it), and any change to an engine, a knowledge base or a rulebook.

## Glossary

- **Site_Config**: The module `packages/ui/src/site.ts`: `ORIGIN`, `BASE`, `REPO`, the `PageSeo` type, `PAGES`, `absolute` and the pure JSON-LD builders. It imports nothing.
- **Page_Key**: One of `home`, `claimCheck`, `preFlight`, `kit`, `notFound`.
- **Indexable_Page**: A page whose `PageSeo.index` is true: `home`, `claimCheck`, `preFlight`, and the two rulebook pages once task 14 adds them.
- **Seo_Head**: The Vite plugin `seoHead(pageKey)` in `scripts/seo-vite.ts`. It writes the head tags through `transformIndexHtml`.
- **Structured_Data**: The single `application/ld+json` script of a page.
- **OG_Image**: A 1200 by 630 PNG under `apps/site/public/og/`.
- **Seo_Check**: The script behind `pnpm seo:check`. It reads the built site and fails on any violation.
- **Prerender**: Rendering a page's start route to HTML at build time with `react-dom/server`, so the HTML holds the content before any script runs.
- **Built_Site**: The output of `pnpm build` for `apps/site`, with the two apps copied under it (as CI does).
- **Hero_Module**: The landing page's `apps/site/src/landing/hero/` code, the only place on the landing page that names a fact.
- **Task_Evidence**: Per task: screenshots at 390, 768 and 1280 px where a page changed, a clean browser console, a zero-violation axe result and `pnpm check` output.
- **Claude_Code_Lane**, **Kiro_Lane**: As in the `landing-page` spec.

## Requirements

### Requirement 1: Boundaries

**User Story:** As a maintainer, I want search metadata that adds no dependency, no request and no personal data, so that the project's privacy promise stays true.

#### Acceptance Criteria

1. THE work in this spec SHALL add no dependency. `react-dom/server` comes from `react-dom` and the image script uses the pinned Playwright.
2. THE pages SHALL make no request because of a tag in this spec, except a same-origin request for an icon or the manifest. THE pages SHALL load no third-party script, style, font or image, and the existing privacy and no-network tests SHALL keep passing unchanged.
3. THE Site_Config, the head tags, the Structured_Data, the manifests and the OG_Image text SHALL contain no personal name and no `Person` type.
4. THE canonical URL, the sitemap and the Structured_Data SHALL never hold a URL fragment (`#`) or a query. A verdict link, a report link and every hash route are never indexed.
5. THE work SHALL NOT modify `packages/engine`, `apps/*/kb`, `apps/*/rulebook` or `apps/*/golden`.
6. Every pull request in this spec SHALL keep `pnpm check`, `pnpm build` and `pnpm e2e` green, and from task 6 on, `pnpm seo:check`.

### Requirement 2: One configuration module

**User Story:** As a maintainer, I want every address, title and description in one file, so that no page disagrees with another.

#### Acceptance Criteria

1. THE Site_Config SHALL export `ORIGIN` ("https://chitrakumarsai.github.io"), `BASE` ("/dead-certain/"), `REPO` ("https://github.com/chitrakumarsai/dead-certain"), the `PageSeo` type, `PAGES` keyed by Page_Key, and `absolute(path)`. Changing to a custom domain SHALL need an edit to `ORIGIN` and `BASE` only.
2. A `PageSeo` SHALL hold `path` (relative to `BASE`, ending in `/` or a file name, never a hash or a query), `title`, `description`, `index`, and for an Indexable_Page `ogImage` and `ogAlt`.
3. THE Site_Config SHALL import nothing and SHALL hold no hex colour. Build scripts import it by relative path. It is not exported from the kit's public index.
4. THE tests SHALL fail when a title is longer than 60 characters, a description is longer than 155, two pages share a title or a description, or `absolute` returns a URL outside `ORIGIN + BASE`.
5. THE page copy SHALL be exactly the table in Requirement 3.

### Requirement 3: Titles and descriptions

**User Story:** As a person reading a search result, I want each page to say what it is in one line, so that I can pick it.

#### Acceptance Criteria

1. THE `PAGES` entries SHALL use these strings, in sentence case, with no exclamation mark:

   | Key | Title | Chars | Description | Chars |
   | --- | --- | --- | --- | --- |
   | `home` | Dead Certain. LLMs guess. The dead are certain. | 47 | A model drafts the rules once. A small engine decides every verdict in your browser and shows the proof, clause by clause. | 122 |
   | `claimCheck` | Claim Check: what a health policy pays on a hospital bill | 57 | Answer a few questions and see the amount a sample health policy pays, each deduction, and the clause behind it. | 112 |
   | `preFlight` | Pre-Flight: check a GitHub repository before you submit | 55 | Enter a public repository and get a pass or fail for each checklist item, with the rule and evidence behind it. Runs in your browser. | 133 |
   | `notFound` | Page not found. Dead Certain | 28 | There is nothing at this address. | 33 |
   | `kit` | Dead Certain kit | 16 | The component gallery of the Dead Certain design system. | 56 |

2. THE `home` title SHALL keep its full stop (owner decision 2). THE descriptions SHALL contain no count of checks or rules, because a count goes stale when a rulebook changes.
3. THE built HTML of each page SHALL carry exactly its `PAGES` title. WHEN the page has loaded and hydrated, `document.title` of each app's start screen SHALL still equal that title, so the title a crawler reads after running scripts matches the one in the HTML. (The apps' per-screen titles of the form "<heading>. Claim Check" stay for the other screens.)

### Requirement 4: Head tags

**User Story:** As a person who shares a link, I want a correct preview and a single address for each page, so that the page is found once.

#### Acceptance Criteria

1. THE Seo_Head SHALL write, for every page, the title, `description`, a `robots` meta, `theme-color`, the icon links, and for an app the manifest link. No page SHALL carry a tag twice: the plugin owns the title, description and Open Graph text tags that `index.html` holds today, which SHALL be removed from the three `index.html` files and `404.html`.
2. FOR an Indexable_Page THE Seo_Head SHALL write `robots` as `index, follow`, one `canonical` link equal to `absolute(path)`, `og:title`, `og:description`, `og:type` (`website`), `og:url` (equal to the canonical), `og:site_name` ("Dead Certain"), `og:locale` (`en`), `og:image` (absolute), `og:image:width` (1200), `og:image:height` (630), `og:image:alt`, `twitter:card` (`summary_large_image`), `twitter:title`, `twitter:description`, `twitter:image` and `twitter:image:alt`. (The image tags and the icon links appear from task 8, when `ogImage` is set in `PAGES`; until then the plugin writes none and the check does not require them.)
3. FOR `kit` and `notFound` THE Seo_Head SHALL write `robots` as `noindex, nofollow`, no canonical, and no Open Graph or Twitter tags.
4. THE `theme-color` SHALL be two metas, one per `(prefers-color-scheme: dark)` and `(prefers-color-scheme: light)`, whose values the plugin reads from `--bg-base` in `tokens.css` at build time. No hex value SHALL be written into a script or config (ui-kit requirement 32.1). It follows the system setting, not the stored `dc-theme` choice, and that is accepted.
5. THE tags SHALL be written at build time. No script SHALL create or change a tag at run time.

### Requirement 5: Sitemap and robots.txt

**User Story:** As a crawler, I want a list of the pages worth indexing, so that I find all of them.

#### Acceptance Criteria

1. THE build SHALL write `sitemap.xml` from `PAGES`, listing exactly the Indexable_Pages, each with an absolute `<loc>` and a `<lastmod>` in `YYYY-MM-DD`.
2. THE `lastmod` of a page SHALL come from `git log -1 --format=%cs` over that page's source folders. WHEN the checkout is shallow, THE build SHALL omit `lastmod` and SHALL NOT write a wrong date. (CI checks out with `fetch-depth: 0`, so the deployed file has the dates.)
3. THE build SHALL write `robots.txt` with `User-agent: *`, `Allow: /` and a `Sitemap:` line holding the absolute sitemap URL.
4. A crawler reads `robots.txt` at the root of a host only. On `chitrakumarsai.github.io/dead-certain/` it is not at the root and is inert. It is kept so that a custom domain works at once, and `noindex` is carried by the `robots` meta (Requirement 4.3), not by this file. The sitemap URL is submitted to the search console by hand.

### Requirement 6: Structured data

**User Story:** As a search engine, I want a statement of what the site and each app are, so that I can describe them correctly.

#### Acceptance Criteria

1. THE `home` page SHALL carry one `application/ld+json` script holding an `@graph` of a `WebSite` (name, url), a `SoftwareSourceCode` (name, `codeRepository` = `REPO`, `programmingLanguage` "TypeScript", license MIT) and the `Organization` "Dead Certain" (name, url, `sameAs` = [`REPO`]), which is the `author` and `publisher` of the other two. Each node SHALL have an `@id`.
2. EACH of `claimCheck` and `preFlight` SHALL carry one script holding a `WebApplication` (name, url, description, `applicationCategory`, `operatingSystem` "Any", `browserRequirements` "Requires JavaScript", `isAccessibleForFree` true) whose `author` is the same `Organization` `@id`. `kit` and `notFound` SHALL carry none.
3. THE JSON-LD SHALL be built by pure functions in the Site_Config from `PAGES` and constants, serialised once at build time, and SHALL escape `<` as `\u003c` so that a value can never close the script.
4. THE tests SHALL assert, for the built HTML, that each script parses, that `@type` values are exactly those above, that no node has `@type` `Person`, that every URL is absolute and under `ORIGIN + BASE` or `REPO`, and that the JSON-LD name and URL agree with `PAGES`. This replaces `landing-page` requirement 12.6's `Organization`-only assertion.

### Requirement 7: OG images, icons and manifests

**User Story:** As a person who shares the link, I want a clear preview picture, and as a visitor I want a favicon, so that the pages look finished.

#### Acceptance Criteria

1. THE OG_Images SHALL be three PNGs, `apps/site/public/og/home.png`, `claim-check.png` and `pre-flight.png`, each 1200 by 630 and under 200 kB, in the dark theme, rendered once by a Playwright script in `scripts/` from the noindex fixture page `apps/site/kit/og.html`, using the real kit components and tokens, and committed. No image is made at run time and the script is not part of `pnpm build`.
2. THE images SHALL show: home, the room with grain, the wordmark "Dead Certain" in Plex Serif 600 at 64 px, the tagline at 48 px, and on the right a paper sheet with the sample verdict headline and a proportion bar overlapping a strip of film with three bone proof-tree nodes; Claim Check, a paper sheet with a three-line `Ledger`, one deduction highlighted with its clause chip in wax-muted, and the headline at 48 px; Pre-Flight, a column of five `CheckRow`s (three pass, one fail, one warning, each with icon and word) and the title "Check a repository before you submit it" at 48 px.
3. EVERY figure and clause in an image SHALL come from the same code that produces the landing page's and the app's figures (the Hero_Module, the compiled knowledge bases). THE script SHALL write `apps/site/public/og/og.json` listing the text each image shows, and a Vitest test SHALL compute the same text with no browser and fail when it differs from `og.json`, so that a stale picture is caught.
4. THE `og:image:alt` of each page SHALL say what the picture shows, in a plain sentence of at most 125 characters, and SHALL be the same text the image's `og.json` entry records.
5. THE icon set SHALL be `favicon.ico` (32 px), `apple-touch-icon.png` (180), `icon-192.png` and `icon-512.png`, rendered once by the same script and committed under `apps/site/public/`. They are pixels, so they are the one place a colour lives outside `tokens.css`. Each page SHALL link them by an absolute path under `BASE`.
6. EACH of the two apps SHALL have a `manifest.webmanifest` with `name`, `short_name`, `start_url`, `scope`, `display` "browser", `theme_color` and `background_color` (read from the tokens, per Requirement 4.4) and the two PNG icons. Installability is not a goal.
7. THE tests SHALL check that each PNG exists, starts with the PNG signature, has the stated width and height read from its header, is under its size limit, and that every `og:image`, icon and manifest link resolves to a file in the Built_Site.

### Requirement 8: The SEO check

**User Story:** As a maintainer, I want a bad head to fail the build, so that nothing regresses unseen.

#### Acceptance Criteria

1. THE root `package.json` SHALL have a `seo:check` script that runs the Seo_Check on the Built_Site, and CI SHALL run it after `pnpm build` in the `check` job.
2. FOR every built HTML page THE Seo_Check SHALL fail when: the page is not in `PAGES`; the title or description differs from `PAGES` or breaks its length limit; a tag of Requirements 4 to 6 is missing, duplicated or wrong; the canonical is not absolute, has a fragment or differs from the sitemap entry; `robots` differs from `PAGES`; the page has no `lang` attribute, or not exactly one `<h1>` once prerendered (task 11 on); or an internal link, icon, image or manifest does not resolve to a built file.
3. THE Seo_Check SHALL fail when `sitemap.xml` does not list exactly the Indexable_Pages, when one of its URLs has no built file, or when `robots.txt` lacks the `Sitemap:` line.
4. THE Seo_Check SHALL print one line per failure naming the page and the rule, and SHALL exit non-zero. Its pure parts (parsing the head, comparing to `PAGES`) SHALL have Vitest tests that run in `pnpm check`, including a case for each failure above.

### Requirement 9: Prerender and hydration

**User Story:** As a crawler and a visitor without scripts, I want the page's content in the HTML, so that it is read without running JavaScript.

#### Acceptance Criteria

1. THE work in this requirement SHALL start only after: `landing-page` tasks 9.1 to 9.3 are ticked, the Claim Check redesign (tasks 17 to 22) and the Pre-Flight redesign (tasks 22 to 28) are ticked, and `ui-kit` task 17 (server rendering) is ticked. WHEN one is not, THE Claude_Code_Lane SHALL stop and report.
2. THE build SHALL render the start route of the landing page, Claim Check and Pre-Flight to HTML with `react-dom/server` and place it inside `#root` of the built page, by a build step that splices a string. No component SHALL use `dangerouslySetInnerHTML`.
3. THE client SHALL call `hydrateRoot` WHEN `#root` has children and the page's hash is empty or names the start route, and SHALL call `createRoot` otherwise, because the server never sees a hash and renders the start route only.
4. THE first client render SHALL produce the server's markup in both themes and at every width. THE Playwright console gate SHALL see no hydration warning at 390, 768 and 1280 px, in the dark, light and reduced-motion projects.
5. THE prerendered landing page SHALL hold the headline, the Hero verdict computed by the engine at build time (the same `audit` call and the same Hero_Module), the three steps, the two app cards and the footer. WITH JavaScript disabled, the page SHALL show them, and the `<noscript>` block SHALL still exist for a failed knowledge-base check.
6. THE prerender SHALL read no hash, no `localStorage`, no `matchMedia` and no clock, and SHALL be deterministic: two builds from the same commit produce byte-identical HTML.
7. THE existing budgets (landing requirements 9.1 to 9.3 and the apps' budgets) SHALL still hold. THE `h1` blur-in starts at opacity 0.01 (ui-kit 35.3). Lighthouse SHALL be run once by hand on the prerendered landing page and its LCP element and mobile performance score (95 or above) recorded in the pull request. No Lighthouse run is added to CI.
8. THE Seo_Check SHALL, from this task on, also require exactly one `<h1>` and non-empty `#root` in each prerendered page.

### Requirement 10: Static rulebook pages

**User Story:** As a person searching for what a health policy or a repository checklist says, I want the rulebook as a page, so that I can read and find it without running the app.

#### Acceptance Criteria

1. THE build SHALL add two Indexable_Pages: `claim-check/policy/` and `pre-flight/checklist/`, each rendered at build time from the compiled knowledge base with the same component the app's Rulebook screen uses, so that the page and the screen cannot differ.
2. EACH page SHALL quote every clause's text verbatim and by its id, SHALL have one `<h1>`, a link to its app, an entry in `PAGES` (title, description, `ogImage` of its app), a canonical, JSON-LD of type `WebPage` whose `isPartOf` is the app's `WebApplication`, and an entry in the sitemap.
3. THE apps' hash route for the rulebook SHALL keep working and SHALL link to the static page.
4. THE pages SHALL add no dependency, no request and no storage, and SHALL pass axe in both themes at 390, 768 and 1280 px.
5. THIS requirement SHALL ship in its own pull request, after the prerender pull request is merged. IF it needs a change to a knowledge base or a rulebook, THE Claude_Code_Lane SHALL stop and ask, because those are the Kiro lane's.

### Requirement 11: Moved from the landing page

**User Story:** As a reviewer, I want one plan for SEO, so that nothing is done twice or dropped.

#### Acceptance Criteria

1. THE `landing-page` requirement 12 and task 9.4 SHALL be marked as moved to this spec, and SHALL stay readable there as a pointer.
2. THE mapping SHALL be: 12.1 to Requirement 4; 12.2 and 12.3 to Requirement 6 (with the owner's decision that the Structured_Data is a `WebSite`, a `SoftwareSourceCode` and a `WebApplication` with an `Organization` author, so 12.2's single `Organization` and 12.6's `Organization`-only test are replaced); 12.4 to Requirement 7; 12.5 to Requirement 1; 12.6 to Requirements 6 and 8.
3. THE `landing-page` task 9.5 ("a build test confirms the head tags") SHALL be satisfied by this spec's `seo:check` and head tests, and SHALL NOT be done twice.
4. THE `claim-check-app` and `pre-flight-app` redesigns SHALL NOT change a page's title or description. They are set here (Requirement 3).
