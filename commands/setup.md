---
description: First-time Slop Gate setup for a Claude Code environment.
argument-hint: "[plugin-root] [--scope user|project|local]"
allowed-tools: Bash(claude plugin *), Bash(pwd), Bash(test *), Read
---

# Slop Gate First-Time Setup

Set up Slop Gate for future Claude Code sessions.

User arguments: `$ARGUMENTS`

Process:

1. Determine the requested install scope. Default to `user` unless the user
   supplied `--scope project` or `--scope local`.
2. Determine the plugin source root:
   - If the first argument is a path, use it.
   - Else if the current directory contains `.claude-plugin/marketplace.json`,
     use the current directory.
   - Else inspect `claude plugin list --json` and `claude plugin marketplace list --json`
     to determine whether Slop Gate is already installed.
3. If a plugin source root is available, validate and install it:
   - `claude plugin validate <plugin-root>`
   - `claude plugin marketplace add <plugin-root> --scope <scope>`
   - `claude plugin install slop-gate@codeninja-slop-gate --scope <scope>`
4. If Slop Gate is already installed and enabled, compare the installed version
   with the source version. If the source is newer, run
   `claude plugin update slop-gate@codeninja-slop-gate`.
5. Tell the user to run `/reload-plugins` in already-open Claude Code sessions.
6. Recommend the next first-time commands:
   - `/slop-gate:audit-history --yes`
   - `/slop-gate:ingest-history drift-history-audit.md`
   - `/slop-gate:verify`

Keep the response short and include the exact commands that were run or that the
user still needs to run.
