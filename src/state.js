"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function getStatePath(input, env = process.env) {
  const sessionId = sanitize(input.session_id || "unknown-session");
  const baseDir =
    env.SLOP_GATE_STATE_DIR ||
    env.CLAUDE_PLUGIN_DATA ||
    path.join(input.cwd || process.cwd(), ".slop-gate-data");
  return path.join(baseDir, "sessions", `${sessionId}.json`);
}

function loadState(input, env = process.env) {
  const filePath = getStatePath(input, env);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      return normalizeState({ stateReadError: String(error.message || error) });
    }
    return normalizeState({});
  }
}

function saveState(input, state, env = process.env) {
  const filePath = getStatePath(input, env);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(tmpPath, `${JSON.stringify(normalizeState(state), null, 2)}\n`);
  fs.renameSync(tmpPath, filePath);
}

function normalizeState(state) {
  return {
    originalTask: state.originalTask || "",
    latestUserPrompt: state.latestUserPrompt || "",
    prompts: Array.isArray(state.prompts) ? state.prompts.slice(-10) : [],
    validationEvidence: Array.isArray(state.validationEvidence)
      ? state.validationEvidence.slice(-20)
      : [],
    toolFailures: Array.isArray(state.toolFailures) ? state.toolFailures.slice(-20) : [],
    corrections: Array.isArray(state.corrections) ? state.corrections.slice(-50) : [],
    stateReadError: state.stateReadError || ""
  };
}

function sanitize(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 120) || "unknown";
}

function fallbackStateDir() {
  return path.join(os.tmpdir(), "slop-gate");
}

module.exports = {
  fallbackStateDir,
  getStatePath,
  loadState,
  saveState
};

