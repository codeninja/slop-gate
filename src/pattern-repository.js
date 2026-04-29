"use strict";

const fs = require("node:fs");
const path = require("node:path");

function defaultPatternFile(env = process.env, cwd = process.cwd()) {
  if (env.SLOP_GATE_PATTERN_FILE) {
    return env.SLOP_GATE_PATTERN_FILE;
  }
  if (env.CLAUDE_PLUGIN_ROOT) {
    return path.join(env.CLAUDE_PLUGIN_ROOT, "patterns", "drift-patterns.md");
  }
  return path.join(cwd, "patterns", "drift-patterns.md");
}

function loadMarkdownPatterns(env = process.env, cwd = process.cwd()) {
  const filePath = defaultPatternFile(env, cwd);
  let markdown;
  try {
    markdown = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  return parsePatternMarkdown(markdown);
}

function parsePatternMarkdown(markdown) {
  const patterns = [];
  const sections = String(markdown || "").split(/^## Pattern:\s+/m).slice(1);

  for (const section of sections) {
    const firstNewline = section.indexOf("\n");
    if (firstNewline === -1) {
      continue;
    }

    const id = section.slice(0, firstNewline).trim();
    const body = section.slice(firstNewline + 1);
    const fields = parseFields(body);
    const regexes = parseSignalRegexes(body);

    if (!id || fields.status === "disabled" || regexes.length === 0) {
      continue;
    }

    patterns.push({
      id,
      title: fields.title || id,
      severity: normalizeSeverity(fields.severity),
      requiresNoValidationEvidence: fields["requires no validation evidence"] === "true",
      assumption: fields.assumption || `The response appears to match ${id}.`,
      challenge: fields.challenge || "Reflect before continuing.",
      regexes
    });
  }

  return patterns;
}

function parseFields(body) {
  const fields = {};
  for (const line of body.split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z -]+):\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    fields[match[1].trim().toLowerCase()] = match[2].trim();
  }
  return fields;
}

function parseSignalRegexes(body) {
  const regexes = [];
  let inSignals = false;

  for (const line of body.split(/\r?\n/)) {
    if (/^###\s+Signals\s*$/i.test(line.trim())) {
      inSignals = true;
      continue;
    }
    if (inSignals && /^###\s+/.test(line.trim())) {
      break;
    }
    if (!inSignals) {
      continue;
    }

    const match = /^\s*-\s+`(.+)`\s*$/.exec(line);
    if (!match) {
      continue;
    }
    const regex = parseRegexLiteral(match[1]);
    if (regex) {
      regexes.push(regex);
    }
  }

  return regexes;
}

function parseRegexLiteral(value) {
  const text = String(value || "").trim();
  if (!text.startsWith("/")) {
    return null;
  }

  const lastSlash = findLastUnescapedSlash(text);
  if (lastSlash <= 0) {
    return null;
  }

  const source = text.slice(1, lastSlash);
  const flags = dedupeFlags(text.slice(lastSlash + 1).replace(/[^dgimsuvy]/g, ""));

  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

function findLastUnescapedSlash(text) {
  for (let index = text.length - 1; index > 0; index -= 1) {
    if (text[index] !== "/") {
      continue;
    }
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
      backslashes += 1;
    }
    if (backslashes % 2 === 0) {
      return index;
    }
  }
  return -1;
}

function dedupeFlags(flags) {
  return Array.from(new Set(String(flags || "").split(""))).join("");
}

function normalizeSeverity(value) {
  const severity = String(value || "").trim().toLowerCase();
  if (severity === "high" || severity === "medium" || severity === "low") {
    return severity;
  }
  return "medium";
}

module.exports = {
  defaultPatternFile,
  loadMarkdownPatterns,
  parsePatternMarkdown,
  parseRegexLiteral
};

