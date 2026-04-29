#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_ROOT = path.join(os.homedir(), ".claude", "projects");
const DEFAULT_OUTPUT = "drift-history-audit.md";
const DEFAULT_LIMIT = 250;

const SIGNALS = [
  {
    id: "premature_completion",
    title: "Premature completion or unverified validation",
    score: 5,
    regexes: [
      /\bvalidation complete\b/i,
      /\bfixed and verified\b/i,
      /\bwork complete\b/i,
      /\bready for\b.{0,100}\b(?:testing|apk build|on-device testing|device testing|review)\b/i,
      /\b(?:done|complete|completed)\b.{0,80}\b(?:validated|verified|tested|typechecked)\b/i
    ]
  },
  {
    id: "user_as_tester",
    title: "User-as-tester handoff",
    score: 5,
    regexes: [
      /\b(?:go ahead and|please)\s+(?:pick|try|retry|run|test|verify)\b/i,
      /\blet me know how it goes\b/i,
      /\b(?:you can|you should)\s+(?:try|test|verify|run)\b.{0,80}\b(?:now|again|on your|on the device|in the app)\b/i
    ]
  },
  {
    id: "process_substitution",
    title: "Process substitution",
    score: 4,
    regexes: [
      /\b(?:skill|command|tool|process|workflow)\s+(?:isn'?t|is not|wasn'?t|was not)\s+(?:an\s+)?(?:available|found|configured|enabled|installed).*?\b(?:but|so)\s+i\s+(?:can|will)\b.*?\b(?:directly|manually)\b/is,
      /\blet me just\b.{0,120}\b(?:directly|create|write|do|make)\b/is
    ]
  },
  {
    id: "unsupported_assumption",
    title: "Unsupported causal assumption",
    score: 3,
    regexes: [
      /\b(?:likely|probably|presumably|appears to be|must have been|should now|should work)\b.{0,140}\b(?:timeout|emulator|released|fallback|remove|work|backend|plugin)\b/is,
      /\b(?:timeout|emulator|released|fallback|backend|plugin)\b.{0,140}\b(?:likely|probably|must have been|should now|should work)\b/is
    ]
  },
  {
    id: "workaround_drift",
    title: "Workaround drift from stated requirements",
    score: 4,
    regexes: [
      /\b(?:fallback|workaround)\b/i,
      /\bif you don'?t need\b.{0,100}\b(?:on-device|inference|auth|multimodal|vision)\b/i,
      /\bsimplest fix\b.{0,120}\bremov(?:e|ing)\b/i
    ]
  },
  {
    id: "give_up_boundary",
    title: "Premature boundary or give-up framing",
    score: 3,
    regexes: [
      /\bhonest boundary\b/i,
      /\bcannot test\b/i,
      /\brequires real hardware\b/i,
      /\bstart a new session\b/i
    ]
  },
  {
    id: "verification_path_mismatch",
    title: "Verification path mismatch",
    score: 4,
    regexes: [
      /\bnot the\b.{0,80}\bpath i tested\b/i,
      /\bthat'?s the\b.{0,80}\bpath\b/i,
      /\bunrelated\b.{0,80}\b(?:venv|virtualenv|tool environment|tool venv)\b/i
    ]
  }
];

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const root = expandHome(args.root || DEFAULT_ROOT);
  const outputPath = path.resolve(args.out || DEFAULT_OUTPUT);
  const limit = args.all ? Infinity : parsePositiveInt(args.limit, DEFAULT_LIMIT);

  const audit = auditHistory(root, { limit });
  fs.writeFileSync(outputPath, renderMarkdown(audit, { root, outputPath, limit }));
  process.stdout.write(`${outputPath}\n`);
}

function auditHistory(root, options = {}) {
  const limit = options.limit || DEFAULT_LIMIT;
  const files = findJsonlFiles(root);
  const stats = {
    root,
    files: files.length,
    lines: 0,
    assistantMessages: 0,
    candidateMessages: 0
  };
  const candidates = [];

  for (const file of files) {
    scanTranscript(file, stats, candidates);
  }

  candidates.sort((a, b) => b.score - a.score || String(b.timestamp).localeCompare(String(a.timestamp)));
  stats.candidateMessages = candidates.length;

  return {
    stats,
    candidates: Number.isFinite(limit) ? candidates.slice(0, limit) : candidates,
    totalCandidates: candidates.length,
    signalCounts: countSignals(candidates)
  };
}

