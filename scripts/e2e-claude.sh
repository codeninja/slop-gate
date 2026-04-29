#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
KEEP_ARTIFACTS="${SLOP_GATE_E2E_KEEP:-0}"
cleanup() {
  if [[ "$KEEP_ARTIFACTS" == "1" ]]; then
    printf '\nArtifacts kept in %s\n' "$TMP_DIR"
  else
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

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

node "$ROOT_DIR/scripts/render-e2e-claude-output.js" "$OUTPUT_FILE" "$PROMPT"
