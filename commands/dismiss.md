---
description: Dismiss a Slop Gate drift pattern when it has produced a false positive in this session or project.
argument-hint: "<pattern_id> [--substring \"...\"] [--project] [--reason \"...\"]"
allowed-tools: Bash(mkdir *), Bash(printf *), Bash(node *), Bash(cat *), Bash(jq *), Read
---

# Dismiss a Slop Gate Drift Pattern

Tell Slop Gate to stop flagging a specific drift pattern when it has produced a
false positive. Dismissals are append-only — they never remove or rewrite the
pattern itself, only suppress matches that fit the dismissal record.

User arguments: `$ARGUMENTS`

Process:

1. Parse arguments:
   - `<pattern_id>` (required): the `patternId` shown in the most recent Slop
     Gate correction (for example `process_substitution`,
     `pattern_repository_append_only`).
   - `--substring "..."` (optional): only dismiss matches whose `matchedText`
     contains this substring (case-insensitive). Without it, all matches of the
     given pattern are dismissed within scope.
   - `--project` (optional): persist the dismissal across sessions for this
     project. Default scope is `session` (only this Claude Code session).
   - `--reason "..."` (optional): a short note for future you about why this
     match was a false positive.

2. Determine the dismissal record:
   - `patternId`: from arg 1
   - `scope`: `project` if `--project` is present, otherwise `session`
   - `substring`: the value passed to `--substring`, if any
   - `sessionId`: when `scope` is `session`, use the current Claude Code
     session id. If you cannot determine it, ask the user once.
   - `reason`: the value passed to `--reason`, if any
   - `at`: current ISO 8601 timestamp

3. Resolve the dismissals file path:
   - If `SLOP_GATE_STATE_DIR` is set, write to `$SLOP_GATE_STATE_DIR/dismissals.jsonl`.
   - Else if `CLAUDE_PLUGIN_DATA` is set, write to `$CLAUDE_PLUGIN_DATA/dismissals.jsonl`.
   - Else write to `<cwd>/.slop-gate-data/dismissals.jsonl`.

4. Ensure the parent directory exists, then append the record as a single JSON
   line. Two options:
   - Append directly: `printf '%s\n' '<one-line JSON record>' >> <dismissals path>`
     (use `printf`, not `echo -e`, and ensure no other text gets to the file).
   - Or call the helper module from the installed plugin:
     `node -e 'require("${CLAUDE_PLUGIN_ROOT}/src/dismissals").appendDismissal({cwd: process.cwd()}, JSON.parse(process.argv[1]))' '<one-line JSON record>'`

5. Confirm the dismissal back to the user with the recorded `patternId`,
   `scope`, and (if set) `substring`. Tell them how to undo it: edit
   `dismissals.jsonl` and remove the line. Do not rewrite or reorder the file.

Notes:

- Dismissals are append-only. Never `sed -i`, `truncate`, `> file`, or
  otherwise rewrite `dismissals.jsonl` from this command.
- A dismissal does not delete the pattern. The pattern still detects future
  matches that don't fit the dismissal record (different substring, different
  session for `scope=session`, etc.).
- Use `--substring` whenever the false positive is narrow. Dismissing a whole
  pattern session-wide makes sense only when the pattern is consistently noisy
  in this task.
