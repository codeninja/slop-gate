---
description: Flag a drift or assumption Slop Gate missed in the current session, propose a pattern update, and continue with the corrected direction.
argument-hint: "<description of the missed drift>"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm test*), Bash(cat *)
---

# Slop Gate In-Session Drift Flag

Use this when Claude drifted, made an unsupported assumption, or otherwise
missed an event in the current conversation that Slop Gate's hook did not
catch. The command names the offense, proposes a reusable pattern update,
and — after explicit user confirmation — appends to the pattern repository
before continuing the original task with the corrected direction.

This command operates on the current conversation only. For learning from
prior Claude Code session histories, use `/slop-gate:audit-history` and
`/slop-gate:ingest-history` instead.

User arguments: `$ARGUMENTS`

Process:

1. Read recent assistant turns in the current conversation. Work only from
   what was actually said and done in this session — do not invent behavior
   to fit the user's complaint. Also read `intent.json` if it exists at the
   resolved state path (`$SLOP_GATE_STATE_DIR/intent.json` →
   `$CLAUDE_PLUGIN_DATA/intent.json` → `<cwd>/.slop-gate-data/intent.json`)
   so the declared goal and scope are in view.

2. Restate, in two lines:
   - The user's intent for the current task (from their original prompt and
     `intent.json` if present).
   - The specific drift the user just flagged in `$ARGUMENTS`, grounded in a
     concrete assistant turn (quote the offending phrase or action).

3. Identify the root cause as a one-sentence drift shape that abstracts
   beyond this exact phrasing. Useful framings:
   - "Confidence-laden cause inference without a verification step."
   - "Re-touched a file the user explicitly placed out of scope."
   - "Declared completion without running the requested validation."

4. Read `patterns/drift-patterns.md` and decide:
   - **New pattern** — append a new `## Pattern: <id>` section if no
     existing pattern fits the drift shape.
   - **Extension** — append an `### Extensions` subsection (or new bullets
     under an existing one) on an existing pattern if the drift is a
     variant of one already there.

   Draft the proposed change as a concrete diff: show the section header,
   `Status` / `Severity` / `Title` / `Assumption` / `Challenge` lines for a
   new pattern, the new signals as `/regex/` literals, and one or two
   concrete examples (one of which should quote the offending assistant
   turn from this session).

5. Present to the user in this order, **without writing anything yet**:
   - Restated intent.
   - Root cause (one sentence).
   - Proposed pattern diff.
   - Ask: "Apply this pattern update? (`y` / `edit` / `skip`)"

   Stop and wait for the user's reply. Do not edit
   `patterns/drift-patterns.md` before confirmation arrives.

6. On the user's reply:
   - `y` → invoke the `pattern-curator` agent (subagent_type
     `pattern-curator`) with a self-contained prompt that includes the
     restated intent, the root cause, the offending assistant turn, the
     full proposed pattern diff, and an explicit reminder that
     `patterns/drift-patterns.md` is append-only. After it returns, run
     `npm test` and report pass / fail along with what was added or
     extended.
   - `edit` → ask which field (title, signals, examples, severity, etc.)
     to revise, regenerate the diff, show it again, and re-prompt at
     step 5.
   - `skip` → do not write a pattern. Acknowledge and proceed to step 7.

7. Continue the original task with the corrected direction. Treat
   `$ARGUMENTS` as the operative instruction for the next action: address
   the drift the user flagged, do the thing they actually wanted, and
   avoid repeating the offense. The user's literal message stays in the
   conversation history regardless of tone — this command does not
   rewrite or sanitize it.

Notes:

- The pattern repository is append-only. Do not delete, rename, rewrite,
  reorder, or collapse existing patterns. The `pattern-curator` agent
  enforces this — prefer to delegate the write rather than editing the
  file directly.
- If the drift looks one-off and not worth a reusable pattern, the user
  can answer `skip` at step 5. The command will still re-orient on the
  corrected direction without touching the repository.
- Quote the offending assistant turn verbatim when proposing examples so
  the pattern's regex signals are calibrated against real text from this
  session, not a paraphrase.
