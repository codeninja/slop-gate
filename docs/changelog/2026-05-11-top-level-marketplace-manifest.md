# Top-level marketplace manifest

**Date:** 2026-05-11
**Version:** 0.3.0
**PR:** [#4](https://github.com/codeninja/slop-gate/pull/4)

## Summary

Slop Gate now ships a `marketplace.json` at the repository root so Claude Code
can install the plugin directly from the public GitHub repo via the standard
`claude plugin marketplace add codeninja/slop-gate` flow. Previously the
manifest lived at `.claude-plugin/marketplace.json`, which the public
marketplace loader does not discover.

## What changed

- Added `marketplace.json` at the repo root with the `codeninja-slop-gate`
  marketplace entry pointing at the local plugin (`source: "./"`).
- Updated the README "Plugin Layout" section to document the new location.
- Updated `commands/setup.md` so `/slop-gate:setup` looks for the manifest at
  the root instead of under `.claude-plugin/`.

## Install path enabled by this change

```bash
claude plugin marketplace add codeninja/slop-gate --scope user
claude plugin install slop-gate@codeninja-slop-gate --scope user
```

## Notes

- Plugin version remains `0.3.0`; this change only relocates the marketplace
  manifest and adjusts the loader paths.
- Local-development installs from the working tree (`claude plugin marketplace
  add "$(pwd)"`) continue to work — the loader resolves the same root file.
