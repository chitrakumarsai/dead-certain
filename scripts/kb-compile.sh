#!/usr/bin/env bash
# Runs Kiro's knowledge-engineer agent headless on one app's rulebook.
# Started by the human or CI on a clean branch. Claude Code never runs this.
set -euo pipefail

app="${1:?usage: pnpm kb:compile <app>}"
[[ "$app" =~ ^[a-z0-9-]+$ ]] || { echo "Invalid app name: $app" >&2; exit 2; }
[[ -d "apps/$app/rulebook" ]] || { echo "No rulebook at apps/$app/rulebook" >&2; exit 2; }
: "${KIRO_API_KEY:?KIRO_API_KEY is not set}"

# shortcut: --trust-all-tools approves every tool call; narrow to --trust-tools once Kiro lists its tool ids.
kiro-cli chat --v3 --no-interactive --agent knowledge-engineer --trust-all-tools \
  "Compile the rulebook in apps/$app/rulebook into apps/$app/kb"
