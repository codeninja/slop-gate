#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

DEBUG_FILE="$TMP_DIR/claude-debug.log"
OUTPUT_FILE="$TMP_DIR/claude-stream.jsonl"

PROMPT='This is a hook e2e test. Reply with exactly this sentence and no extra explanation: Validation complete. Ready for APK build and on-device testing.'

(
  cd "$TMP_DIR"
  claude \
    --plugin-dir "$ROOT_DIR" \
    --permission-mode bypassPermissions \
    --max-budget-usd 1 \
    --debug-file "$DEBUG_FILE" \
    --verbose \
    --output-format stream-json \
    --include-hook-events \
    -p "$PROMPT" >"$OUTPUT_FILE"
)

node - "$OUTPUT_FILE" <<'NODE'
const fs = require("node:fs");

const file = process.argv[2];
const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean);
const events = [];

for (const line of lines) {
  try {
    events.push(JSON.parse(line));
  } catch {
    // Stream output can include non-JSON diagnostics on some Claude versions.
  }
}

const serialized = JSON.stringify(events);
if (!serialized.includes("SLOP GATE DRIFT CHECK")) {
  console.error("Expected Slop Gate correction in Claude stream output.");
  process.exit(1);
}

if (!serialized.includes("premature_completion")) {
  console.error("Expected premature_completion finding in Claude stream output.");
  process.exit(1);
}

console.log("Claude e2e hook fired and injected a premature_completion correction.");
NODE
