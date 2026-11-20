# Requirements Document

## Introduction

The app template is the proof that Dead Certain is a skeleton and not two apps. It has two parts: the command `pnpm new-app <name>` (the script `scripts/new-app.ts`) and the source it copies, `templates/app/`. Run once, the command creates `apps/<name>/` and wires the new app into the places where Claim Check and Pre-Flight are wired by hand today: the Playwright config, the CI workflow and the end-to-end suite. After `pnpm install`, the new app builds, runs, passes its tests and deploys under `/dead-certain/<name>/` with no further edit.

The template ships a small starter rulebook, knowledge base and golden scenario, so that the app works at once and the person can replace them with their own through the `knowledge-engineer` agent. The generated app is a generic consultation app: it reads the questions, goals, line items and clauses from its knowledge base and names no fact.

This spec is implemented by the Claude Code lane in `scripts`, `templates`, `e2e`, `.github`, the root configuration and `README.md`, with one prerequisite from the Kiro lane (the starter knowledge base, requirement 4). It was written Design-First, with the human's brief for Phase 5 as input. The base is how `apps/claim-check` and `apps/pre-flight` are set up today. Requirement numbers are stable so the design's correctness properties can cite them.

Scope: the command, the template, the starter knowledge, the generic app, the shared wiring, a CI job that scaffolds a throwaway app and runs it, and the README section that makes the run possible from the README alone. Out of scope: any change to `packages/ui`, `packages/engine` or `packages/kb-tools`, a way to remove or rename an app, a landing-page card for the new app, a rulebook page in the generated app, and running the `knowledge-engineer` agent from the script.

## Glossary

- **New_App_Command**: `pnpm new-app <name>`, the root script that runs `scripts/new-app.ts`.
- **Template**: The directory `templates/app/` and everything under it.
- **App_Name**: The kebab-case name given to the command, such as `loan-check`.
- **App_Title**: The App_Name in title case with spaces, such as "Loan Check". Used in the page title and the shell.
- **Placeholder**: A token the command replaces in Template files: `__APP_NAME__`, `__APP_TITLE__`, `__APP_SLUG_CONST__` (the upper-snake form, such as `LOAN_CHECK`) and `__APP_PORT__`.
- **Generated_App**: The directory `apps/<App_Name>/` the command creates.
- **Plan**: The list of files to create and edits to make, computed before anything is written.
- **Marker**: A comment line in a shared file, of the form `new-app:<id>`, that tells the command where to insert a line.
- **Shared_Files**: `playwright.config.ts` and `.github/workflows/ci.yml`. They are the only existing files the command edits.
- **Starter_KB**: The files `kb/starter.yaml`, `rulebook/starter.md` and `golden/scenarios.yaml` in the Template. They describe a toy domain.
- **Reference_Apps**: `apps/claim-check` and `apps/pre-flight`.
- **README_Block**: The first fenced `sh` block under the README heading "Add a third app": the commands that create the app and link it into the workspace. They all end. A second block, "Run it", holds the dev-server command, which does not end and which the Scaffold_Job does not run.
- **Scaffold_Job**: The CI job that follows the README_Block in a clean checkout, using a throwaway App_Name, and runs the result.
- **Task_Evidence**: Per task: `pnpm check` output, and for interface work screenshots at 390, 768 and 1280 px, a clean browser console and a zero-violation axe result.
- **Claude_Code_Lane**: The lane that implements this spec.
- **Kiro_Lane**: The lane that owns `.kiro/**`, `packages/engine`, `packages/kb-tools`, `packages/mcp`, `apps/*/kb`, `apps/*/rulebook` and `apps/*/golden`.

## Requirements

### Requirement 1: The command

**User Story:** As a developer, I want one command that creates a working app, so that I can start from a running skeleton and not from a blank folder.

#### Acceptance Criteria

