# Slop Gate

Slop Gate is a Claude Code plugin that adds lifecycle hooks to catch likely
drift from the user's intent. When a drift pattern is found, the hook blocks the
current action when the Claude Code event supports blocking and injects a
reflection request that states:

- the original task captured from `UserPromptSubmit`
- the assumption being made
- why that assumption is suspect
- the concrete reflection Claude should do before continuing

The current detector is intentionally simple: deterministic pattern matching
over hook inputs such as stop responses, subagent responses, tool plans and
inputs, tool failures, task creation, and task completion. Claude Code hooks do
not expose hidden chain-of-thought; Slop Gate only sees the event payloads that
Claude Code provides.

## Plugin Layout

- `.claude-plugin/plugin.json` declares the Claude Code plugin.
- `hooks/hooks.json` registers the hook on relevant Claude Code lifecycle
  events.
- `agents/pattern-curator.md` lets Claude reflect on mistakes and append or
  extend the pattern repository.
- `skills/reflect/SKILL.md` gives users a namespaced way to ask Claude to learn
  from drift, for example `/slop-gate:reflect <mistake>`.
- `patterns/drift-patterns.md` is the append-only markdown pattern repository
  loaded by the hook.
- `bin/slop-gate-hook` is the executable hook entrypoint.
- `src/` contains the pattern engine, state handling, and event response logic.
- `docs/drift-abstracts.md` maps the original `drift-findings.md` examples into
  reusable detection families.

## Pattern Memory Policy

The pattern repository is append-only by default. Claude may add new patterns or
append signals/examples to existing patterns. It may not remove, rewrite,
rename, reorder, or overwrite patterns unless the user explicitly approves that
destructive maintenance in the current conversation.

The hook enforces that policy for `patterns/*.md` edits. Direct `Write`
overwrites, destructive `Edit`/`MultiEdit` changes, and shell-based mutations of
the pattern repository are denied unless the user has explicitly approved
removal or rewriting.

## Local Use

Run Claude Code with the plugin loaded from this repo:

```bash
claude --plugin-dir . 
```

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
events. It is not part of the default test command because it requires a working
Claude Code login and may make model calls.
