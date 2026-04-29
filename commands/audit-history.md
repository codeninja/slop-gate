---
description: Scan previous Claude Code transcript history for candidate intent-drift episodes.
argument-hint: "[--yes] [--root ~/.claude/projects] [--out drift-history-audit.md] [--limit 250|--all]"
allowed-tools: Bash(claude plugin list *), Bash(node *), Bash(pwd), Bash(test *), Read
---

# Audit Claude History For Drift

Scan previous Claude Code transcript history and create a local candidate corpus
for Slop Gate pattern curation.

User arguments: `$ARGUMENTS`

Privacy and consent:

- Claude transcript history can contain private code, prompts, and secrets.
- If the user did not include `--yes`, ask one confirmation before scanning.
- Do not paste raw transcript dumps into chat. Summarize and quote only minimal,
  redacted excerpts from the generated audit file.

Process:

1. Resolve the Slop Gate plugin root:
   - If `scripts/audit-claude-history.js` exists in the current directory, use
     the current directory.
   - Else run `claude plugin list --json`, find the enabled plugin whose id
     starts with `slop-gate@`, and use its `installPath`.
   - If no plugin root is found, ask the user for the Slop Gate source path.
2. Run the history audit helper from the plugin root:
   - Default root: `~/.claude/projects`
   - Default output: `drift-history-audit.md`
   - Default limit: `250`
   - Honor `--root`, `--out`, `--limit`, and `--all` from `$ARGUMENTS`.
3. Read the generated audit file.
4. Produce a concise summary:
   - transcript files scanned
   - candidate messages found
   - top signal families
   - strongest reusable drift shapes to consider
5. Do not edit `patterns/drift-patterns.md` in this command. End by telling the
   user to run `/slop-gate:ingest-history <audit-file>` when ready.
