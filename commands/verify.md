---
description: Verify Slop Gate is installed, enabled, and ready for future Claude Code sessions.
argument-hint: "[--live]"
allowed-tools: Bash(claude plugin *), Bash(node *), Bash(npm test), Bash(npm run plugin:validate), Bash(mktemp *), Bash(rm *), Read
---

# Verify Slop Gate

Verify Slop Gate's installed state and local repository health.

User arguments: `$ARGUMENTS`

Process:

1. Run `claude plugin list --json` and confirm an enabled plugin id beginning
   with `slop-gate@`.
2. Resolve the plugin root:
   - Use the current directory if `.claude-plugin/plugin.json` exists.
   - Otherwise use the installed plugin's `installPath`.
3. Run `claude plugin validate <plugin-root>`.
4. If the current directory is the Slop Gate source repository, run `npm test`.
5. If the user provided `--live`, run a short non-interactive Claude smoke test
   with `--include-hook-events` and confirm the Stop hook produces Slop Gate
   feedback. Warn that this makes a model call before running it.
6. Report:
   - installed plugin id and scope
   - install path
   - validation status
   - whether a live hook check was run
