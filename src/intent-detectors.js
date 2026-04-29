"use strict";

const fs = require("node:fs");
const path = require("node:path");

function intentPath(input, env = process.env) {
  const baseDir =
    env.SLOP_GATE_STATE_DIR ||
    env.CLAUDE_PLUGIN_DATA ||
    path.join(input.cwd || process.cwd(), ".slop-gate-data");
  return path.join(baseDir, "intent.json");
}

function loadIntent(input, env = process.env) {
  const filePath = intentPath(input, env);
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return normalizeIntent(parsed);
  } catch {
    return null;
  }
}

function saveIntent(input, intent, env = process.env) {
  const filePath = intentPath(input, env);
  const normalized = normalizeIntent(intent || {});
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

function clearIntent(input, env = process.env) {
  const filePath = intentPath(input, env);
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function normalizeIntent(intent) {
  return {
    goal: typeof intent.goal === "string" ? intent.goal : "",
    allowedScope: Array.isArray(intent.allowedScope)
      ? intent.allowedScope.filter((entry) => typeof entry === "string" && entry.length > 0)
      : [],
    forbiddenScope: Array.isArray(intent.forbiddenScope)
      ? intent.forbiddenScope.filter((entry) => typeof entry === "string" && entry.length > 0)
      : [],
    at: typeof intent.at === "string" ? intent.at : new Date().toISOString()
  };
}

function globToRegex(glob) {
  let out = "^";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      out += ".*";
      i += 1;
      if (glob[i + 1] === "/") {
        i += 1;
      }
    } else if (ch === "*") {
      out += "[^/]*";
    } else if (ch === "?") {
      out += "[^/]";
    } else if (".+(){}[]^$|\\".includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  out += "$";
  return new RegExp(out);
}

function matchesAnyGlob(candidatePath, globs) {
  if (!candidatePath || !Array.isArray(globs) || globs.length === 0) {
    return false;
  }
  return globs.some((glob) => globToRegex(glob).test(candidatePath));
}

function relativizePath(filePath, cwd) {
  if (!filePath) {
    return "";
  }
  const normalized = path.normalize(String(filePath));
  if (path.isAbsolute(normalized) && cwd) {
    const rel = path.relative(cwd, normalized);
    if (rel && !rel.startsWith("..")) {
      return rel.split(path.sep).join("/");
    }
  }
  return normalized.split(path.sep).join("/");
}

const BASH_WRITE_TARGET_REGEXES = [
  /(?:^|[^>\d])>{1,2}\s*([^\s|;&<>]+)/,
  /\btee\s+(?:-a\s+)?([^\s|;&<>]+)/,
  /\b(?:rm|mv|cp|truncate)\s+(?:-[A-Za-z]+\s+)*([^\s|;&<>]+)/,
  /\bsed\s+[^|;&]*-i(?:\s|=)[^|;&]*?\s([^\s|;&<>]+)$/m
];

function extractBashWriteTargets(command) {
  // Best-effort extraction. Each regex runs once without /g, so commands like
  // `rm a.txt b.txt c.txt` surface only the first target. The PreToolUse
  // detector treats this as advisory; complex pipelines are not parsed.
  const text = String(command || "");
  const targets = new Set();
  for (const regex of BASH_WRITE_TARGET_REGEXES) {
    const match = regex.exec(text);
    if (match && match[1]) {
      targets.add(match[1]);
    }
  }
  return [...targets];
}

function checkPath(target, intent) {
  if (matchesAnyGlob(target, intent.forbiddenScope)) {
    return {
      patternId: "forbidden_touch",
      title: "Forbidden scope touch",
      severity: "high",
      matchedText: target,
      assumption: `The action targets "${target}", which is on the forbidden scope declared via /slop-gate:intent set.`,
      challenge:
        "Forbidden scope is the user's explicit fence. Stop and re-confirm the goal before touching this path."
    };
  }

  if (intent.allowedScope.length > 0 && !matchesAnyGlob(target, intent.allowedScope)) {
    return {
      patternId: "scope_creep",
      title: "Scope creep beyond allowed paths",
      severity: "medium",
      advisory: true,
      matchedText: target,
      assumption: `The action targets "${target}", which is outside the allowed scope declared via /slop-gate:intent set.`,
      challenge:
        "Allowed scope is a hint, not a hard fence. Confirm this change is part of the original goal before continuing."
    };
  }

  return null;
}

function detectIntentFindings(input, env = process.env) {
  if (!input || input.hook_event_name !== "PreToolUse") {
    return [];
  }

  const intent = loadIntent(input, env);
  if (!intent || (intent.allowedScope.length === 0 && intent.forbiddenScope.length === 0)) {
    return [];
  }

  const toolName = input.tool_name || "";
  const toolInput = input.tool_input || {};
  const cwd = input.cwd || process.cwd();
  const findings = [];

  if (toolName === "Write" || toolName === "Edit") {
    const target = relativizePath(toolInput.file_path, cwd);
    const finding = checkPath(target, intent);
    if (finding) {
      findings.push(finding);
    }
  } else if (toolName === "MultiEdit") {
    const target = relativizePath(toolInput.file_path, cwd);
    const finding = checkPath(target, intent);
    if (finding) {
      findings.push(finding);
    }
  } else if (toolName === "Bash") {
    const command = String(toolInput.command || "");
    for (const rawTarget of extractBashWriteTargets(command)) {
      const target = relativizePath(rawTarget, cwd);
      const finding = checkPath(target, intent);
      if (finding) {
        findings.push(finding);
        break;
      }
    }
  }

  return findings;
}

module.exports = {
  clearIntent,
  detectIntentFindings,
  extractBashWriteTargets,
  globToRegex,
  intentPath,
  loadIntent,
  matchesAnyGlob,
  normalizeIntent,
  relativizePath,
  saveIntent
};