function scanTranscript(file, stats, candidates) {
  let lastUser = "";
  let lastUserLine = 0;
  let sessionId = "";
  const lines = safeReadLines(file);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const raw = lines[index];
    if (!raw.trim()) {
      continue;
    }

    stats.lines += 1;

    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      continue;
    }

    sessionId = event.session_id || sessionId;

    if (event.type === "user" && !event.isSynthetic) {
      const text = messageText(event.message || event);
      if (text) {
        lastUser = text;
        lastUserLine = lineNumber;
      }
      continue;
    }

    if (event.type !== "assistant") {
      continue;
    }

    const assistant = messageText(event.message || event);
    if (!assistant) {
      continue;
    }

    stats.assistantMessages += 1;
    const matches = matchSignals(assistant);
    if (!matches.length) {
      continue;
    }

    candidates.push({
      file,
      line: lineNumber,
      sessionId,
      timestamp: event.timestamp || event.message?.timestamp || "",
      userLine: lastUserLine,
      user: redact(lastUser),
      assistant: redact(assistant),
      signals: matches.map((match) => match.id),
      signalTitles: matches.map((match) => match.title),
      score: matches.reduce((total, match) => total + match.score, 0)
    });
  }
}

function matchSignals(text) {
  const matches = [];
  for (const signal of SIGNALS) {
    if (signal.regexes.some((regex) => regex.test(text))) {
      matches.push(signal);
    }
  }
  return matches;
}

function renderMarkdown(audit, options) {
  const generatedAt = new Date().toISOString();
  const limitLabel = Number.isFinite(options.limit) ? String(options.limit) : "all";
  const lines = [
    "# Slop Gate Claude History Audit",
    "",
    `Generated: ${generatedAt}`,
    `Transcript root: \`${options.root}\``,
    "",
    "This file is a candidate corpus for Slop Gate pattern curation. It is not a final pattern repository.",
    "Review these candidates, merge duplicates into abstract drift shapes, then use `/slop-gate:ingest-history` to append reusable patterns.",
    "",
    "## Scan Summary",
    "",
    `- Transcript files scanned: ${audit.stats.files}`,
    `- JSONL lines read: ${audit.stats.lines}`,
    `- Assistant messages inspected: ${audit.stats.assistantMessages}`,
    `- Candidate drift messages found: ${audit.totalCandidates}`,
    `- Candidate messages shown: ${audit.candidates.length} (limit: ${limitLabel})`,
    "",
    "## Signal Counts",
    ""
  ];

  for (const [signal, count] of audit.signalCounts) {
    lines.push(`- \`${signal}\`: ${count}`);
  }

  if (!audit.signalCounts.length) {
    lines.push("- None");
  }

  lines.push("", "## Candidate Episodes", "");

  audit.candidates.forEach((candidate, index) => {
    lines.push(`### Candidate ${index + 1}: ${candidate.signals.map((id) => `\`${id}\``).join(", ")}`);
    lines.push("");
    lines.push(`- Source: \`${candidate.file}:${candidate.line}\``);
    if (candidate.userLine) {
      lines.push(`- Nearest user prompt line: ${candidate.userLine}`);
    }
    if (candidate.sessionId) {
      lines.push(`- Session: \`${candidate.sessionId}\``);
    }
    lines.push(`- Signal titles: ${candidate.signalTitles.join("; ")}`);
    lines.push("", "Nearest user intent:", "");
    lines.push(blockquote(truncate(candidate.user, 1200) || "(no nearby user message found)"));
    lines.push("", "Assistant response excerpt:", "");
    lines.push(blockquote(truncate(candidate.assistant, 1400)));
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
}

function findJsonlFiles(root) {
  const results = [];
  walk(root, results);
  return results.sort();
}

function walk(entry, results) {
  let stat;
  try {
    stat = fs.statSync(entry);
  } catch {
    return;
  }

  if (stat.isFile() && entry.endsWith(".jsonl")) {
    results.push(entry);
    return;
  }

  if (!stat.isDirectory()) {
    return;
  }

  let children;
  try {
    children = fs.readdirSync(entry);
  } catch {
    return;
  }

  for (const child of children) {
    walk(path.join(entry, child), results);
  }
}

function safeReadLines(file) {
  try {
    return fs.readFileSync(file, "utf8").split(/\r?\n/);
  } catch {
    return [];
  }
}

function messageText(message) {
  if (!message || typeof message !== "object") {
    return typeof message === "string" ? message : "";
  }

  if (typeof message.text === "string") {
    return message.text;
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((item) => {
        if (!item || typeof item !== "object") {
          return typeof item === "string" ? item : "";
        }
        if (item.type === "text" && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function countSignals(candidates) {
  const counts = new Map();
  for (const candidate of candidates) {
    for (const signal of candidate.signals) {
      counts.set(signal, (counts.get(signal) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function redact(value) {
  return String(value || "")
    .replace(/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_AWS_ACCESS_KEY]")
    .replace(/(?<=\b(?:token|secret|password|api[_-]?key)\s*[=:]\s*)\S+/gi, "[REDACTED_SECRET]");
}

function truncate(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 3)}...`;
}

function blockquote(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      args.root = argv[++index];
    } else if (arg === "--out") {
      args.out = argv[++index];
    } else if (arg === "--limit") {
      args.limit = argv[++index];
    } else if (arg === "--all") {
      args.all = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function expandHome(value) {
  if (typeof value === "string" && value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/audit-claude-history.js [--root <dir>] [--out <file>] [--limit <n>|--all]\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  auditHistory,
  matchSignals,
  renderMarkdown
};