1. THE root `package.json` SHALL define the script `new-app`, so that `pnpm new-app <name>` runs `scripts/new-app.ts` with `<name>` as its first argument.
2. THE New_App_Command SHALL run under Node 22 without a new dependency, and SHALL be written in TypeScript in strict mode, with the plan logic in pure functions that read and write no file.
3. WHEN the command runs with a valid App_Name that does not collide, THE command SHALL create the Generated_App, make the Shared_Files edits, and print the next steps (requirement 1.6), and SHALL exit with status 0.
4. THE command SHALL accept one option, `--dry-run`. WHEN it is given, THE command SHALL print the Plan (every file to create, every line to insert and the port) and SHALL change nothing.
5. IF the arguments are missing, are more than one name, or include an unknown option, THEN THE command SHALL print the usage, change nothing and exit with status 2.
6. WHEN the command succeeds, THE command SHALL print, in order, the three commands to run next: `pnpm install`, `pnpm --filter @dead-certain/<App_Name> dev` and the e2e command for the new smoke spec, together with the address the app serves on.
7. THE command SHALL NOT run `pnpm install`, a build, a test or any other child process, and SHALL make no network call.
8. THE command SHALL be safe to run from any working directory below the repository root, and SHALL find the root by the nearest `pnpm-workspace.yaml`. IF there is none, THEN it SHALL print a message and exit with status 1.

### Requirement 2: Names and collisions

**User Story:** As a developer, I want a bad or taken name refused before anything is written, so that I never have to clean up.

#### Acceptance Criteria

1. THE command SHALL accept an App_Name that matches `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` and is 2 to 30 characters long, and SHALL refuse any other.
2. THE command SHALL refuse the reserved names `site`, `kit`, `assets`, `templates`, `index` and `404`, because they name folders or files in the deployed site, and SHALL refuse any name that the deployed site already serves at `/dead-certain/<name>/`.
3. IF `apps/<App_Name>` exists, or a package named `@dead-certain/<App_Name>` exists, or either Shared_File already mentions the App_Name's folder or preview URL, THEN THE command SHALL refuse with a message that names what collides, change nothing and exit with status 1.
4. IF a Marker is missing from a Shared_File, or occurs more than once, THEN THE command SHALL refuse with a message that names the file and the Marker, change nothing and exit with status 1.
5. THE command SHALL compute the whole Plan, and check every refusal, before it writes the first file.
6. IF a write fails part-way, THEN THE command SHALL remove the files and directories it created in this run, restore the Shared_Files it edited from the text it read, and exit with status 1 with the cause.
7. THE command SHALL NOT overwrite a file. A Plan that would create a file that exists is refused under requirement 2.3.
8. THE command SHALL treat the App_Name as data: it SHALL NOT build a shell command, a regular expression or a path outside `apps/<App_Name>`, `e2e` and the Shared_Files from it.

### Requirement 3: The Template and its Placeholders

**User Story:** As a maintainer, I want the template to be ordinary files that I can read and lint, so that it does not rot.

#### Acceptance Criteria

1. THE Template SHALL hold exactly the files that the Generated_App needs, listed in the design's table. It SHALL be laid out as the Generated_App, plus `templates/app/e2e/` for the end-to-end spec.
2. THE command SHALL copy `templates/app/**` to `apps/<App_Name>/**`, except `templates/app/e2e/*`, which it SHALL copy to `e2e/`, with the file `smoke.spec.ts` renamed to `<App_Name>-smoke.spec.ts`.
3. THE command SHALL replace each Placeholder in the text of each Template file, and SHALL copy no binary file.
4. THE Placeholders SHALL appear in Template files only inside string literals, comments, JSON strings and Markdown text, so that every Template file is valid TypeScript, JSON or Markdown as it stands and passes `pnpm biome check`.
5. THE Template SHALL NOT be a workspace package, SHALL NOT be built by `pnpm build`, and SHALL NOT be type-checked by the root `tsc`.
6. AFTER substitution, NO file of the Generated_App SHALL contain `__APP_`.
7. THE command SHALL derive `__APP_TITLE__` by capitalising each hyphen-separated word, and `__APP_SLUG_CONST__` by upper-casing the name and replacing each hyphen with an underscore.
8. THE Template SHALL carry no Reference_App name (`claim-check`, `pre-flight`, `Claim Check`, `Pre-Flight`) in any file.

### Requirement 4: The Starter_KB

**User Story:** As a developer, I want the new app to work the moment it is created, so that I see a verdict before I write a rule.

#### Acceptance Criteria

