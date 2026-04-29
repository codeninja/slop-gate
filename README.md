# Slop Gate

Slop Gate is a Claude Code plugin that adds lifecycle hooks to surface
candidate intent drift. When a drift pattern is found, the hook injects an
advisory reflection request as additional context on the current event so
Claude can see and respond to it without halting. The one exception is
`PreToolUse`, where the hook denies the planned tool call so the gate can
prevent drift before it runs. The reflection request states:

- the original task captured from `UserPromptSubmit`
- the assumption being made
- why that assumption is suspect
- the concrete reflection Claude should do before continuing

The primary detector is intentionally simple: deterministic pattern matching
over hook inputs such as stop responses, subagent responses, tool plans and
inputs, tool failures, task creation, and task completion. Stop and SubagentStop
also include a prompt-based semantic backstop for high-confidence judgment calls
about unsupported completion, validation, readiness, or user-as-tester claims.
Claude Code hooks do not expose hidden chain-of-thought; Slop Gate only sees the
event payloads that Claude Code provides.


## Pattern Memory Policy

The pattern repository is append-only by default. Claude may add new patterns or
append signals/examples to existing patterns. It may not remove, rewrite,
rename, reorder, or overwrite patterns unless the user explicitly approves that
destructive maintenance in the current conversation.

The hook enforces that policy for `patterns/*.md` edits. Direct `Write`
overwrites, destructive `Edit`/`MultiEdit` changes, and shell-based mutations of
the pattern repository are denied unless the user has explicitly approved
removal or rewriting.


## Install

After the GitHub repository is public, users can install Slop Gate from the
public marketplace hosted by this repo:

```bash
claude plugin marketplace add codeninja/slop-gate --scope user
claude plugin install slop-gate@codeninja-slop-gate --scope user
```

For local development before publishing, add the marketplace from the working
tree:

```bash
claude plugin marketplace add "$(pwd)" --scope user
claude plugin install slop-gate@codeninja-slop-gate --scope user
```

To refresh an existing install after local changes:

```bash
claude plugin update slop-gate@codeninja-slop-gate
```

Then reload plugins in any active Claude Code session:

```text
/reload-plugins
```

Marketplace-installed plugins are copied into Claude's plugin cache. Use
`claude --plugin-dir .` when developing this plugin so Claude loads the working
tree directly.

## Public Release Checklist

Before sharing the public marketplace:

```bash
npm test
npm run plugin:validate
```

Then commit the release, validate the release tag, push it to GitHub, and
create/push the plugin release tag:

```bash
git add .
git commit -m "Prepare Slop Gate public plugin release"
claude plugin tag --dry-run .
git push origin main
claude plugin tag . --push
```


To submit Slop Gate to Anthropic's public plugin directory, use the public
GitHub repository URL in one of the submission forms linked in the Claude plugin
submission docs. The official directory is surfaced in Claude Code as the
`claude-plugins-official` marketplace after review.

## First-Time History Ingestion

After Slop Gate is installed, use these slash commands in order:

```text
/slop-gate:setup
/slop-gate:audit-history --yes
/slop-gate:ingest-history drift-history-audit.md
/slop-gate:verify
```

`/slop-gate:audit-history` scans previous Claude Code transcript JSONL files
under `~/.claude/projects`, writes a redacted candidate corpus to
`drift-history-audit.md`, and summarizes likely drift families. It does not edit
the pattern repository. `/slop-gate:ingest-history` reviews that audit, invokes
the pattern curator, and appends only reusable high-confidence drift patterns to
`patterns/drift-patterns.md`.

Validate the plugin manifest and hooks:

```bash
npm run plugin:validate
```

Run deterministic hook tests:

```bash
npm test
```

Run the real Claude Code e2e smoke test:

```bash
npm run test:e2e
```

The e2e script uses `claude -p --plugin-dir .` and inspects the stream JSON hook
events. It prints the prompt sent to Claude, Claude's streamed text output, the
Slop Gate correction delivered back to Claude, and a compact effect check showing
that the hook correction and block decision reached the stream. It is not part of
the default test command because it requires a working Claude Code login and may
make model calls.

To keep the raw Claude debug and stream files after the e2e run:

```bash
SLOP_GATE_E2E_KEEP=1 npm run test:e2e
```

## Plugin Layout

- `.claude-plugin/plugin.json` declares the Claude Code plugin.
- `.claude-plugin/marketplace.json` declares the local marketplace entry used
  for permanent installation.
- `commands/` provides `/slop-gate:*` slash commands for first-time setup,
  history auditing, pattern ingestion, and verification.
- `hooks/hooks.json` registers the hook on relevant Claude Code lifecycle
  events.
- `agents/pattern-curator.md` lets Claude reflect on mistakes and append or
  extend the pattern repository.
- `skills/reflect/SKILL.md` gives users a namespaced way to ask Claude to learn
  from drift, for example `/slop-gate:reflect <mistake>`.
- `patterns/drift-patterns.md` is the append-only markdown pattern repository
  loaded by the hook.
- `bin/slop-gate-hook` is the executable hook entrypoint.
- `scripts/audit-claude-history.js` scans Claude Code transcript JSONL files and
  creates a local candidate corpus for pattern curation.
- `src/` contains the pattern engine, state handling, and event response logic.
- `docs/drift-abstracts.md` maps the original `drift-findings.md` examples into
  reusable detection families.