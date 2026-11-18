# Repository Submission Checklist

This is a fictional checklist written for Dead Certain, in its own words. It is for a hackathon repository that holds two apps built on one foundation. It does not reproduce any organiser's rules.

Each clause below is one check, with an id from R-01 to R-09. Every check says where its answer comes from:

- **Collected from GitHub**: the tool reads the answer from repository metadata, the file tree, the `.gitignore` file at the root or the README. When GitHub cannot supply the data (for example, the file list is cut short), the tool asks the same question of the user.
- **Asked of the user**: GitHub cannot show the answer, so the tool asks.

Each check also has a severity. A blocker must be fixed before submission. A warning should be fixed.

## 1. Repository

### 1.1 Public repository

The repository is public. Anyone can open it without signing in.

- Check: R-01
- Source: collected from GitHub (the repository metadata says it is not private)
- Severity: blocker

### 1.2 Open-source licence file

The repository has a licence file at the root, and GitHub detects an open-source licence from it. A file that GitHub cannot recognise as a licence does not pass.

- Check: R-02
- Source: collected from GitHub (the metadata names a licence, and a file called `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `COPYING` or `COPYING.md` is at the root)
- Severity: blocker

### 1.3 Repository is not archived

The repository is not archived. An archived repository is read-only and cannot take a last fix.

- Check: R-03
- Source: collected from GitHub (the repository metadata)
- Severity: warning

## 2. Kiro usage

### 2.1 The .kiro directory at the root

A directory named `.kiro` sits at the root of the repository and holds at least one file.

- Check: R-04
- Source: collected from GitHub (the file tree)
- Severity: blocker

### 2.2 The .kiro directory is committed and not ignored

The `.kiro` directory is committed. No active line in the `.gitignore` file at the root ignores `.kiro` itself. These lines ignore it: `.kiro`, `.kiro/`, `/.kiro`, `/.kiro/`, `.kiro/*` and `.kiro/**`. A line that ignores only something inside `.kiro` (for example `.kiro/cache/`) does not fail this check. A repository with no `.gitignore` passes this check if R-04 passes.

- Check: R-05
- Source: collected from GitHub (the file tree and the `.gitignore` file)
- Severity: blocker

### 2.3 At least one spec

The `.kiro/specs` directory holds at least one directory that contains a file called `tasks.md`.

- Check: R-06
- Source: collected from GitHub (the file tree)
- Severity: warning

## 3. Project

### 3.1 README with run instructions

The repository has a README at the root with a heading called one of: Getting started, Install, Installation, Run, Running, Usage or Quick start. Capital letters do not matter. A heading is a line that starts with 1 to 6 `#` signs.

- Check: R-07
- Source: collected from GitHub (the README)
- Severity: warning

### 3.2 Two app folders

The `apps` directory at the root holds at least two directories, and each of them has a `package.json` file directly inside it.

- Check: R-08
- Source: collected from GitHub (the file tree)
- Severity: blocker

## 4. Submission

### 4.1 Demo video length

The demo video runs for less than 3 minutes. A video that runs for exactly 3 minutes (180 seconds) does not pass.

- Check: R-09
- Source: asked of the user (GitHub cannot show the length of a video)
- Severity: blocker

## 5. Readiness

### 5.1 When the repository is ready

The repository is ready when all nine checks, R-01 to R-09, pass. If any one check fails, the repository is not ready, whether that check is a blocker or a warning. It is not ready as soon as one check fails, even while other checks are still waiting for an answer.