1. THE Template SHALL include `kb/starter.yaml`, `rulebook/starter.md` and `golden/scenarios.yaml`, describing one toy domain that is not a real product, with a fictional notice in the rulebook.
2. THE Starter_KB SHALL be small: between 3 and 5 askable facts, at least one derived fact, one goal, at least two line items with `role`, at least two clauses, and one golden scenario for each distinct verdict the rules can reach, with at least 3 scenarios.
3. THE rulebook SHALL number its clauses, and every rule in the Starter_KB SHALL cite a clause that exists.
4. IN a Generated_App, `pnpm dc validate apps/<App_Name>` SHALL report no error and no warning, `pnpm dc build apps/<App_Name>` SHALL write `kb/dist/starter.json`, and `pnpm dc golden apps/<App_Name>` SHALL pass every scenario and cover every rule.
5. THE Starter_KB's knowledge-base `id` SHALL be `__APP_NAME__`.
6. THE Starter_KB SHALL be the work of the Kiro_Lane (requirement 12.2), reviewed by the human, and the Claude_Code_Lane SHALL NOT edit its rules.

### Requirement 5: The Generated_App

**User Story:** As a developer, I want the generated app to be a real consultation app on the kit, so that I only change the rules and the words.

#### Acceptance Criteria

1. THE Generated_App SHALL be a Vite, React and Tailwind app that renders only with `@dead-certain/ui` components and the engine API, with the same dependency pins as the Reference_Apps (requirement 7).
2. THE Generated_App SHALL import its compiled knowledge base from `kb/dist/starter.json`, SHALL check its shape at start-up as the Reference_Apps do (`kbShape.ts`), and WHEN the check fails, SHALL show a plain-words notice and not a blank page.
3. THE Generated_App SHALL name no fact, goal or clause in any file except `src/config.ts`. Every other module SHALL read names, labels, questions and clauses from the knowledge base.
4. THE Generated_App SHALL run a consultation: a start screen, then one question at a time through `next` with the `QuestionCard` and `AnswerControl` for the fact's type, then a verdict screen, as section 8 of `docs/BUILD_PLAN.md` describes the Claim Check flow.
5. THE verdict screen SHALL show each goal's value with its label, each line item as a row with its rule id and clause, and a "See why" control on the verdict and on each line item that opens the X-ray through `XrayStage`, `ProofTree` and `ClauseQuote`.
6. WHERE a goal's value is a word the kit's `verdictStateFrom` maps (`paid`, `reduced`, `denied`, `ready`, `not_ready`), THE verdict screen SHALL show the kit's `VerdictHeadline` for it, and OTHERWISE SHALL show a plain level-1 heading and the goal values.
7. THE Generated_App SHALL keep the answers in the URL fragment as `#/?r=<token>` through the engine's `encode` and `decode`, so that the same link gives the same verdict, and SHALL show the kit's `StaleLinkNotice` for a token the engine cannot read.
8. THE Generated_App SHALL provide "Start over" and "Back".
9. THE Generated_App SHALL make no network request, load no third-party font, script or style, and use no `localStorage`, `sessionStorage`, cookie or analytics.
10. THE Generated_App SHALL follow the design system and the refusals in section 8 of the build plan, SHALL meet the accessibility floor (WCAG 2.2 AA), and SHALL set the document title on each screen.
11. THE Generated_App SHALL meet the budgets of section 10 of the build plan: JavaScript under 200 kB gzipped, cumulative layout shift under 0.05, and one consultation step in under 10 ms.
12. THE Generated_App SHALL give a one-line pointer on its start screen to the rulebook file and the `README.md` section that explains how to replace the rules. It SHALL NOT include a rulebook page.

### Requirement 6: Shared wiring

**User Story:** As a developer, I want CI and the tests to know about the new app without my editing them, so that nothing about it is forgotten.

#### Acceptance Criteria

1. THE command SHALL add to `playwright.config.ts`: an exported constant `<APP_SLUG_CONST>_URL` for `http://localhost:<port>/dead-certain/<App_Name>/`, and a `webServer` entry that builds the app with `pnpm --filter @dead-certain/<App_Name> build` and previews it on that port with `--strictPort`, each inserted before its Marker.
2. THE port SHALL be one more than the highest preview port already named in `playwright.config.ts`, and SHALL be unique in the file.
3. THE command SHALL add to `.github/workflows/ci.yml`: the step `pnpm dc build apps/<App_Name>` before `pnpm check`, and the step `cp -R apps/<App_Name>/dist apps/site/dist/<App_Name>` after the Reference_Apps' copy steps, each inserted before its Marker.
4. THE command SHALL insert each line with the indentation of the Marker's line, and SHALL leave every other byte of both files unchanged.
5. THE Shared_Files SHALL carry the four Markers (`new-app:urls`, `new-app:servers`, `new-app:dc-build`, `new-app:copy`) as comments, added as part of this spec's tasks, each once.
6. THE Generated_App's `e2e/<App_Name>-smoke.spec.ts` SHALL open the app at its preview URL (a string literal built from `__APP_PORT__` and `__APP_NAME__`, so the spec is valid TypeScript as it stands), answer the starter question or questions, reach the verdict, open "See why", check the clause is shown, and check for zero axe violations, at every project width in the Playwright config.
7. WHEN a person later adds an app by hand, THE Markers SHALL still be in place and the command SHALL still work.

