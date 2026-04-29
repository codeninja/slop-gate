---
description: Declare the goal and allowed/forbidden file scope for the current task so Slop Gate can flag scope creep and forbidden touches.
argument-hint: "<set|show|clear> [--goal \"...\"] [--allowed-scope \"glob\"] [--forbidden-scope \"glob\"]"
allowed-tools: Bash(mkdir *), Bash(node *), Bash(cat *), Bash(jq *), Bash(rm *), Bash(printf *), Read, Write
---

# Slop Gate Intent Envelope

Declare a structured intent for the current task. Slop Gate uses this to flag
file-touch operations that fall outside the allowed scope or hit the forbidden
scope, in addition to its existing drift patterns.

User arguments: `$ARGUMENTS`

The intent file lives at:

- `$SLOP_GATE_STATE_DIR/intent.json` if that env var is set, else
- `$CLAUDE_PLUGIN_DATA/intent.json` if that is set, else
- `<cwd>/.slop-gate-data/intent.json`.

Process by subcommand:

## `set`

1. Parse flags. `--allowed-scope` and `--forbidden-scope` may be repeated; each
   value is a glob (`src/**`, `tests/*.js`, `db/migrations/*.sql`). `--goal`
   takes a free-text string. If `--goal` is not provided and no goal is set,
   default it from Slop Gate's session `originalTask` if available; otherwise
   leave it empty.
2. Read any existing `intent.json`.
3. Build the new record with shape:
   ```json
   {
     "goal": "...",
     "allowedScope": ["src/**"],
     "forbiddenScope": ["db/**"],
     "at": "<ISO 8601 timestamp>"
   }
   ```
4. Validate: at least one of `allowedScope` or `forbiddenScope` should be
   non-empty (otherwise the intent file does nothing). If both are empty, warn
   the user and ask whether to continue.
5. Write the file (overwriting). When this command is invoked from an
   installed plugin, prefer the helper module so you do not assume CWD:
   `node -e 'require("${CLAUDE_PLUGIN_ROOT}/src/intent-detectors").saveIntent({cwd: process.cwd()}, JSON.parse(process.argv[1]))' '<one-line JSON intent>'`.
   Or write the JSON file directly with `Write` if you have already resolved
   the absolute path.

6. Report what was set.

## `show`

1. Read `intent.json`. If missing, say so.
2. Print `goal`, `allowedScope`, `forbiddenScope`, and `at`.

## `clear`

1. Delete `intent.json` if it exists.
2. Confirm.

## How Slop Gate uses the intent

On `PreToolUse`:

- For `Write`, `Edit`, and `MultiEdit`, the target `file_path` is checked
  against `forbiddenScope` (deny) and `allowedScope` (advise on miss).
- For `Bash`, write targets are extracted on a best-effort basis — output
  redirects (`> file`, `>> file`), `tee`, `rm`, `mv`, `cp`, `truncate`, and
  `sed -i`. Complex commands or interpreter-as-arg invocations
  (`python script.py out.txt`) are not parsed. Treat Bash coverage as advisory.

Notes:

- Globs support `*` (within a path segment), `**` (across segments), and `?`.
- Paths are matched after relativizing absolute file paths to the project's
  cwd, so `src/**` matches both `src/foo.ts` and `/abs/path/to/project/src/foo.ts`.
- The intent file is project-scoped. Re-running `set` overwrites it.
