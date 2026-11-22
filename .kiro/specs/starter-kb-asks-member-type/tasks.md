# Implementation Plan: starter-kb-asks-member-type

## Overview

A Bugfix of the Kiro lane, allowed by the human for `templates/app/{kb,rulebook,golden}`. Branch `kiro/5-starter-kb-fix`.

## Tasks

- [x] 1. Reproduce the defect on a scaffolded copy
  - In a throwaway worktree of `main`, run `pnpm install`, `pnpm new-app probe-app`, `pnpm install`, `pnpm dc build apps/probe-app`. Run a throwaway test that answers the engine's questions for a late book and prints which facts were asked and the line items.
  - Expect: `member_type` never asked, `cap_deduction` null.
  - _Requirements: 1.1 to 1.4_

- [x] 2. Fix the rules, the rulebook and the scenarios
  - Edit `templates/app/kb/starter.yaml`, `templates/app/rulebook/starter.md` and `templates/app/golden/scenarios.yaml` as the design says. Keep the placeholders.
  - _Requirements: 2.1 to 2.6, 3.1 to 3.5_

- [x] 3. Check the fix on a scaffolded copy
  - Scaffold `probe-app` from the fixed template in a throwaway worktree. Run `pnpm dc validate`, `pnpm dc build`, `pnpm dc golden`, `pnpm check` and the smoke spec of the copy. Run the throwaway test again: `member_type` asked for a late book, every line known.
  - Look at the verdict screen of the copy: the cap line shows an amount.
  - Remove the worktree. Commit nothing from it.
  - _Requirements: 2.2 to 2.4, 3.2, 3.6_

- [x] 4. Log the session in `docs/kiro-log.md`, commit and push `kiro/5-starter-kb-fix`