### Requirement 7: Dependencies and drift

**User Story:** As a maintainer, I want the template to stay in step with the apps, so that a scaffold made next month builds.

#### Acceptance Criteria

1. THE Template's `package.json` SHALL pin every dependency to an exact version (no `^`, no `~`) and SHALL use the same version as `apps/claim-check/package.json` for each package that both name.
2. THE Template SHALL add no dependency that `apps/claim-check/package.json` does not name, and no package outside the list in section 7 of the build plan.
3. A unit test SHALL fail when the Template's `package.json` and `apps/claim-check/package.json` disagree on a version or on the set of dependency names (apart from the package name).
4. A unit test SHALL fail when the Template's `vite.config.ts`, `index.html` or `src/styles.css` differ from `apps/claim-check`'s after the App_Name and App_Title are normalised, except for the lines listed in the test's allowed-differences table (the base path, the description and the title).

### Requirement 8: Lanes and guards

**User Story:** As the human, I want the command to stay in its lane and the generated app to carry the same guard as the others, so that a pull request cannot cross a lane by accident.

#### Acceptance Criteria

1. THE command SHALL write only under `apps/<App_Name>/`, `e2e/` and in the two Shared_Files, and SHALL refuse to run a Plan that names any other path.
2. THE command SHALL NOT write under `.kiro`, `packages`, `docs`, `.claude`, `.github` other than `workflows/ci.yml`, or `templates`.
3. THE Template SHALL include `src/lanes.test.ts`, the lane guard of the Reference_Apps, forbidding a Claude Code commit from touching `apps/<App_Name>/(kb|rulebook|golden)/`, `.kiro/`, `packages/ui/` and `packages/engine/src/types.ts`.
4. THE command SHALL NOT edit `apps/site`. A link from the site to the new app is a manual step the README names.

### Requirement 9: The Scaffold_Job

**User Story:** As the human, I want CI to prove that the README works, so that "runs from the README alone" is checked on every pull request.

#### Acceptance Criteria

1. THE CI workflow SHALL have a job `scaffold`, in parallel with `check`, that checks out the pull request and runs the README_Block's commands with the App_Name `ci-probe`. BECAUSE a new workspace package changes `pnpm-lock.yaml` and pnpm refuses that under `CI=true`, THE job SHALL set `PNPM_CONFIG_FROZEN_LOCKFILE=false` for its install steps and say why in a comment. THE `check` job SHALL keep `--frozen-lockfile`.
2. THE job SHALL read the commands from the README_Block, replace the example name `my-app` with `ci-probe`, run them in order, and SHALL NOT repeat them in the workflow. IF the README_Block cannot be found, THEN the job SHALL fail.
3. AFTER the commands, THE job SHALL run, for `ci-probe`: `pnpm dc validate`, `pnpm dc golden`, `pnpm check`, `pnpm build`, and `pnpm e2e` limited to the `1280` project and the `ci-probe` smoke spec.
4. THE job SHALL discard the scaffolded files, and SHALL NOT commit or upload them.
5. THE `check` job SHALL NOT scaffold, so that its runtime does not grow.

### Requirement 10: The README section

**User Story:** As a person who has only the README, I want to add a third app in one sitting, so that the skeleton claim is true.

#### Acceptance Criteria

