# Pre-Flight: open questions

Questions the checklist (`rulebook/checklist.md`) leaves open. The knowledge base does not guess. Where a rule had to behave one way, the question says which, so a human can change it.

| # | Clause | Question | What the rules do now |
| --- | --- | --- | --- |
| 1 | 1.2 | "An open-source licence" is not defined. GitHub can report a licence it labels "Other" or "NOASSERTION". Does that count as detected? | `R-02` reads the boolean `license_detected`. The app decides what GitHub's metadata must say for it to be true. |
| 2 | 1.2 | Does the licence file need to be the file GitHub detected the licence from, or is any of the five named files enough? | `R-02` needs `license_detected` and `license_file_at_root` (any of the five names) to both be true. |
| 3 | 2.1, 2.2 | "Holds at least one file": does a file nested in a subdirectory of `.kiro` count? | The app computes `kiro_dir_has_file`. The rules take it as given. |
| 4 | 2.2 | Clause 2.2 lists six ignoring lines. What about a negation line (`!.kiro`) after an ignoring line, or a `.gitignore` in a subdirectory? | The app computes `gitignore_ignores_kiro` from the six listed lines in the root file only. Negation lines are not handled. |
| 5 | 2.2 | The clause says the directory must be committed. Is a `.kiro` directory with files in the tree not committed? | `R-05` treats a `.kiro` directory with a file in the tree as committed, so it fails when `kiro_dir_has_file` is false. |
| 6 | 3.1 | Heading matching (1 to 6 `#` signs, case-insensitive, one of seven names) needs text matching, which the expression language does not have. Does the heading have to be only that name, or may it contain it (for example "Getting started with Docker")? | The app computes `readme_has_run_heading`. The rules take it as given. Whole-line match is the reading that follows "a heading called one of". |
| 7 | 3.1 | Does a README in a language other than `README.md` (for example `README.rst`) count? | The app decides which file is the README. |
| 8 | 3.2 | "At least two directories, and each of them has a `package.json`": must every directory under `apps` have one, or only two of them? | The first reading. `R-08` needs at least two directories and as many `package.json` counts as directories. |
| 9 | 4.1 | The demo video length is asked in seconds. The checklist gives both minutes and seconds. | `demo_video_seconds` is a number of seconds, and `R-09` needs less than 180. The app may let the user type minutes and convert. |
| 10 | 5.1 | Checks that are asked of the user but not yet answered. | None needed. `READY-01` gives `not_ready` as soon as one check is false, and leaves the goal undecided while no check is false and some are unknown. |
| 11 | all | Severity (blocker or warning) is in the checklist but not in the knowledge-base format. | Not encoded. Severity does not change the goal, per clause 5.1. The app reads it from the clauses. |
