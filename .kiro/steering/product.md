---
inclusion: always
---

# Product: Dead Certain

**Tagline:** LLMs guess. The dead are certain.

## What it is

Dead Certain is a lean expert-system skeleton. An LLM authors rules from a rulebook once, at build time. A deterministic engine decides at run time and produces a proof for every verdict. No LLM runs at run time. All inference is in the browser.

## The two apps

**Claim Check** — Consultation mode. A health-insurance policyholder answers questions one at a time (only the questions that matter). The app returns how much of a hospital claim will be paid, an itemised deduction list, and the policy clause behind each line.

**Pre-Flight** — Audit mode. A developer submits a public GitHub repository URL. The app collects facts from the GitHub REST API, asks only for what it cannot see, and returns pass or fail for each checklist item with the rule and evidence behind it.

## Signature feature: X-ray

Any verdict line, deduction or failed check can be opened to show its proof: the rules that fired, the facts they used, and the rulebook clause each rule cites. Verdict links are replayable—the answers are stored in the URL fragment so the same link always produces the same verdict.

## Non-goals for this build

- No LLM at run time.
- No accounts, database or backend.
- No upload-any-PDF flow; rules are authored in the repo with Kiro and approved by a human.
- No real insurer documents; Claim Check runs on a sample policy written for this project.

## Why it matters (judging criteria)

| Criterion | Answer |
| --- | --- |
| Potential impact | Two working apps on realistic rulebooks, plus a reusable skeleton |
| Technological implementation | Specs for every component, steering, hooks, a custom `knowledge-engineer` agent, MCP server, and property-based tests |
| Design | One design system across both apps; paper for Q&A, film for proof |
| Innovation | LLM as knowledge engineer feeding a deterministic engine; X-ray proofs; replayable verdict links |
| Presentation | Scripted demo under 3 minutes |