1. THE `README.md` SHALL have a section headed "Add a third app" that holds the README_Block and the explanation around it.
2. THE README_Block SHALL hold, in order, `pnpm install`, `pnpm new-app my-app` and `pnpm install` again. A second fenced block under the heading "Run it" SHALL hold `pnpm --filter @dead-certain/my-app dev`, so that the first block's commands all end.
3. THE section SHALL say, in plain words, what `new-app` creates and which two shared files it edits, what the starter app shows, and which address the dev server prints.
4. THE section SHALL explain how to replace the Starter_KB: write the rulebook in `apps/my-app/rulebook/`, run the `knowledge-engineer` agent with the prompt from section 12 of the build plan (with the golden path `apps/my-app/golden/`), review each rule, then `pnpm dc validate`, `pnpm dc build` and `pnpm dc golden`. It SHALL name `config.ts` as the one file that names facts.
5. THE section SHALL say that a link from the site to the new app is added by hand, and where.
6. THE section SHALL state the time the README_Block takes on a clean clone, measured once by the human in Phase 5, and SHALL leave the figure out until it is measured.
7. THE section SHALL tell the person to commit `pnpm-lock.yaml` with the new app, since the repository's CI installs with a frozen lockfile.
8. THE section SHALL contain no step that is not in the README_Block, the lockfile note or the replace-the-rules list.

### Requirement 11: Evidence and tests

**User Story:** As a reviewer, I want the same evidence for this work as for the apps, so that I can review it the same way.

#### Acceptance Criteria

1. THE script's pure functions (`validateName`, `planFor`, `substitute`, `insertAtMarker`, `nextPort`) SHALL have Vitest tests and the properties of the design.
2. THE root `vitest.config.ts` SHALL include `scripts/**/*.test.ts`, so that `pnpm check` runs them. THE `tsconfig.json` SHALL include `scripts` and set `allowImportingTsExtensions`, because Node's type stripping needs explicit `.ts` extensions in imports between the script's modules.
3. THE Generated_App's pure modules SHALL have Vitest tests, and the property tests of the design SHALL use fast-check `4.10.2` and run each property at least 100 times.
4. EVERY task SHALL end with the Task_Evidence, attached to the pull request and not committed.
5. THE Reference_Apps SHALL behave as before: `pnpm check`, `pnpm e2e` and `pnpm build` SHALL pass with the Markers added and nothing else in them changed.

### Requirement 12: Hand-offs between lanes

**User Story:** As the human, I want each lane's part named, so that neither tool waits or guesses.

#### Acceptance Criteria

1. THE Claude_Code_Lane SHALL build everything in requirements 1 to 3 and 5 to 11 except the Starter_KB's content.
2. THE Kiro_Lane SHALL write the Starter_KB (requirement 4) in a pull request on `kiro/5-template-kb`, merged before task 3 of the plan. UNTIL then, the Claude_Code_Lane SHALL build against a throwaway knowledge base in the test directory and SHALL NOT commit a Starter_KB.
3. AFTER the gate's pull request merges, THE Kiro_Lane SHALL update `.kiro/steering/new-app.md` so that it matches the real command: the real file layout (with `golden/`), `ci.yml` and not `deploy.yml`, the Playwright wiring, the Markers, and `golden/scenarios.yaml` and not `kb/golden.yaml`.
4. AFTER the gate's pull request merges, THE Kiro_Lane SHALL review it against this spec and amend the spec where it accepts a deviation.

## Open questions and decisions

Decided by the brief:

- **Base.** The Template is based on `apps/claim-check` (the consultation app), with Pre-Flight's `collectors/` and `tsconfig.json` left out, because a generic consultation app needs neither.
- **Lane for the command.** `scripts` and `templates` are Claude Code's, as `AGENTS.md` says. The command is Claude Code's.

Decided by the human (2026-11-20):

1. **Who writes the starter knowledge.** Kiro writes the three starter files under `templates/app/` once, on `kiro/5-template-kb` (requirement 12.2). This is a single, approved crossing of the `AGENTS.md` table, which gives `templates` to Claude Code. It does not widen Kiro's lane.
2. **The toy domain.** "Library fine": days late, member type, a cap and a waiver.
3. **Markers or discovery.** Markers (requirement 6). The Reference_Apps' wiring stays as it is.
4. **The look of a generic verdict.** Plain: the kit's headline when the goal word is one it knows, otherwise a heading and the goal values. No ledger (requirement 5.5 and 5.6).
5. **A rulebook page.** None in the generated app (requirement 5.12).
6. **A time target.** None. The README states the measured time once the human has measured it (requirement 10.6).
7. **Scaffold_Job cost.** Path filters: the job's later steps run only when `scripts/`, `templates/`, `README.md`, `playwright.config.ts` or `ci.yml` change (design, "The Scaffold_Job"; task 6.2).

No open question remains.
