"use strict";

const fs = require("node:fs");
const path = require("node:path");

const VALID_SCOPES = new Set(["session", "project"]);

function dismissalsPath(input, env = process.env) {
  const baseDir =
    env.SLOP_GATE_STATE_DIR ||
    env.CLAUDE_PLUGIN_DATA ||
    path.join(input.cwd || process.cwd(), ".slop-gate-data");
  return path.join(baseDir, "dismissals.jsonl");
}

function loadDismissals(input, env = process.env) {
  const filePath = dismissalsPath(input, env);
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      return [];
    }
    return [];
  }

  const records = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.patternId === "string" && VALID_SCOPES.has(parsed.scope)) {
        records.push(parsed);
      }
    } catch {
      // Skip malformed lines; the file is append-only and may have partial writes.
    }
  }
  return records;
}

function appendDismissal(input, record, env = process.env) {
  const filePath = dismissalsPath(input, env);
  const normalized = normalizeRecord(record);
  if (!normalized) {
    return null;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(normalized)}\n`);
  return normalized;
}

function normalizeRecord(record) {
  if (!record || typeof record.patternId !== "string" || !VALID_SCOPES.has(record.scope)) {
    return null;
  }
  const out = {
    patternId: record.patternId,
    scope: record.scope,
    at: record.at || new Date().toISOString()
  };
  if (typeof record.substring === "string" && record.substring.length > 0) {
    out.substring = record.substring;
  }
  if (record.scope === "session" && typeof record.sessionId === "string" && record.sessionId.length > 0) {
    out.sessionId = record.sessionId;
  }
  if (typeof record.reason === "string" && record.reason.length > 0) {
    out.reason = record.reason;
  }
  return out;
}

function findMatchingDismissal(finding, dismissals, sessionId) {
  if (!finding || !Array.isArray(dismissals) || dismissals.length === 0) {
    return null;
  }

  const matchedText = String(finding.matchedText || "").toLowerCase();

  for (const record of dismissals) {
    if (record.patternId !== finding.patternId) {
      continue;
    }
    if (record.scope === "session" && record.sessionId && record.sessionId !== sessionId) {
      continue;
    }
    if (record.substring) {
      if (!matchedText.includes(String(record.substring).toLowerCase())) {
        continue;
      }
    }
    return record;
  }
  return null;
}

module.exports = {
  appendDismissal,
  dismissalsPath,
  findMatchingDismissal,
  loadDismissals,
  normalizeRecord
};
