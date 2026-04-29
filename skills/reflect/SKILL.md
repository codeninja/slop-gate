---
description: Reflect on a Claude Code mistake and update Slop Gate drift patterns when a reusable detection should be learned.
---

# Reflect And Learn Drift

Use this when the user asks to reflect on a mistake, learn from drift, add a
Slop Gate pattern, extend drift detection, or update the pattern repository.

Process:

1. Restate the mistake in terms of the user's actual intent and Claude's drift.
2. Extract the abstract drift shape that would catch similar future sessions.
3. Invoke the `pattern-curator` agent to update `patterns/drift-patterns.md`.
4. Preserve the pattern repository as append-only memory. Do not remove, rename,
   rewrite, reorder, or collapse existing patterns unless the user explicitly
   approved that destructive maintenance.
5. After the curator edits, run the repository tests and summarize what pattern
   was added or extended.

User context: `$ARGUMENTS`

