---
description: Convert a Slop Gate history audit into append-only drift patterns.
argument-hint: "[drift-history-audit.md]"
allowed-tools: Read, Grep, Glob, Edit, Bash(npm test), Bash(npm run plugin:validate), Task
---

# Ingest History Audit Into Slop Gate

Reflect on audited Claude Code history, identify reusable model-drift patterns,
and ingest those patterns into Slop Gate's append-only pattern repository.

User arguments: `$ARGUMENTS`

Process:

1. Use the first argument as the audit file path. If none is provided, use
   `drift-history-audit.md`.
2. Read the audit file and `patterns/drift-patterns.md`.
3. Treat the audit file as candidate evidence, not ground truth:
   - Merge duplicate episodes into abstract drift shapes.
   - Prefer high-confidence recurring shapes over one-off phrasing.
   - Avoid adding broad regexes that would trigger on ordinary progress updates.
   - Do not ingest private details; use redacted, minimal examples.
4. Invoke the `slop-gate:pattern-curator` agent with a concise curation brief:
   - original audit file path
   - candidate drift shapes
   - whether each shape extends an existing pattern or needs a new pattern
   - the append-only repository policy
5. The curator may append new patterns or append extensions to existing patterns.
   It must not remove, rewrite, rename, reorder, or collapse existing patterns
   unless the user explicitly approved destructive maintenance.
6. Run:
   - `npm test`
   - `npm run plugin:validate`
7. Summarize exactly which pattern ids were added or extended, and mention any
   candidate drift shapes intentionally skipped.
